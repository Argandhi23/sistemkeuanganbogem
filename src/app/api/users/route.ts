import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { userCreateSchema } from '@/lib/validators';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activityLog';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses khusus Administrator' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            transactions: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat data pengguna' },
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
    const parsed = userCreateSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { name, email, password, role, isActive } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar. Gunakan email lain.' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role,
        isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: 'CREATE_USER',
      targetType: 'User',
      targetId: newUser.id,
      detail: `Tambah user baru: ${newUser.name} (${newUser.email}) sebagai ${newUser.role}`,
    });

    return NextResponse.json(
      {
        message: 'Pengguna baru berhasil ditambahkan',
        data: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menambahkan pengguna' },
      { status: 500 }
    );
  }
}
