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

/**
 * 1. Laporan Laba Rugi (Income Statement)
 */
export async function getIncomeStatement(startDate: Date, endDate: Date): Promise<IncomeStatementResult> {
  const [transactions, allAccounts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        amount: true,
        type: true,
        accountId: true,
        category: true,
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
          },
        },
      },
    }),
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

  // Peta akun
  const accountTotals: Record<string, { total: number; count: number; acc: typeof allAccounts[0] }> = {};
  for (const acc of allAccounts) {
    accountTotals[acc.id] = { total: 0, count: 0, acc };
  }

  // Akun fallback untuk transaksi lama tanpa accountId
  let unassignedIncome = 0;
  let unassignedExpense = 0;

  for (const trx of transactions) {
    const amt = Number(trx.amount);
    if (trx.accountId && accountTotals[trx.accountId]) {
      accountTotals[trx.accountId].total += amt;
      accountTotals[trx.accountId].count += 1;
    } else {
      // Fallback matching cerdas berdasarkan nama pos atau kata kunci
      const catLower = (trx.category || '').toLowerCase().trim();
      const matched = allAccounts.find((a) => {
        const accLower = a.name.toLowerCase();
        return (
          accLower === catLower ||
          accLower.includes(catLower) ||
          catLower.includes(accLower) ||
          (catLower.includes('catering') && a.code === '4001') ||
          (catLower.includes('bahan baku') && a.code === '5001') ||
          (catLower.includes('operasional') && a.code === '5005') ||
          (catLower.includes('gas') && a.code === '5005') ||
          (catLower.includes('kemasan') && a.code === '5002') ||
          (catLower.includes('upah') && a.code === '5003')
        );
      });

      if (matched && accountTotals[matched.id]) {
        accountTotals[matched.id].total += amt;
        accountTotals[matched.id].count += 1;
      } else if (trx.type === 'PEMASUKAN') {
        unassignedIncome += amt;
      } else {
        unassignedExpense += amt;
      }
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

  // Tambahkan unassigned jika ada
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

  // Query Saldo Awal dan Transaksi Periode secara PARALEL
  const [priorTransactions, periodTransactions] = await Promise.all([
    // 1. Saldo Awal (sebelum startDate)
    prisma.transaction.findMany({
      where: {
        OR: [
          { accountId: account.id },
          { category: account.name },
        ],
        date: { lt: startDate },
      },
      select: {
        amount: true,
        type: true,
      },
    }),

    // 2. Transaksi dalam Periode
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
      include: {
        createdBy: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  let openingBalance = 0;
  for (const trx of priorTransactions) {
    const amt = Number(trx.amount);
    if (account.category === AccountCategory.PENDAPATAN) {
      openingBalance += amt;
    } else if (
      account.category === AccountCategory.BEBAN_OPERASIONAL ||
      account.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      openingBalance += amt;
    } else if (account.category === AccountCategory.ASET) {
      openingBalance += trx.type === 'PEMASUKAN' ? amt : -amt;
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
      credit = amt; // Pendapatan bertambah di kredit
      totalCredit += credit;
      currentBalance += amt;
    } else if (
      account.category === AccountCategory.BEBAN_OPERASIONAL ||
      account.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      debit = amt; // Beban bertambah di debit
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
  // Query saldo kas awal dan transaksi berjalan secara PARALEL dalam 1 round-trip
  const [priorTotals, periodTransactions] = await Promise.all([
    // 1. Saldo Kas Awal (Semua transaksi sebelum startDate, dikelompokkan berdasarkan tipe)
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        date: { lt: startDate },
      },
      _sum: { amount: true },
    }),

    // 2. Transaksi Kas Masuk & Keluar Periode Ini dalam 1 query tunggal
    prisma.transaction.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: {
        type: true,
        amount: true,
        category: true,
        account: {
          select: { name: true },
        },
      },
    }),
  ]);

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

  for (const trx of periodTransactions) {
    const amt = Number(trx.amount);
    const catName = trx.account?.name || trx.category || 'Lainnya';

    if (trx.type === 'PEMASUKAN') {
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

/**
 * 4. Laporan Neraca Standar Manajemen (Balance Sheet - SAK EMKM)
 * Formula: Total Aset (Aktiva) = Total Kewajiban + Total Ekuitas (Pasiva)
 */
export async function getBalanceSheet(asOfDate: Date): Promise<BalanceSheetResult> {
  const cutoffDate = new Date(asOfDate);
  cutoffDate.setHours(23, 59, 59, 999);

  const [transactions, accounts] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        date: { lte: cutoffDate },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        accountId: true,
        category: true,
        account: {
          select: {
            code: true,
            name: true,
            category: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    }),
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

  // 1. Hitung Akumulasi Pendapatan & Beban untuk Laba/Rugi Berjalan
  let totalRevenue = 0;
  let totalExpenses = 0;
  let totalCashIn = 0;
  let totalCashOut = 0;

  // Map transaksi per akun
  const accountBalances: Record<string, number> = {};
  for (const acc of accounts) {
    accountBalances[acc.code] = 0;
  }

  for (const trx of transactions) {
    const amt = Number(trx.amount || 0);
    const code = trx.account?.code || '';

    if (trx.type === 'PEMASUKAN') {
      totalCashIn += amt;
    } else {
      totalCashOut += amt;
    }

    if (code.startsWith('4') || trx.account?.category === AccountCategory.PENDAPATAN) {
      totalRevenue += amt;
    } else if (
      code.startsWith('5') ||
      code.startsWith('6') ||
      trx.account?.category === AccountCategory.BEBAN_OPERASIONAL ||
      trx.account?.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      totalExpenses += amt;
    }

    if (code) {
      if (!accountBalances[code]) accountBalances[code] = 0;
      if (trx.type === 'PEMASUKAN') {
        accountBalances[code] += amt;
      } else {
        accountBalances[code] -= amt;
      }
    }
  }

  const currentPeriodProfit = totalRevenue - totalExpenses;
  const netCashBalance = totalCashIn - totalCashOut;

  // 2. ASET LANCAR
  const currentAssetAccounts = accounts.filter(
    (a) => a.category === AccountCategory.ASET && a.code.startsWith('11')
  );

  const currentAssetItems: BalanceSheetItem[] = [];
  // Kas di Bendahara (Kas Riil Operasional)
  currentAssetItems.push({
    code: '1001',
    name: 'Kas Tunai di Bendahara',
    amount: netCashBalance > 0 ? netCashBalance : 0,
  });

  for (const acc of currentAssetAccounts) {
    if (acc.code !== '1001') {
      currentAssetItems.push({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        amount: Math.max(0, accountBalances[acc.code] || 0),
      });
    }
  }

  const totalCurrentAssets = currentAssetItems.reduce((sum, item) => sum + item.amount, 0);

  // 3. ASET TETAP
  const fixedAssetAccounts = accounts.filter(
    (a) => a.category === AccountCategory.ASET && a.code.startsWith('12')
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

  // 4. KEWAJIBAN (LIABILITAS)
  const currentLiabAccounts = accounts.filter(
    (a) => a.category === AccountCategory.KEWAJIBAN && a.code.startsWith('21')
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

  // 5. EKUITAS (MODAL)
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
