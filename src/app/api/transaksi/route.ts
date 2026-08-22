import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { transactionSchema } from '@/lib/validators';
import { appendTransactionRow } from '@/lib/googleSheets';
import { logActivity } from '@/lib/activityLog';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const accountId = searchParams.get('accountId');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Prisma.TransactionWhereInput = {};

    if (type && (type === 'PEMASUKAN' || type === 'PENGELUARAN')) {
      where.type = type;
    }

    if (accountId) {
      where.accountId = accountId;
    } else if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { account: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        account: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ data: transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat data transaksi' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error.issues[0]?.message || 'Data tidak valid';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { type, accountId, description, amount, date } = parsed.data;
    let { category } = parsed.data;

    // Jika accountId ada tapi category belum spesifik, ambil nama akun
    if (accountId) {
      const acc = await prisma.account.findUnique({ where: { id: accountId } });
      if (acc) {
        category = acc.name;
      }
    }

    // 1. Simpan ke Database (PostgreSQL - Source of Truth)
    const transaction = await prisma.transaction.create({
      data: {
        type,
        category,
        accountId: accountId || null,
        description,
        amount,
        date: new Date(date),
        createdById: session.user.id,
        syncedToSheet: false,
      },
      include: {
        account: true,
        createdBy: { select: { id: true, name: true } },
      },
    });

    // 2. Audit Trail (non-blocking)
    logActivity({
      userId: session.user.id,
      action: 'CREATE_TRANSACTION',
      targetType: 'Transaction',
      targetId: transaction.id,
      detail: `Tambah ${type === 'PEMASUKAN' ? 'Uang Masuk' : 'Uang Keluar'}: ${category} - Rp ${Number(amount).toLocaleString('id-ID')} (${description})`,
    }).catch((err) => console.warn('Activity log error:', err));

    // 3. Sinkronisasi ke Google Sheets di latar belakang (fire-and-forget, tidak memblokir respon ke user)
    (async () => {
      try {
        const sheetResult = await appendTransactionRow(
          {
            id: transaction.id,
            type: transaction.type,
            category: transaction.category,
            description: transaction.description,
            amount: Number(transaction.amount),
            date: transaction.date,
          },
          session.user.name || 'Petugas'
        );

        if (sheetResult.success) {
          await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              syncedToSheet: true,
              sheetRowId: sheetResult.sheetRowId || null,
            },
          });
        }
      } catch (syncError) {
        console.warn('Background sync to Google Sheets failed:', syncError);
      }
    })();

    return NextResponse.json(
      {
        message: 'Data transaksi berhasil disimpan',
        data: transaction,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan transaksi' },
      { status: 500 }
    );
  }
}
