import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getDashboardStatsCache, setDashboardStatsCache } from '@/lib/cache';
import { toNum } from '@/lib/formatters';

export const dynamic = 'force-dynamic';

const KNOWN_UNITS = [
  { key: 'CATERING', name: 'Catering Desa', category: 'Konsumsi & Nasi Box', route: '/units/catering' },
  { key: 'RENTAL_MOLEN', name: 'Sewa Molen Cor', category: 'Alat Konstruksi', route: '/units/molen' },
  { key: 'WIFI_DESA', name: 'WiFi Balai Desa', category: 'Layanan Internet', route: '/units/wifi' },
  { key: 'PPOB', name: 'PPOB Loket Desa', category: 'Pembayaran Online', route: '/units/ppob' },
  { key: 'KETAHANAN_PANGAN', name: 'Peternakan Sapi', category: 'Penggemukan Ternak', route: '/units/sapi' },
  { key: 'UMUM', name: 'Operasional Umum', category: 'Kas Kantor BUMDes', route: '/transaksi?businessUnit=UMUM' },
] as const;

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
    const startOfSixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Jalankan query database secara paralel dan hemat memori
    const [
      allTimeTotals,
      monthlyAggregates,
      recentTransactions,
      allTimeByUnit,
      monthByUnit,
      activeCateringOrdersCount,
    ] = await Promise.all([
      // 1. Agregasi Total Keseluruhan
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
      }),

      // 2. Agregasi 6 bulan untuk grafik arus kas
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

      // 3. 6 Transaksi Terbaru
      prisma.transaction.findMany({
        select: {
          id: true,
          type: true,
          category: true,
          businessUnit: true,
          description: true,
          amount: true,
          date: true,
          account: {
            select: { code: true, name: true },
          },
          createdBy: {
            select: { name: true },
          },
        },
        orderBy: { date: 'desc' },
        take: 6,
      }),

      // 4. Kinerja Finansial All-Time per Unit Usaha
      prisma.transaction.groupBy({
        by: ['businessUnit', 'type'],
        _sum: { amount: true },
        _count: { id: true },
      }),

      // 5. Kinerja Finansial Bulan Ini per Unit Usaha
      prisma.transaction.groupBy({
        by: ['businessUnit', 'type'],
        where: { date: { gte: thisMonthStart } },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // 6. Data operasional pendukung (Pesanan aktif catering)
      prisma.cateringOrder.count({
        where: { status: { in: ['PENDING', 'DIPROSES'] } },
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

    // Kalkulasi Metrik Grafik 6 Bulan
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
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

    // Build Unit Financials Matrix
    const unitMap: Record<
      string,
      {
        allTime: { income: number; expense: number; count: number };
        thisMonth: { income: number; expense: number; count: number };
      }
    > = {};

    for (const u of KNOWN_UNITS) {
      unitMap[u.key] = {
        allTime: { income: 0, expense: 0, count: 0 },
        thisMonth: { income: 0, expense: 0, count: 0 },
      };
    }

    for (const row of allTimeByUnit) {
      const u = row.businessUnit || 'UMUM';
      if (!unitMap[u]) {
        unitMap[u] = {
          allTime: { income: 0, expense: 0, count: 0 },
          thisMonth: { income: 0, expense: 0, count: 0 },
        };
      }
      const amt = toNum(row._sum.amount);
      const count = row._count.id;
      unitMap[u].allTime.count += count;
      if (row.type === 'PEMASUKAN') unitMap[u].allTime.income += amt;
      if (row.type === 'PENGELUARAN') unitMap[u].allTime.expense += amt;
    }

    for (const row of monthByUnit) {
      const u = row.businessUnit || 'UMUM';
      if (!unitMap[u]) {
        unitMap[u] = {
          allTime: { income: 0, expense: 0, count: 0 },
          thisMonth: { income: 0, expense: 0, count: 0 },
        };
      }
      const amt = toNum(row._sum.amount);
      const count = row._count.id;
      unitMap[u].thisMonth.count += count;
      if (row.type === 'PEMASUKAN') unitMap[u].thisMonth.income += amt;
      if (row.type === 'PENGELUARAN') unitMap[u].thisMonth.expense += amt;
    }

    const unitFinancials = KNOWN_UNITS.map((u) => {
      const stats = unitMap[u.key] || {
        allTime: { income: 0, expense: 0, count: 0 },
        thisMonth: { income: 0, expense: 0, count: 0 },
      };
      return {
        unit: u.key,
        name: u.name,
        category: u.category,
        route: u.route,
        allTime: {
          income: stats.allTime.income,
          expense: stats.allTime.expense,
          net: stats.allTime.income - stats.allTime.expense,
          count: stats.allTime.count,
        },
        thisMonth: {
          income: stats.thisMonth.income,
          expense: stats.thisMonth.expense,
          net: stats.thisMonth.income - stats.thisMonth.expense,
          count: stats.thisMonth.count,
        },
        activeOrdersCount: u.key === 'CATERING' ? activeCateringOrdersCount : undefined,
      };
    });

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
      chartData,
      recentTransactions,
      unitFinancials,
      unitStats: {
        catering: {
          activeOrdersCount: activeCateringOrdersCount,
          upcomingOrders: [],
        },
        molen: {
          totalUnits: 0,
          availableUnits: 0,
          rentedUnits: 0,
          activeRentalsValue: 0,
        },
        wifi: {
          activeCustomers: 0,
          paidCount: 0,
          unpaidCount: 0,
          paidAmount: 0,
          unpaidAmount: 0,
        },
        ppob: {
          todayCount: 0,
          todayTurnover: 0,
          todayProfit: 0,
          monthCount: 0,
          monthProfit: 0,
        },
        sapi: {
          totalPopulation: 0,
          fatteningCount: 0,
          readyToSellCount: 0,
          soldCount: 0,
          soldRevenue: 0,
          totalExpenses: 0,
        },
      },
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
