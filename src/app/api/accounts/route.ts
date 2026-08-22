import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma, AccountCategory } from '@prisma/client';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';

export const dynamic = 'force-dynamic';

const accountCreateSchema = z.object({
  code: z.string().min(3, 'Kode akun minimal 3 digit').max(10, 'Kode akun maksimal 10 digit'),
  name: z.string().min(3, 'Nama akun minimal 3 karakter'),
  category: z.enum([
    'PENDAPATAN',
    'BEBAN_OPERASIONAL',
    'BEBAN_NON_OPERASIONAL',
    'ASET',
    'KEWAJIBAN',
    'MODAL',
  ]),
});

let cachedAccounts: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 detik cache in-memory

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.trim();
    const includeInactive = searchParams.get('all') === 'true';

    // Jika tanpa filter dan cache masih valid, gunakan cache
    const now = Date.now();
    if (!category && !search && !includeInactive && cachedAccounts && now - cachedAccounts.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(
        { data: cachedAccounts.data },
        {
          headers: {
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
          },
        }
      );
    }

    const where: Prisma.AccountWhereInput = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (category) {
      where.category = category as AccountCategory;
    }
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const accounts = await prisma.account.findMany({
      where,
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    if (!category && !search && !includeInactive) {
      cachedAccounts = { data: accounts, timestamp: now };
    }

    return NextResponse.json(
      { data: accounts },
      {
        headers: {
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat daftar akun' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses khusus Administrator' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = accountCreateSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { code, name, category } = parsed.data;

    const existing = await prisma.account.findUnique({
      where: { code },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Kode akun ${code} sudah digunakan (${existing.name})` },
        { status: 400 }
      );
    }

    const newAccount = await prisma.account.create({
      data: {
        code,
        name,
        category,
        isActive: true,
      },
    });

    // Invalidate cache
    cachedAccounts = null;

    await logActivity({
      userId: session.user.id,
      action: 'CREATE_ACCOUNT',
      targetType: 'Account',
      targetId: newAccount.id,
      detail: `Menambah kode akun baru [${newAccount.code}] ${newAccount.name} (${newAccount.category})`,
    });

    return NextResponse.json(
      {
        message: 'Kode akun keuangan baru berhasil ditambahkan',
        data: newAccount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating account:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menambahkan akun' },
      { status: 500 }
    );
  }
}
