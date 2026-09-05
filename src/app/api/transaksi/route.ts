import { NextRequest, NextResponse } from 'next/server';
import { Prisma, BusinessUnit } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { transactionSchema } from '@/lib/validators';
import { logActivity } from '@/lib/activityLog';
import { invalidateDashboardStatsCache } from '@/lib/cache';

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
    const businessUnit = searchParams.get('businessUnit');
    const search = searchParams.get('search')?.trim();
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const all = searchParams.get('all') === 'true';

    // Pagination parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (type && (type === 'PEMASUKAN' || type === 'PENGELUARAN')) {
      where.type = type;
    }

    if (businessUnit && businessUnit !== 'ALL') {
      where.businessUnit = businessUnit as BusinessUnit;
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
        { account: { code: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (year) {
      const y = parseInt(year, 10);
      if (!isNaN(y)) {
        if (month !== null && month !== undefined && month !== '' && month !== 'ALL') {
          const m = parseInt(month, 10);
          if (!isNaN(m)) {
            const start = new Date(y, m, 1);
            const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
            where.date = { gte: start, lte: end };
          }
        } else {
          const start = new Date(y, 0, 1);
          const end = new Date(y, 11, 31, 23, 59, 59, 999);
          where.date = { gte: start, lte: end };
        }
      }
    } else if (startDate || endDate) {
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

    // Jalankan query data, total count, dan sum summary secara PARALEL
    const [transactions, totalCount, totalsByType] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: {
          id: true,
          type: true,
          category: true,
          businessUnit: true,
          paymentMethod: true,
          accountId: true,
          description: true,
          amount: true,
          date: true,
          createdById: true,
          syncedToSheet: true,
          account: {
            select: {
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        ...(all ? {} : { skip, take: limit }),
      }),
      prisma.transaction.count({ where }),
      prisma.transaction.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
      }),
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    for (const item of totalsByType) {
      const sum = Number(item._sum.amount || 0);
      if (item.type === 'PEMASUKAN') totalIncome += sum;
      if (item.type === 'PENGELUARAN') totalExpense += sum;
    }

    return NextResponse.json({
      data: transactions,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        netBalance: totalIncome - totalExpense,
      },
    });
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

    const { type, accountId, description, amount, date, businessUnit, paymentMethod } = parsed.data;
    let { category } = parsed.data;

    // Jika accountId ada tapi category belum spesifik, ambil nama akun
    if (accountId) {
      const acc = await prisma.account.findUnique({
        where: { id: accountId },
        select: { name: true },
      });
      if (acc) {
        category = acc.name;
      }
    }

    // Anti-duplicate protection
    const recentDuplicate = await prisma.transaction.findFirst({
      where: {
        createdById: session.user.id,
        type,
        amount,
        description,
        date: new Date(date),
        createdAt: {
          gte: new Date(Date.now() - 10000),
        },
      },
      select: {
        id: true,
        type: true,
        category: true,
        businessUnit: true,
        paymentMethod: true,
        description: true,
        amount: true,
        date: true,
        syncedToSheet: true,
        account: {
          select: { code: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (recentDuplicate) {
      return NextResponse.json(
        {
          message: 'Data transaksi berhasil disimpan',
          data: recentDuplicate,
        },
        { status: 200 }
      );
    }

    const normalizedDate =
      typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? new Date(`${date}T12:00:00.000Z`)
        : new Date(date);

    // 1. Simpan ke Database
    const transaction = await prisma.transaction.create({
      data: {
        type,
        category,
        businessUnit: (businessUnit as BusinessUnit) || BusinessUnit.UMUM,
        paymentMethod: paymentMethod || 'TUNAI',
        accountId: accountId || null,
        description,
        amount,
        date: normalizedDate,
        createdById: session.user.id,
        syncedToSheet: false,
      },
      select: {
        id: true,
        type: true,
        category: true,
        businessUnit: true,
        paymentMethod: true,
        description: true,
        amount: true,
        date: true,
        syncedToSheet: true,
        account: {
          select: { code: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    // 1.5. Invalidate Dashboard Cache
    invalidateDashboardStatsCache();

    // 2. Audit Trail (non-blocking)
    logActivity({
      userId: session.user.id,
      action: 'CREATE_TRANSACTION',
      targetType: 'Transaction',
      targetId: transaction.id,
      detail: `Tambah ${type === 'PEMASUKAN' ? 'Uang Masuk' : 'Uang Keluar'}: [${transaction.businessUnit}] ${category} - Rp ${Number(amount).toLocaleString('id-ID')} (${description})`,
    }).catch((err) => console.warn('Activity log error:', err));

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
