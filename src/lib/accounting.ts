import prisma from './prisma';
import { AccountCategory } from '@prisma/client';

export interface AccountSummaryItem {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  total: number;
  transactionCount: number;
}

export interface IncomeStatementResult {
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    accounts: AccountSummaryItem[];
    total: number;
  };
  operatingExpenses: {
    accounts: AccountSummaryItem[];
    total: number;
  };
  grossOperatingProfit: number;
  nonOperatingExpenses: {
    accounts: AccountSummaryItem[];
    total: number;
  };
  netIncome: number;
}

export interface GeneralLedgerEntry {
  id: string;
  date: string;
  description: string;
  type: 'PEMASUKAN' | 'PENGELUARAN';
  amount: number;
  debit: number;
  credit: number;
  runningBalance: number;
  creatorName: string;
}

export interface GeneralLedgerResult {
  account: {
    id: string;
    code: string;
    name: string;
    category: AccountCategory;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  openingBalance: number;
  entries: GeneralLedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export interface CashFlowResult {
  period: {
    startDate: string;
    endDate: string;
  };
  openingCashBalance: number;
  totalCashInflow: number;
  inflowBreakdown: Array<{ name: string; amount: number }>;
  totalCashOutflow: number;
  outflowBreakdown: Array<{ name: string; amount: number }>;
  netCashFlow: number;
  closingCashBalance: number;
}

export interface BalanceSheetItem {
  id?: string;
  code: string;
  name: string;
  amount: number;
}

export interface BalanceSheetSection {
  title: string;
  items: BalanceSheetItem[];
  total: number;
}

export interface BalanceSheetResult {
  asOfDate: string;
  assets: {
    currentAssets: BalanceSheetSection;
    fixedAssets: BalanceSheetSection;
    totalAssets: number;
  };
  liabilities: {
    currentLiabilities: BalanceSheetSection;
    longTermLiabilities: BalanceSheetSection;
    totalLiabilities: number;
  };
  equity: {
    capital: BalanceSheetSection;
    currentPeriodProfit: number;
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  discrepancy: number;
}

export interface EquityStatementResult {
  period: {
    startDate: string;
    endDate: string;
  };
  beginningCapital: number;
  netIncome: number;
  additionalCapital: number;
  withdrawals: number;
  netChange: number;
  endingCapital: number;
  retainedEarnings: number;
}

/**
 * 1. Laporan Laba Rugi (Income Statement) - Menggunakan Agregasi Database Cepat
 */
export async function getIncomeStatement(startDate: Date, endDate: Date): Promise<IncomeStatementResult> {
  const [assignedAggregates, unassignedAggregates, allAccounts] = await Promise.all([
    // Agregasi untuk transaksi yang memiliki accountId
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: { not: null },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    // Agregasi untuk transaksi legacy tanpa accountId
    prisma.transaction.groupBy({
      by: ['category', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: null,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    // Master akun
    prisma.account.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
      },
      orderBy: { code: 'asc' },
    }),
  ]);

  // Peta total per akun
  const accountTotals: Record<string, { total: number; count: number; acc: typeof allAccounts[0] }> = {};
  for (const acc of allAccounts) {
    accountTotals[acc.id] = { total: 0, count: 0, acc };
  }

  for (const item of assignedAggregates) {
    if (item.accountId && accountTotals[item.accountId]) {
      accountTotals[item.accountId].total += Number(item._sum.amount || 0);
      accountTotals[item.accountId].count += item._count._all;
    }
  }

  // Matching fallback untuk data unassigned
  let unassignedIncome = 0;
  let unassignedExpense = 0;

  for (const item of unassignedAggregates) {
    const amt = Number(item._sum.amount || 0);
    const count = item._count._all;
    const catLower = (item.category || '').toLowerCase().trim();

    const matched = allAccounts.find((a) => {
      const accLower = a.name.toLowerCase();
      return (
        accLower === catLower ||
        accLower.includes(catLower) ||
        catLower.includes(accLower) ||
        (catLower.includes('catering') && (a.code === '401' || a.code === '4001')) ||
        (catLower.includes('bahan baku') && (a.code === '501' || a.code === '5001')) ||
        (catLower.includes('tenaga kerja') && a.code === '502') ||
        (catLower.includes('upah') && a.code === '502') ||
        (catLower.includes('kemasan') && (a.code === '503' || a.code === '5002')) ||
        (catLower.includes('transportasi') && (a.code === '504' || a.code === '5004')) ||
        (catLower.includes('gas') && (a.code === '505' || a.code === '5005')) ||
        (catLower.includes('listrik') && (a.code === '505' || a.code === '5005')) ||
        (catLower.includes('operasional') && (a.code === '505' || a.code === '506'))
      );
    });

    if (matched && accountTotals[matched.id]) {
      accountTotals[matched.id].total += amt;
      accountTotals[matched.id].count += count;
    } else if (item.type === 'PEMASUKAN') {
      unassignedIncome += amt;
    } else {
      unassignedExpense += amt;
    }
  }

  const revenueAccounts: AccountSummaryItem[] = [];
  const opexAccounts: AccountSummaryItem[] = [];
  const nonOpexAccounts: AccountSummaryItem[] = [];

  let totalRevenue = 0;
  let totalOperatingExpenses = 0;
  let totalNonOperatingExpenses = 0;

  for (const acc of allAccounts) {
    const data = accountTotals[acc.id];
    if (acc.category === AccountCategory.PENDAPATAN) {
      if (data.total > 0 || data.count > 0) {
        revenueAccounts.push({
          id: acc.id,
          code: acc.code,
          name: acc.name,
          category: acc.category,
          total: data.total,
          transactionCount: data.count,
        });
      }
      totalRevenue += data.total;
    } else if (acc.category === AccountCategory.BEBAN_OPERASIONAL) {
      if (data.total > 0 || data.count > 0) {
        opexAccounts.push({
          id: acc.id,
          code: acc.code,
          name: acc.name,
          category: acc.category,
          total: data.total,
          transactionCount: data.count,
        });
      }
      totalOperatingExpenses += data.total;
    } else if (acc.category === AccountCategory.BEBAN_NON_OPERASIONAL) {
      if (data.total > 0 || data.count > 0) {
        nonOpexAccounts.push({
          id: acc.id,
          code: acc.code,
          name: acc.name,
          category: acc.category,
          total: data.total,
          transactionCount: data.count,
        });
      }
      totalNonOperatingExpenses += data.total;
    }
  }

  if (unassignedIncome > 0) {
    revenueAccounts.push({
      id: 'unassigned-income',
      code: '4999',
      name: 'Pendapatan Lain-lain (Belum Terkategori)',
      category: AccountCategory.PENDAPATAN,
      total: unassignedIncome,
      transactionCount: 1,
    });
    totalRevenue += unassignedIncome;
  }

  if (unassignedExpense > 0) {
    opexAccounts.push({
      id: 'unassigned-expense',
      code: '5999',
      name: 'Beban Operasional Lain-lain (Belum Terkategori)',
      category: AccountCategory.BEBAN_OPERASIONAL,
      total: unassignedExpense,
      transactionCount: 1,
    });
    totalOperatingExpenses += unassignedExpense;
  }

  const grossOperatingProfit = totalRevenue - totalOperatingExpenses;
  const netIncome = grossOperatingProfit - totalNonOperatingExpenses;

  return {
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    revenue: {
      accounts: revenueAccounts,
      total: totalRevenue,
    },
    operatingExpenses: {
      accounts: opexAccounts,
      total: totalOperatingExpenses,
    },
    grossOperatingProfit,
    nonOperatingExpenses: {
      accounts: nonOpexAccounts,
      total: totalNonOperatingExpenses,
    },
    netIncome,
  };
}

/**
 * 2. Buku Besar per Akun (General Ledger)
 */
export async function getGeneralLedger(
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<GeneralLedgerResult> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  // Query Saldo Awal (Agregasi) dan Transaksi Periode secara PARALEL
  const [priorAggregates, periodTransactions] = await Promise.all([
    // 1. Saldo Awal (Agregasi groupBy berdasarkan type)
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        OR: [
          { accountId: account.id },
          { category: account.name },
        ],
        date: { lt: startDate },
      },
      _sum: { amount: true },
    }),

    // 2. Transaksi dalam Periode (hanya kolom yang diperlukan)
    prisma.transaction.findMany({
      where: {
        OR: [
          { accountId: account.id },
          { category: account.name },
        ],
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        date: true,
        description: true,
        type: true,
        amount: true,
        createdBy: {
          select: { name: true },
        },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  let openingBalance = 0;
  for (const item of priorAggregates) {
    const amt = Number(item._sum.amount || 0);
    if (account.category === AccountCategory.PENDAPATAN) {
      openingBalance += amt;
    } else if (
      account.category === AccountCategory.BEBAN_OPERASIONAL ||
      account.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      openingBalance += amt;
    } else if (account.category === AccountCategory.ASET) {
      openingBalance += item.type === 'PEMASUKAN' ? amt : -amt;
    } else {
      openingBalance += amt;
    }
  }

  let currentBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: GeneralLedgerEntry[] = periodTransactions.map((trx) => {
    const amt = Number(trx.amount);
    let debit = 0;
    let credit = 0;

    if (account.category === AccountCategory.PENDAPATAN) {
      credit = amt;
      totalCredit += credit;
      currentBalance += amt;
    } else if (
      account.category === AccountCategory.BEBAN_OPERASIONAL ||
      account.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      debit = amt;
      totalDebit += debit;
      currentBalance += amt;
    } else if (account.category === AccountCategory.ASET) {
      if (trx.type === 'PEMASUKAN') {
        debit = amt;
        totalDebit += debit;
        currentBalance += amt;
      } else {
        credit = amt;
        totalCredit += credit;
        currentBalance -= amt;
      }
    } else {
      credit = amt;
      totalCredit += credit;
      currentBalance += amt;
    }

    return {
      id: trx.id,
      date: trx.date.toISOString(),
      description: trx.description,
      type: trx.type,
      amount: amt,
      debit,
      credit,
      runningBalance: currentBalance,
      creatorName: trx.createdBy?.name || 'Petugas',
    };
  });

  return {
    account: {
      id: account.id,
      code: account.code,
      name: account.name,
      category: account.category,
    },
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    openingBalance,
    entries,
    totalDebit,
    totalCredit,
    closingBalance: currentBalance,
  };
}

/**
 * 3. Rekap Arus Kas Sederhana (Cash Flow Summary)
 */
export async function getCashFlowSummary(
  startDate: Date,
  endDate: Date
): Promise<CashFlowResult> {
  const [priorTotals, periodAggregatesAssigned, periodAggregatesUnassigned] = await Promise.all([
    // 1. Saldo Kas Awal
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        date: { lt: startDate },
      },
      _sum: { amount: true },
    }),

    // 2. Agregasi Transaksi Kas Berdasarkan Akun
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: { not: null },
      },
      _sum: { amount: true },
    }),

    // 3. Agregasi Transaksi Kas Tanpa Akun
    prisma.transaction.groupBy({
      by: ['category', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: null,
      },
      _sum: { amount: true },
    }),
  ]);

  // Master akun untuk mapping nama
  const accounts = await prisma.account.findMany({
    select: { id: true, name: true },
  });
  const accountNameMap = new Map(accounts.map((a) => [a.id, a.name]));

  let priorIncomeSum = 0;
  let priorExpenseSum = 0;
  for (const item of priorTotals) {
    const sum = Number(item._sum.amount || 0);
    if (item.type === 'PEMASUKAN') priorIncomeSum += sum;
    if (item.type === 'PENGELUARAN') priorExpenseSum += sum;
  }
  const openingCashBalance = priorIncomeSum - priorExpenseSum;

  const inflowMap: Record<string, number> = {};
  let totalCashInflow = 0;
  const outflowMap: Record<string, number> = {};
  let totalCashOutflow = 0;

  for (const item of periodAggregatesAssigned) {
    const amt = Number(item._sum.amount || 0);
    const catName = (item.accountId && accountNameMap.get(item.accountId)) || 'Lainnya';

    if (item.type === 'PEMASUKAN') {
      inflowMap[catName] = (inflowMap[catName] || 0) + amt;
      totalCashInflow += amt;
    } else {
      outflowMap[catName] = (outflowMap[catName] || 0) + amt;
      totalCashOutflow += amt;
    }
  }

  for (const item of periodAggregatesUnassigned) {
    const amt = Number(item._sum.amount || 0);
    const catName = item.category || 'Lainnya';

    if (item.type === 'PEMASUKAN') {
      inflowMap[catName] = (inflowMap[catName] || 0) + amt;
      totalCashInflow += amt;
    } else {
      outflowMap[catName] = (outflowMap[catName] || 0) + amt;
      totalCashOutflow += amt;
    }
  }

  const inflowBreakdown = Object.entries(inflowMap).map(([name, amount]) => ({
    name,
    amount,
  }));

  const outflowBreakdown = Object.entries(outflowMap).map(([name, amount]) => ({
    name,
    amount,
  }));

  const netCashFlow = totalCashInflow - totalCashOutflow;
  const closingCashBalance = openingCashBalance + netCashFlow;

  return {
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    openingCashBalance,
    totalCashInflow,
    inflowBreakdown,
    totalCashOutflow,
    outflowBreakdown,
    netCashFlow,
    closingCashBalance,
  };
}

/**
 * 4. Laporan Neraca Standar Manajemen (Balance Sheet - SAK EMKM)
 * Menggunakan Agregasi Database PostgreSQL Berkecepatan Tinggi (O(1) Memory Footprint)
 */
export async function getBalanceSheet(asOfDate: Date): Promise<BalanceSheetResult> {
  const cutoffDate = new Date(asOfDate);
  cutoffDate.setHours(23, 59, 59, 999);

  // Jalankan agregasi transaksi dan master akun secara PARALEL
  const [allTimeTotals, assignedAggregates, unassignedAggregates, accounts] = await Promise.all([
    // 1. Total Seluruh Kas Masuk & Keluar hingga cutoffDate
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        date: { lte: cutoffDate },
      },
      _sum: { amount: true },
    }),

    // 2. Agregasi Saldo per Akun Terdaftar
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: {
        date: { lte: cutoffDate },
        accountId: { not: null },
      },
      _sum: { amount: true },
    }),

    // 3. Agregasi Saldo Transaksi Legacy Tanpa AccountId
    prisma.transaction.groupBy({
      by: ['category', 'type'],
      where: {
        date: { lte: cutoffDate },
        accountId: null,
      },
      _sum: { amount: true },
    }),

    // 4. Master Bagan Akun
    prisma.account.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
      },
      orderBy: { code: 'asc' },
    }),
  ]);

  // Hitung Posisi Kas Riil
  let totalCashIn = 0;
  let totalCashOut = 0;
  for (const item of allTimeTotals) {
    const sum = Number(item._sum.amount || 0);
    if (item.type === 'PEMASUKAN') totalCashIn += sum;
    if (item.type === 'PENGELUARAN') totalCashOut += sum;
  }
  const netCashBalance = totalCashIn - totalCashOut;

  // Map akun dan saldo
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const accountBalances: Record<string, number> = {};
  for (const acc of accounts) {
    accountBalances[acc.code] = 0;
  }

  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const item of assignedAggregates) {
    if (!item.accountId) continue;
    const acc = accountMap.get(item.accountId);
    if (!acc) continue;

    const amt = Number(item._sum.amount || 0);
    const code = acc.code;

    if (code.startsWith('4') || acc.category === AccountCategory.PENDAPATAN) {
      totalRevenue += amt;
    } else if (
      code.startsWith('5') ||
      code.startsWith('6') ||
      acc.category === AccountCategory.BEBAN_OPERASIONAL ||
      acc.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      totalExpenses += amt;
    }

    if (item.type === 'PEMASUKAN') {
      accountBalances[code] = (accountBalances[code] || 0) + amt;
    } else {
      accountBalances[code] = (accountBalances[code] || 0) - amt;
    }
  }

  // Handle unassigned categories
  for (const item of unassignedAggregates) {
    const amt = Number(item._sum.amount || 0);
    const catLower = (item.category || '').toLowerCase().trim();

    const matched = accounts.find((a) => {
      const accLower = a.name.toLowerCase();
      return (
        accLower === catLower ||
        accLower.includes(catLower) ||
        catLower.includes(accLower) ||
        (catLower.includes('catering') && (a.code === '401' || a.code === '4001')) ||
        (catLower.includes('bahan baku') && (a.code === '501' || a.code === '5001')) ||
        (catLower.includes('tenaga kerja') && a.code === '502') ||
        (catLower.includes('kemasan') && (a.code === '503' || a.code === '5002')) ||
        (catLower.includes('transportasi') && (a.code === '504' || a.code === '5004')) ||
        (catLower.includes('gas') && (a.code === '505' || a.code === '5005'))
      );
    });

    if (matched) {
      const code = matched.code;
      if (code.startsWith('4') || matched.category === AccountCategory.PENDAPATAN) {
        totalRevenue += amt;
      } else if (
        code.startsWith('5') ||
        code.startsWith('6') ||
        matched.category === AccountCategory.BEBAN_OPERASIONAL ||
        matched.category === AccountCategory.BEBAN_NON_OPERASIONAL
      ) {
        totalExpenses += amt;
      }

      if (item.type === 'PEMASUKAN') {
        accountBalances[code] = (accountBalances[code] || 0) + amt;
      } else {
        accountBalances[code] = (accountBalances[code] || 0) - amt;
      }
    } else {
      if (item.type === 'PEMASUKAN') {
        totalRevenue += amt;
      } else {
        totalExpenses += amt;
      }
    }
  }

  const currentPeriodProfit = totalRevenue - totalExpenses;

  // 1. ASET LANCAR (Kas 1001, Bank 1002, Piutang 1003, Persediaan 1004)
  const isFixedAsset = (acc: typeof accounts[0]) =>
    acc.code === '1005' ||
    acc.code === '105' ||
    acc.code.startsWith('12') ||
    acc.name.toLowerCase().includes('peralatan') ||
    acc.name.toLowerCase().includes('inventaris');

  const currentAssetAccounts = accounts.filter(
    (a) => a.category === AccountCategory.ASET && !isFixedAsset(a)
  );

  const currentAssetItems: BalanceSheetItem[] = [];
  
  // Jika akun 1001 Kas Tunai terdaftar
  const kasAccount = currentAssetAccounts.find(
    (a) => a.code === '1001' || a.code === '101' || a.name.toLowerCase().includes('kas')
  );
  currentAssetItems.push({
    id: kasAccount?.id,
    code: kasAccount?.code || '1001',
    name: kasAccount?.name || 'Kas Tunai',
    amount: netCashBalance > 0 ? netCashBalance : 0,
  });

  for (const acc of currentAssetAccounts) {
    if (acc.code !== '1001' && acc.code !== '101' && acc.code !== (kasAccount?.code || '1001')) {
      currentAssetItems.push({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        amount: Math.max(0, accountBalances[acc.code] || 0),
      });
    }
  }

  const totalCurrentAssets = currentAssetItems.reduce((sum, item) => sum + item.amount, 0);

  // 2. ASET TETAP (105 Peralatan catering)
  const fixedAssetAccounts = accounts.filter(
    (a) => a.category === AccountCategory.ASET && isFixedAsset(a)
  );

  const fixedAssetItems: BalanceSheetItem[] = [];
  for (const acc of fixedAssetAccounts) {
    const isAccumulatedDepreciation = acc.code === '1209' || acc.name.toLowerCase().includes('akumulasi');
    const rawVal = accountBalances[acc.code] || 0;
    const finalAmount = isAccumulatedDepreciation ? -Math.abs(rawVal) : rawVal;

    fixedAssetItems.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      amount: finalAmount,
    });
  }

  const totalFixedAssets = fixedAssetItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  // 3. KEWAJIBAN (LIABILITAS - 201 Utang usaha)
  const currentLiabAccounts = accounts.filter(
    (a) => a.category === AccountCategory.KEWAJIBAN && !a.code.startsWith('22')
  );
  const longLiabAccounts = accounts.filter(
    (a) => a.category === AccountCategory.KEWAJIBAN && a.code.startsWith('22')
  );

  const currentLiabItems: BalanceSheetItem[] = currentLiabAccounts.map((acc) => ({
    id: acc.id,
    code: acc.code,
    name: acc.name,
    amount: Math.abs(accountBalances[acc.code] || 0),
  }));

  const longLiabItems: BalanceSheetItem[] = longLiabAccounts.map((acc) => ({
    id: acc.id,
    code: acc.code,
    name: acc.name,
    amount: Math.abs(accountBalances[acc.code] || 0),
  }));

  const totalCurrentLiabilities = currentLiabItems.reduce((sum, item) => sum + item.amount, 0);
  const totalLongTermLiabilities = longLiabItems.reduce((sum, item) => sum + item.amount, 0);
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

  // 4. EKUITAS (MODAL - 301 Modal usaha, 302 Laba ditahan)
  const capitalAccounts = accounts.filter((a) => a.category === AccountCategory.MODAL);
  const capitalItems: BalanceSheetItem[] = [];

  for (const acc of capitalAccounts) {
    capitalItems.push({
      id: acc.id,
      code: acc.code,
      name: acc.name,
      amount: accountBalances[acc.code] || 0,
    });
  }

  const totalCapital = capitalItems.reduce((sum, item) => sum + item.amount, 0);
  const totalEquity = totalCapital + currentPeriodProfit;

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const discrepancy = totalAssets - totalLiabilitiesAndEquity;

  return {
    asOfDate: cutoffDate.toISOString().split('T')[0],
    assets: {
      currentAssets: {
        title: 'Aset Lancar',
        items: currentAssetItems,
        total: totalCurrentAssets,
      },
      fixedAssets: {
        title: 'Aset Tetap',
        items: fixedAssetItems,
        total: totalFixedAssets,
      },
      totalAssets,
    },
    liabilities: {
      currentLiabilities: {
        title: 'Kewajiban Jangka Pendek',
        items: currentLiabItems,
        total: totalCurrentLiabilities,
      },
      longTermLiabilities: {
        title: 'Kewajiban Jangka Panjang',
        items: longLiabItems,
        total: totalLongTermLiabilities,
      },
      totalLiabilities,
    },
    equity: {
      capital: {
        title: 'Modal & Cadangan',
        items: capitalItems,
        total: totalCapital,
      },
      currentPeriodProfit,
      totalEquity,
    },
    totalLiabilitiesAndEquity,
    isBalanced: Math.abs(discrepancy) < 1,
    discrepancy,
  };
}

/**
 * 5. Laporan Perubahan Modal / Ekuitas (Statement of Changes in Equity - SAK EMKM)
 */
export async function getEquityStatement(
  startDate: Date,
  endDate: Date
): Promise<EquityStatementResult> {
  // 1. Ambil Laba Rugi Periode Berjalan
  const incomeStatement = await getIncomeStatement(startDate, endDate);
  const netIncome = incomeStatement.netIncome;

  // 2. Ambil Transaksi Modal Historis (Sebelum startDate untuk Saldo Awal) & Periode Berjalan
  const [priorCapitalAgg, periodCapitalTrx] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: {
        account: { category: AccountCategory.MODAL },
        date: { lt: startDate },
      },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where: {
        account: { category: AccountCategory.MODAL },
        date: { gte: startDate, lte: endDate },
      },
      include: { account: true },
    }),
  ]);

  // Hitung Modal Awal dari transaksi terdahulu
  let beginningCapital = 0;
  for (const item of priorCapitalAgg) {
    const amt = Number(item._sum.amount || 0);
    beginningCapital += item.type === 'PEMASUKAN' ? amt : -amt;
  }

  let additionalCapital = 0;
  let withdrawals = 0;

  for (const trx of periodCapitalTrx) {
    const amt = Number(trx.amount);
    if (trx.type === 'PEMASUKAN') {
      additionalCapital += amt;
    } else {
      withdrawals += amt;
    }
  }

  const netChange = netIncome + additionalCapital - withdrawals;
  const endingCapital = beginningCapital + netChange;

  return {
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    beginningCapital,
    netIncome,
    additionalCapital,
    withdrawals,
    netChange,
    endingCapital,
    retainedEarnings: beginningCapital,
  };
}
