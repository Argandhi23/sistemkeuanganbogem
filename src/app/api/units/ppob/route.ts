import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PpobType } from '@prisma/client';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ppobTransactionSchema } from '@/lib/validators';
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
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.PpobTransactionWhereInput = {};
    if (type && type !== 'ALL') where.type = type as PpobType;
    if (search) {
      where.OR = [
        { transactionNo: { contains: search, mode: 'insensitive' } },
        { targetNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const thisMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [transactions, totalCount, todayStats, monthStats] = await Promise.all([
      prisma.ppobTransaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.ppobTransaction.count({ where }),
      // Statistik Hari Ini
      prisma.ppobTransaction.aggregate({
        where: { date: { gte: todayStart }, status: 'SUKSES' },
        _count: { id: true },
        _sum: { sellingPrice: true, costPrice: true, adminFee: true },
      }),
      // Statistik Bulan Ini
      prisma.ppobTransaction.aggregate({
        where: { date: { gte: thisMonthStart }, status: 'SUKSES' },
        _count: { id: true },
        _sum: { sellingPrice: true, costPrice: true, adminFee: true },
      }),
    ]);

    return NextResponse.json({
      data: transactions,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        todayCount: todayStats._count.id || 0,
        todayTurnover: Number(todayStats._sum.sellingPrice || 0),
        todayProfit: Number(todayStats._sum.adminFee || 0),
        monthCount: monthStats._count.id || 0,
        monthTurnover: Number(monthStats._sum.sellingPrice || 0),
        monthProfit: Number(monthStats._sum.adminFee || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching ppob transactions:', error);
    return NextResponse.json({ error: 'Gagal memuat data transaksi PPOB' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ppobTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data transaksi PPOB tidak valid' },
        { status: 400 }
      );
    }

    const { type, targetNumber, customerName, costPrice, sellingPrice, status, date, notes, syncToTransaction } =
      parsed.data;

    const adminFee = Math.max(0, sellingPrice - costPrice);

    const now = date ? new Date(date) : new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const transactionNo = `PPOB-${dateStr}-${randomSuffix}`;

    const transaction = await prisma.ppobTransaction.create({
      data: {
        transactionNo,
        type,
        targetNumber,
        customerName: customerName || null,
        costPrice,
        sellingPrice,
        adminFee,
        status,
        date: now,
        notes: notes || null,
        createdById: session.user.id,
      },
    });

    // Jika status SUKSES dan syncToTransaction, catat margin laba ke Kas BUMDes
    if (syncToTransaction && status === 'SUKSES' && adminFee > 0) {
      const ppobAccount = await prisma.account.findFirst({
        where: { code: '4030' },
      });

      await prisma.transaction.create({
        data: {
          type: 'PEMASUKAN',
          category: 'Pendapatan Margin & Admin Fee PPOB',
          businessUnit: 'PPOB',
          paymentMethod: 'TUNAI',
          accountId: ppobAccount?.id || null,
          description: `Fee Kasir PPOB ${type}: ${targetNumber} (Jual: ${sellingPrice.toLocaleString('id-ID')})`,
          amount: adminFee,
          date: now,
          createdById: session.user.id,
        },
      });
      invalidateDashboardStatsCache();
    }

    void logActivity({
      userId: session.user.id,
      action: 'TRANSAKSI_PPOB',
      targetType: 'PpobTransaction',
      targetId: transaction.id,
      detail: `PPOB ${type} ke ${targetNumber}, fee: Rp ${adminFee.toLocaleString('id-ID')}`,
    });

    return NextResponse.json(
      { message: 'Transaksi PPOB berhasil dicatat', data: transaction },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating ppob transaction:', error);
    return NextResponse.json({ error: 'Gagal mencatat transaksi PPOB' }, { status: 500 });
  }
}
