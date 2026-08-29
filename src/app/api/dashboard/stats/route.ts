import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getDashboardStatsCache, setDashboardStatsCache } from '@/lib/cache';

import { toNum } from '@/lib/formatters';

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
    // Rentang 6 bulan terakhir untuk grafik dan metrik bulanan
    const startOfSixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Jalankan query database secara paralel dan hemat memori
    const [
      allTimeTotals,
      monthlyAggregates,
      unsyncedTransactions,
      recentTransactions,
    ] = await Promise.all([
      // 1. Agregasi Total Keseluruhan (Pemasukan & Pengeluaran all-time dalam 1 query groupBy)
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
      }),

      // 2. Agregasi ringkas 6 bulan langsung di level database (SQL DATE TRUNC / TO_CHAR)
      prisma.$queryRaw<Array<{ month_key: string; type: string; total: number }>>`
        SELECT 
          TO_CHAR("date" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS month_key,
          "type"::text AS "type",
          COALESCE(SUM("amount"), 0)::FLOAT AS total
        FROM "Transaction"
        WHERE "date" >= ${startOfSixMonthsAgo}
        GROUP BY month_key, "type"
        ORDER BY month_key ASC;
      `.catch(async () => {
        // Fallback aman jika terjadi anomali queryRaw
        const raw = await prisma.transaction.findMany({
          where: { date: { gte: startOfSixMonthsAgo } },
          select: { date: true, type: true, amount: true },
        });
        const map = new Map<string, { month_key: string; type: string; total: number }>();
        for (const r of raw) {
          const d = new Date(r.date);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const k = `${d.getFullYear()}-${mm}_${r.type}`;
          const cur = map.get(k) || { month_key: `${d.getFullYear()}-${mm}`, type: r.type, total: 0 };
          cur.total += toNum(r.amount);
          map.set(k, cur);
        }
        return Array.from(map.values());
      }),

      // 3. Status Pending Google Sheets Sync
      prisma.transaction.count({
        where: { syncedToSheet: false },
      }),

      // 4. Transaksi Terbaru (5 data terakhir dengan select optimal)
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
      const sum = toNum(item._sum.amount);
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

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${d.getFullYear()}-${mm}`;
      const name = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      const bucket = { name, pemasukan: 0, pengeluaran: 0 };
      chartBuckets[key] = bucket;
      chartData.push(bucket);
    }

    let curInc = 0;
    let curExp = 0;
    let prvInc = 0;
    let prvExp = 0;

    for (const row of monthlyAggregates) {
      const monthKey = row.month_key;
      const amt = Number(row.total || 0);
      const isIncome = row.type === 'PEMASUKAN';

      if (monthKey === currentMonthKey) {
        if (isIncome) curInc += amt;
        else curExp += amt;
      } else if (monthKey === prevMonthKey) {
        if (isIncome) prvInc += amt;
        else prvExp += amt;
      }

      if (chartBuckets[monthKey]) {
        if (isIncome) {
          chartBuckets[monthKey].pemasukan += amt;
        } else {
          chartBuckets[monthKey].pengeluaran += amt;
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
