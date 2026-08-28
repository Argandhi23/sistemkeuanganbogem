import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getDashboardStatsCache, setDashboardStatsCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const cachedData = getDashboardStatsCache();
    if (cachedData) {
      return NextResponse.json(
        { data: cachedData },
        {
          headers: {
            'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
          },
        }
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Rentang 6 bulan terakhir untuk grafik dan metrik bulanan
    const startOfSixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Jalankan query database secara paralel
    const [
      allTimeTotals,
      sixMonthsTransactions,
      unsyncedTransactions,
      recentTransactions,
    ] = await Promise.all([
      // 1. Agregasi Total Keseluruhan (Pemasukan & Pengeluaran all-time dalam 1 query groupBy)
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
      }),

      // 2. Transaksi 6 bulan terakhir (hanya kolom yang dibutuhkan)
      prisma.transaction.findMany({
        where: {
          date: { gte: startOfSixMonthsAgo },
        },
        select: {
          date: true,
          type: true,
          amount: true,
        },
      }),

      // 3. Status Pending Google Sheets Sync
      prisma.transaction.count({
        where: { syncedToSheet: false },
      }),

      // 4. Transaksi Terbaru (5 data terakhir)
      prisma.transaction.findMany({
        select: {
          id: true,
          type: true,
          category: true,
          description: true,
          amount: true,
          date: true,
          syncedToSheet: true,
          account: {
            select: {
              code: true,
              name: true,
            },
          },
          createdBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
    ]);

    // Kalkulasi Total All-Time
    let totalIncome = 0;
    let totalExpense = 0;
    for (const item of allTimeTotals) {
      const sum = Number(item._sum.amount || 0);
      if (item.type === 'PEMASUKAN') totalIncome += sum;
      if (item.type === 'PENGELUARAN') totalExpense += sum;
    }
    const currentBalance = totalIncome - totalExpense;

    // Kalkulasi Metrik Bulan Ini, Bulan Lalu, dan Data Grafik 6 Bulan
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'
    ];

    const chartBuckets: { [key: string]: { name: string; pemasukan: number; pengeluaran: number } } = {};
    const chartData: Array<{ name: string; pemasukan: number; pengeluaran: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const name = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      const bucket = { name, pemasukan: 0, pengeluaran: 0 };
      chartBuckets[key] = bucket;
      chartData.push(bucket);
    }

    let curInc = 0;
    let curExp = 0;
    let prvInc = 0;
    let prvExp = 0;

    for (const trx of sixMonthsTransactions) {
      const trxDate = new Date(trx.date);
      const amt = Number(trx.amount || 0);
      const isIncome = trx.type === 'PEMASUKAN';

      // Cek apakah transaksi bulan ini
      if (trxDate >= startOfMonth && trxDate <= endOfMonth) {
        if (isIncome) curInc += amt;
        else curExp += amt;
      }
      // Cek apakah transaksi bulan lalu
      else if (trxDate >= startOfPrevMonth && trxDate <= endOfPrevMonth) {
        if (isIncome) prvInc += amt;
        else prvExp += amt;
      }

      // Masukkan ke bucket chart bulan bersangkutan
      const key = `${trxDate.getFullYear()}-${trxDate.getMonth()}`;
      if (chartBuckets[key]) {
        if (isIncome) {
          chartBuckets[key].pemasukan += amt;
        } else {
          chartBuckets[key].pengeluaran += amt;
        }
      }
    }

    const incomeGrowth = prvInc > 0 ? Math.round(((curInc - prvInc) / prvInc) * 100) : (curInc > 0 ? 100 : 0);
    const expenseGrowth = prvExp > 0 ? Math.round(((curExp - prvExp) / prvExp) * 100) : (curExp > 0 ? 100 : 0);

    const payload = {
      summary: {
        monthlyIncome: curInc,
        monthlyExpense: curExp,
        incomeGrowth,
        expenseGrowth,
        currentBalance,
        totalIncome,
        totalExpense,
      },
      sync: {
        unsyncedTotal: unsyncedTransactions,
        unsyncedTransactions,
        unsyncedOrders: 0,
      },
      chartData,
      upcomingOrders: [],
      recentTransactions,
    };

    setDashboardStatsCache(payload);

    return NextResponse.json({ data: payload });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memuat data statistik dashboard' },
      { status: 500 }
    );
  }
}
