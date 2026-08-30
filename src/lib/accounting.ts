import prisma from './prisma';
import { AccountCategory } from '@prisma/client';
import { toNum, normalizeDateRangeWIB } from './formatters';

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

export interface CashFlowActivityItem {
  code: string;
  name: string;
  amount: number;
}

export interface CashFlowActivitySection {
  title: string;
  inflows: CashFlowActivityItem[];
  totalInflow: number;
  outflows: CashFlowActivityItem[];
  totalOutflow: number;
  netAmount: number;
}

export interface CashFlowResult {
  period: {
    startDate: string;
    endDate: string;
  };
  operatingActivities: CashFlowActivitySection;
  investingActivities: CashFlowActivitySection;
  financingActivities: CashFlowActivitySection;
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
 * Helper untuk normalisasi tanggal awal & akhir periode dengan memperhitungkan zona waktu Indonesia (WIB)
 */
function normalizeDateRange(startDate: Date | string, endDate: Date | string) {
  return normalizeDateRangeWIB(startDate, endDate);
}

/**
 * 1. Laporan Laba Rugi (Income Statement) - Agregasi Presisi Berstandar SAK EMKM
 */
export async function getIncomeStatement(
  startDateInput: Date | string,
  endDateInput: Date | string
): Promise<IncomeStatementResult> {
  const { start: startDate, end: endDate } = normalizeDateRange(startDateInput, endDateInput);

  const [assignedAggregates, unassignedAggregates, allAccounts] = await Promise.all([
    // 1. Agregasi untuk transaksi yang memiliki accountId
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: { not: null },
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    // 2. Agregasi untuk transaksi legacy / tanpa accountId
    prisma.transaction.groupBy({
      by: ['category', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: null,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),

    // 3. Master akun aktif
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

  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
  const accountTotals: Record<string, { total: number; count: number; acc: (typeof allAccounts)[0] }> = {};

  for (const acc of allAccounts) {
    accountTotals[acc.id] = { total: 0, count: 0, acc };
  }

  let unassignedOperatingIncome = 0;
  let unassignedOperatingExpense = 0;

  // Proses transaksi yang memiliki accountId
  for (const item of assignedAggregates) {
    if (!item.accountId) continue;
    const acc = accountMap.get(item.accountId);
    const amt = Number(item._sum.amount || 0);
    const count = item._count._all;

    if (!acc) {
      if (item.type === 'PEMASUKAN') unassignedOperatingIncome += amt;
      else unassignedOperatingExpense += amt;
      continue;
    }

    // Jika akun terdaftar adalah akun pendapatan atau beban
    if (
      acc.category === AccountCategory.PENDAPATAN ||
      acc.category === AccountCategory.BEBAN_OPERASIONAL ||
      acc.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      accountTotals[acc.id].total += amt;
      accountTotals[acc.id].count += count;
    }
    // Jika transaksi dicatat menggunakan akun Kas Tunai (ASET) sebagai pos, jangan hilangkan dari Laba Rugi
    else if (acc.code === '1001' || acc.code === '101' || acc.name.toLowerCase().includes('kas')) {
      if (item.type === 'PEMASUKAN') {
        const cateringAcc = allAccounts.find((a) => a.code === '4001' || a.category === AccountCategory.PENDAPATAN);
        if (cateringAcc && accountTotals[cateringAcc.id]) {
          accountTotals[cateringAcc.id].total += amt;
          accountTotals[cateringAcc.id].count += count;
        } else {
          unassignedOperatingIncome += amt;
        }
      } else {
        const opexAcc = allAccounts.find((a) => a.code === '5006' || a.category === AccountCategory.BEBAN_OPERASIONAL);
        if (opexAcc && accountTotals[opexAcc.id]) {
          accountTotals[opexAcc.id].total += amt;
          accountTotals[opexAcc.id].count += count;
        } else {
          unassignedOperatingExpense += amt;
        }
      }
    }
    // Jika akun MODAL (3001/3002) atau KEWAJIBAN (2001) atau ASET TETAP (1005), itu adalah transaksi neraca non-operasional
  }

  // Proses transaksi unassigned (kategori teks bebas)
  for (const item of unassignedAggregates) {
    const amt = Number(item._sum.amount || 0);
    const count = item._count._all;
    const catLower = (item.category || '').toLowerCase().trim();

    // Matching cerdas dengan nama akun
    const matched = allAccounts.find((a) => {
      const accLower = a.name.toLowerCase();
      return (
        accLower === catLower ||
        accLower.includes(catLower) ||
        catLower.includes(accLower) ||
        (catLower.includes('catering') && (a.code === '4001' || a.code === '401')) ||
        (catLower.includes('bahan baku') && (a.code === '5001' || a.code === '501')) ||
        ((catLower.includes('perlengkapan') || catLower.includes('kemasan') || catLower.includes('box') || catLower.includes('plastik')) && (a.code === '5002' || a.code === '503')) ||
        ((catLower.includes('tenaga kerja') || catLower.includes('upah') || catLower.includes('gaji')) && (a.code === '5003' || a.code === '502')) ||
        ((catLower.includes('pemeliharaan') || catLower.includes('servis') || catLower.includes('perbaikan')) && a.code === '5004') ||
        ((catLower.includes('transportasi') || catLower.includes('bensin') || catLower.includes('pengantaran')) && (a.code === '5005' || a.code === '504')) ||
        ((catLower.includes('gas') || catLower.includes('listrik') || catLower.includes('air') || catLower.includes('elpiji')) && (a.code === '5006' || a.code === '505')) ||
        (catLower.includes('operasional') && (a.code === '5007' || a.code === '5006' || a.code === '506')) ||
        ((catLower.includes('utang') || catLower.includes('hutang') || catLower.includes('pinjaman')) && (a.category === AccountCategory.KEWAJIBAN || a.code.startsWith('2')))
      );
    });

    if (matched && accountTotals[matched.id]) {
      if (
        matched.category === AccountCategory.PENDAPATAN ||
        matched.category === AccountCategory.BEBAN_OPERASIONAL ||
        matched.category === AccountCategory.BEBAN_NON_OPERASIONAL
      ) {
        accountTotals[matched.id].total += amt;
        accountTotals[matched.id].count += count;
      }
    } else if (item.type === 'PEMASUKAN') {
      unassignedOperatingIncome += amt;
    } else {
      unassignedOperatingExpense += amt;
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

  if (unassignedOperatingIncome > 0) {
    revenueAccounts.push({
      id: 'unassigned-income',
      code: '4002',
      name: 'Pendapatan Usaha Lain-lain (Belum Terkategori)',
      category: AccountCategory.PENDAPATAN,
      total: unassignedOperatingIncome,
      transactionCount: 1,
    });
    totalRevenue += unassignedOperatingIncome;
  }

  if (unassignedOperatingExpense > 0) {
    opexAccounts.push({
      id: 'unassigned-expense',
      code: '5006',
      name: 'Beban Operasional Lain-lain (Belum Terkategori)',
      category: AccountCategory.BEBAN_OPERASIONAL,
      total: unassignedOperatingExpense,
      transactionCount: 1,
    });
    totalOperatingExpenses += unassignedOperatingExpense;
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
 * 2. Buku Besar per Akun (General Ledger) - Termasuk Buku Kas Umum (1001)
 */
export async function getGeneralLedger(
  accountId: string,
  startDateInput: Date | string,
  endDateInput: Date | string
): Promise<GeneralLedgerResult> {
  const { start: startDate, end: endDate } = normalizeDateRange(startDateInput, endDateInput);

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
  });

  const isMainCashAccount =
    account.code === '1001' ||
    account.code === '101' ||
    account.name.toLowerCase().includes('kas tunai');

  // 1. Saldo Awal (sebelum startDate)
  let openingBalance = 0;

  if (isMainCashAccount) {
    // Untuk Kas Tunai (Buku Kas Umum), saldo awal = seluruh penerimaan kas - seluruh pengeluaran kas sebelum startDate
    const priorTotals = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        date: { lt: startDate },
      },
      _sum: { amount: true },
    });

    for (const item of priorTotals) {
      const amt = Number(item._sum.amount || 0);
      if (item.type === 'PEMASUKAN') openingBalance += amt;
      else openingBalance -= amt;
    }
  } else {
    // Untuk akun spesifik lainnya
    const priorAggregates = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        OR: [
          { accountId: account.id },
          { category: { contains: account.name, mode: 'insensitive' } },
        ],
        date: { lt: startDate },
      },
      _sum: { amount: true },
    });

    for (const item of priorAggregates) {
      const amt = Number(item._sum.amount || 0);
      if (account.category === AccountCategory.PENDAPATAN) {
        openingBalance += item.type === 'PEMASUKAN' ? amt : -amt;
      } else if (
        account.category === AccountCategory.BEBAN_OPERASIONAL ||
        account.category === AccountCategory.BEBAN_NON_OPERASIONAL
      ) {
        openingBalance += item.type === 'PENGELUARAN' ? amt : -amt;
      } else if (account.category === AccountCategory.ASET) {
        // Aset non-kas: belanja aset (PENGELUARAN) = bertambah (+), pelunasan piutang/jual (PEMASUKAN) = berkurang (-)
        openingBalance += item.type === 'PENGELUARAN' ? amt : -amt;
      } else {
        // Kewajiban & Modal: PEMASUKAN = bertambah (+), PENGELUARAN = berkurang (-)
        openingBalance += item.type === 'PEMASUKAN' ? amt : -amt;
      }
    }
  }

  // 2. Transaksi dalam Periode
  const periodTransactions = await prisma.transaction.findMany({
    where: isMainCashAccount
      ? {
          date: {
            gte: startDate,
            lte: endDate,
          },
        }
      : {
          OR: [
            { accountId: account.id },
            { category: { contains: account.name, mode: 'insensitive' } },
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
      category: true,
      type: true,
      amount: true,
      createdBy: {
        select: { name: true },
      },
    },
    orderBy: { date: 'asc' },
  });

  let currentBalance = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: GeneralLedgerEntry[] = periodTransactions.map((trx) => {
    const amt = Number(trx.amount);
    let debit = 0;
    let credit = 0;

    if (isMainCashAccount) {
      // Kas Tunai: Uang Masuk = Debet Kas, Uang Keluar = Kredit Kas
      if (trx.type === 'PEMASUKAN') {
        debit = amt;
        totalDebit += debit;
        currentBalance += amt;
      } else {
        credit = amt;
        totalCredit += credit;
        currentBalance -= amt;
      }
    } else if (account.category === AccountCategory.PENDAPATAN) {
      // Pendapatan: bertambah di Kredit saat Pemasukan
      if (trx.type === 'PEMASUKAN') {
        credit = amt;
        totalCredit += credit;
        currentBalance += amt;
      } else {
        debit = amt;
        totalDebit += debit;
        currentBalance -= amt;
      }
    } else if (
      account.category === AccountCategory.BEBAN_OPERASIONAL ||
      account.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      // Beban: bertambah di Debet saat Pengeluaran
      if (trx.type === 'PENGELUARAN') {
        debit = amt;
        totalDebit += debit;
        currentBalance += amt;
      } else {
        credit = amt;
        totalCredit += credit;
        currentBalance -= amt;
      }
    } else if (account.category === AccountCategory.ASET) {
      // Aset Non-Kas (Persediaan, Perlengkapan, Peralatan, Piutang):
      // Uang Keluar (Beli Aset) = Debet Aset (Bertambah)
      // Uang Masuk (Pelunasan Piutang / Jual Aset) = Kredit Aset (Berkurang)
      if (trx.type === 'PENGELUARAN') {
        debit = amt;
        totalDebit += debit;
        currentBalance += amt;
      } else {
        credit = amt;
        totalCredit += credit;
        currentBalance -= amt;
      }
    } else {
      // Modal / Kewajiban: bertambah di Kredit saat Pemasukan, berkurang di Debet saat Pengeluaran
      if (trx.type === 'PEMASUKAN') {
        credit = amt;
        totalCredit += credit;
        currentBalance += amt;
      } else {
        debit = amt;
        totalDebit += debit;
        currentBalance -= amt;
      }
    }

    return {
      id: trx.id,
      date: trx.date.toISOString(),
      description: isMainCashAccount ? `[${trx.category}] ${trx.description}` : trx.description,
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
 * 3. Laporan Arus Kas Manajemen Profesional (SAK EMKM / PSAK 2)
 */
export async function getCashFlowSummary(
  startDateInput: Date | string,
  endDateInput: Date | string
): Promise<CashFlowResult> {
  const { start: startDate, end: endDate, startStr, endStr } = normalizeDateRange(startDateInput, endDateInput);

  // Jalankan query agregasi paralel langsung di tingkat database
  const [openingStats, assignedAggregates, unassignedAggregates, allAccounts] = await Promise.all([
    // 1. Saldo kas awal sebelum startDate
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        date: { lt: startDate },
      },
      _sum: { amount: true },
    }),
    // 2. Agregasi transaksi dengan accountId dalam periode
    prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: { not: null },
      },
      _sum: { amount: true },
    }),
    // 3. Agregasi transaksi legacy tanpa accountId dalam periode
    prisma.transaction.groupBy({
      by: ['category', 'type'],
      where: {
        date: { gte: startDate, lte: endDate },
        accountId: null,
      },
      _sum: { amount: true },
    }),
    // 4. Master akun untuk resolusi metadata pos
    prisma.account.findMany({
      select: { id: true, code: true, name: true, category: true },
    }),
  ]);

  let priorIncomeSum = 0;
  let priorExpenseSum = 0;
  for (const item of openingStats) {
    const sum = toNum(item._sum.amount);
    if (item.type === 'PEMASUKAN') priorIncomeSum += sum;
    if (item.type === 'PENGELUARAN') priorExpenseSum += sum;
  }
  const openingCashBalance = priorIncomeSum - priorExpenseSum;

  const accountMap = new Map(allAccounts.map((a) => [a.id, a]));

  const opInflows: Record<string, CashFlowActivityItem> = {};
  const opOutflows: Record<string, CashFlowActivityItem> = {};
  const invInflows: Record<string, CashFlowActivityItem> = {};
  const invOutflows: Record<string, CashFlowActivityItem> = {};
  const finInflows: Record<string, CashFlowActivityItem> = {};
  const finOutflows: Record<string, CashFlowActivityItem> = {};

  const inflowMap: Record<string, number> = {};
  let totalCashInflow = 0;
  const outflowMap: Record<string, number> = {};
  let totalCashOutflow = 0;

  // 1. Proses transaksi yang memiliki accountId
  for (const item of assignedAggregates) {
    if (!item.accountId) continue;
    const acc = accountMap.get(item.accountId);
    const amt = toNum(item._sum.amount);
    const code = acc?.code || (item.type === 'PEMASUKAN' ? '4001' : '5001');
    const name = acc?.name || (item.type === 'PEMASUKAN' ? 'Pendapatan Usaha' : 'Beban Operasional');
    const cat = acc?.category;

    if (item.type === 'PEMASUKAN') {
      inflowMap[name] = (inflowMap[name] || 0) + amt;
      totalCashInflow += amt;

      const isFinancing =
        cat === AccountCategory.MODAL ||
        code.startsWith('3') ||
        cat === AccountCategory.KEWAJIBAN ||
        code.startsWith('2') ||
        name.toLowerCase().includes('pinjaman') ||
        name.toLowerCase().includes('utang') ||
        name.toLowerCase().includes('hutang');

      const isInvestingInflow =
        code.startsWith('12') ||
        code === '1201' ||
        name.toLowerCase().includes('peralatan') ||
        name.toLowerCase().includes('mesin') ||
        name.toLowerCase().includes('inventaris');

      if (isFinancing) {
        finInflows[code] = { code, name, amount: (finInflows[code]?.amount || 0) + amt };
      } else if (isInvestingInflow) {
        invInflows[code] = { code, name, amount: (invInflows[code]?.amount || 0) + amt };
      } else {
        opInflows[code] = { code, name, amount: (opInflows[code]?.amount || 0) + amt };
      }
    } else {
      outflowMap[name] = (outflowMap[name] || 0) + amt;
      totalCashOutflow += amt;

      const isFinancingOutflow =
        cat === AccountCategory.MODAL ||
        code.startsWith('3') ||
        (cat === AccountCategory.KEWAJIBAN && (code === '2002' || code.startsWith('22') || name.toLowerCase().includes('pinjaman')));

      if (isFinancingOutflow) {
        finOutflows[code] = { code, name, amount: (finOutflows[code]?.amount || 0) + amt };
      } else if (
        code.startsWith('12') ||
        code === '1201' ||
        name.toLowerCase().includes('peralatan') ||
        name.toLowerCase().includes('mesin') ||
        name.toLowerCase().includes('inventaris') ||
        name.toLowerCase().includes('kendaraan')
      ) {
        invOutflows[code] = { code, name, amount: (invOutflows[code]?.amount || 0) + amt };
      } else {
        opOutflows[code] = { code, name, amount: (opOutflows[code]?.amount || 0) + amt };
      }
    }
  }

  // 2. Proses transaksi unassigned / legacy
  for (const item of unassignedAggregates) {
    const amt = toNum(item._sum.amount);
    const catLower = (item.category || '').toLowerCase().trim();

    const matched = allAccounts.find((a) => {
      const accLower = a.name.toLowerCase();
      return (
        accLower === catLower ||
        accLower.includes(catLower) ||
        catLower.includes(accLower) ||
        (catLower.includes('catering') && (a.code === '4001' || a.code === '401')) ||
        (catLower.includes('bahan baku') && (a.code === '5001' || a.code === '501')) ||
        (catLower.includes('operasional') && (a.code === '5007' || a.code === '5006'))
      );
    });

    const code = matched?.code || (item.type === 'PEMASUKAN' ? '4001' : '5006');
    const name = matched?.name || item.category || (item.type === 'PEMASUKAN' ? 'Pendapatan Lain-lain' : 'Beban Operasional Lain');
    const cat = matched?.category;

    if (item.type === 'PEMASUKAN') {
      inflowMap[name] = (inflowMap[name] || 0) + amt;
      totalCashInflow += amt;

      const isFinancing =
        cat === AccountCategory.MODAL ||
        code.startsWith('3') ||
        cat === AccountCategory.KEWAJIBAN ||
        code.startsWith('2') ||
        name.toLowerCase().includes('pinjaman') ||
        name.toLowerCase().includes('utang');

      const isInvestingInflow =
        code.startsWith('12') ||
        code === '1201' ||
        name.toLowerCase().includes('peralatan') ||
        name.toLowerCase().includes('mesin') ||
        name.toLowerCase().includes('inventaris');

      if (isFinancing) {
        finInflows[code] = { code, name, amount: (finInflows[code]?.amount || 0) + amt };
      } else if (isInvestingInflow) {
        invInflows[code] = { code, name, amount: (invInflows[code]?.amount || 0) + amt };
      } else {
        opInflows[code] = { code, name, amount: (opInflows[code]?.amount || 0) + amt };
      }
    } else {
      outflowMap[name] = (outflowMap[name] || 0) + amt;
      totalCashOutflow += amt;

      const isFinancingOutflow =
        cat === AccountCategory.MODAL ||
        code.startsWith('3') ||
        (cat === AccountCategory.KEWAJIBAN && (code === '2002' || code.startsWith('22') || name.toLowerCase().includes('pinjaman')));

      if (isFinancingOutflow) {
        finOutflows[code] = { code, name, amount: (finOutflows[code]?.amount || 0) + amt };
      } else if (
        code.startsWith('12') ||
        code === '1201' ||
        name.toLowerCase().includes('peralatan') ||
        name.toLowerCase().includes('inventaris')
      ) {
        invOutflows[code] = { code, name, amount: (invOutflows[code]?.amount || 0) + amt };
      } else {
        opOutflows[code] = { code, name, amount: (opOutflows[code]?.amount || 0) + amt };
      }
    }
  }

  const opInList = Object.values(opInflows);
  const opOutList = Object.values(opOutflows);
  const totOpIn = opInList.reduce((acc, curr) => acc + curr.amount, 0);
  const totOpOut = opOutList.reduce((acc, curr) => acc + curr.amount, 0);
  const netOp = totOpIn - totOpOut;

  const invInList = Object.values(invInflows);
  const invOutList = Object.values(invOutflows);
  const totInvIn = invInList.reduce((acc, curr) => acc + curr.amount, 0);
  const totInvOut = invOutList.reduce((acc, curr) => acc + curr.amount, 0);
  const netInv = totInvIn - totInvOut;

  const finInList = Object.values(finInflows);
  const finOutList = Object.values(finOutflows);
  const totFinIn = finInList.reduce((acc, curr) => acc + curr.amount, 0);
  const totFinOut = finOutList.reduce((acc, curr) => acc + curr.amount, 0);
  const netFin = totFinIn - totFinOut;

  const netCashFlow = netOp + netInv + netFin;
  const closingCashBalance = openingCashBalance + netCashFlow;

  const inflowBreakdown = Object.entries(inflowMap).map(([name, amount]) => ({
    name,
    amount,
  }));

  const outflowBreakdown = Object.entries(outflowMap).map(([name, amount]) => ({
    name,
    amount,
  }));

  return {
    period: {
      startDate: startStr,
      endDate: endStr,
    },
    operatingActivities: {
      title: 'A. Arus Kas dari Aktivitas Operasi',
      inflows: opInList,
      totalInflow: totOpIn,
      outflows: opOutList,
      totalOutflow: totOpOut,
      netAmount: netOp,
    },
    investingActivities: {
      title: 'B. Arus Kas dari Aktivitas Investasi',
      inflows: invInList,
      totalInflow: totInvIn,
      outflows: invOutList,
      totalOutflow: totInvOut,
      netAmount: netInv,
    },
    financingActivities: {
      title: 'C. Arus Kas dari Aktivitas Pendanaan',
      inflows: finInList,
      totalInflow: totFinIn,
      outflows: finOutList,
      totalOutflow: totFinOut,
      netAmount: netFin,
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
 * 4. Laporan Posisi Keuangan (Neraca Standar SAK EMKM)
 */
export async function getBalanceSheet(asOfDateInput: Date | string): Promise<BalanceSheetResult> {
  const cutoffDate = new Date(asOfDateInput);
  cutoffDate.setHours(23, 59, 59, 999);

  // 1. Total Seluruh Kas Masuk & Keluar hingga cutoffDate
  const allTimeTotals = await prisma.transaction.groupBy({
    by: ['type'],
    where: {
      date: { lte: cutoffDate },
    },
    _sum: { amount: true },
  });

  // 2. Agregasi Saldo per Akun Terdaftar
  const assignedAggregates = await prisma.transaction.groupBy({
    by: ['accountId', 'type'],
    where: {
      date: { lte: cutoffDate },
      accountId: { not: null },
    },
    _sum: { amount: true },
  });

  // 3. Agregasi Saldo Transaksi Legacy Tanpa AccountId
  const unassignedAggregates = await prisma.transaction.groupBy({
    by: ['category', 'type'],
    where: {
      date: { lte: cutoffDate },
      accountId: null,
    },
    _sum: { amount: true },
  });

  // 4. Master Bagan Akun
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
    },
    orderBy: { code: 'asc' },
  });

  // Hitung Posisi Kas Riil
  let totalCashIn = 0;
  let totalCashOut = 0;
  for (const item of allTimeTotals) {
    const sum = Number(item._sum.amount || 0);
    if (item.type === 'PEMASUKAN') totalCashIn += sum;
    if (item.type === 'PENGELUARAN') totalCashOut += sum;
  }
  const netCashBalance = totalCashIn - totalCashOut;

  // Akumulasi Pendapatan & Beban Historis
  let totalRevenue = 0;
  let totalExpenses = 0;
  const accountBalances: Record<string, number> = {};

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  for (const acc of accounts) {
    accountBalances[acc.code] = 0;
  }

  for (const item of assignedAggregates) {
    if (!item.accountId) continue;
    const acc = accountMap.get(item.accountId);
    if (!acc) continue;

    const amt = Number(item._sum.amount || 0);
    const code = acc.code;

    if (code.startsWith('4') || acc.category === AccountCategory.PENDAPATAN) {
      if (item.type === 'PEMASUKAN') totalRevenue += amt;
      else totalRevenue -= amt;
    } else if (
      code.startsWith('5') ||
      code.startsWith('6') ||
      acc.category === AccountCategory.BEBAN_OPERASIONAL ||
      acc.category === AccountCategory.BEBAN_NON_OPERASIONAL
    ) {
      if (item.type === 'PENGELUARAN') totalExpenses += amt;
      else totalExpenses -= amt;
    }

    // Mutasi saldo posisi neraca per kategori akun
    if (acc.category === AccountCategory.ASET) {
      // Untuk aset non-kas (1003 Piutang, 1004 Persediaan, 1005 Perlengkapan, 1201 Aset Tetap):
      // Belanja Aset (PENGELUARAN) = Bertambah (+), Pelunasan Piutang/Jual (PEMASUKAN) = Berkurang (-)
      if (item.type === 'PENGELUARAN') {
        accountBalances[code] = (accountBalances[code] || 0) + amt;
      } else {
        accountBalances[code] = (accountBalances[code] || 0) - amt;
      }
    } else if (acc.category === AccountCategory.KEWAJIBAN || acc.category === AccountCategory.MODAL) {
      // Kewajiban & Modal: Uang Masuk = Bertambah (+), Uang Keluar = Berkurang (-)
      if (item.type === 'PEMASUKAN') {
        accountBalances[code] = (accountBalances[code] || 0) + amt;
      } else {
        accountBalances[code] = (accountBalances[code] || 0) - amt;
      }
    } else {
      if (item.type === 'PEMASUKAN') {
        accountBalances[code] = (accountBalances[code] || 0) + amt;
      } else {
        accountBalances[code] = (accountBalances[code] || 0) - amt;
      }
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
        (catLower.includes('catering') && (a.code === '4001' || a.code === '401')) ||
        (catLower.includes('bahan baku') && (a.code === '5001' || a.code === '501')) ||
        ((catLower.includes('perlengkapan') || catLower.includes('kemasan') || catLower.includes('box') || catLower.includes('plastik')) && (a.code === '5002' || a.code === '503')) ||
        ((catLower.includes('tenaga kerja') || catLower.includes('upah') || catLower.includes('gaji')) && (a.code === '5003' || a.code === '502')) ||
        ((catLower.includes('pemeliharaan') || catLower.includes('servis') || catLower.includes('perbaikan')) && a.code === '5004') ||
        ((catLower.includes('transportasi') || catLower.includes('bensin') || catLower.includes('pengantaran')) && (a.code === '5005' || a.code === '504')) ||
        ((catLower.includes('gas') || catLower.includes('listrik') || catLower.includes('air') || catLower.includes('elpiji')) && (a.code === '5006' || a.code === '505')) ||
        (catLower.includes('operasional') && (a.code === '5007' || a.code === '5006' || a.code === '506')) ||
        ((catLower.includes('utang') || catLower.includes('hutang') || catLower.includes('pinjaman')) && (a.category === AccountCategory.KEWAJIBAN || a.code.startsWith('2')))
      );
    });

    if (matched) {
      const code = matched.code;
      if (code.startsWith('4') || matched.category === AccountCategory.PENDAPATAN) {
        if (item.type === 'PEMASUKAN') totalRevenue += amt;
        else totalRevenue -= amt;
      } else if (
        code.startsWith('5') ||
        code.startsWith('6') ||
        matched.category === AccountCategory.BEBAN_OPERASIONAL ||
        matched.category === AccountCategory.BEBAN_NON_OPERASIONAL
      ) {
        if (item.type === 'PENGELUARAN') totalExpenses += amt;
        else totalExpenses -= amt;
      }

      if (matched.category === AccountCategory.ASET) {
        if (item.type === 'PENGELUARAN') {
          accountBalances[code] = (accountBalances[code] || 0) + amt;
        } else {
          accountBalances[code] = (accountBalances[code] || 0) - amt;
        }
      } else if (matched.category === AccountCategory.KEWAJIBAN || matched.category === AccountCategory.MODAL) {
        if (item.type === 'PEMASUKAN') {
          accountBalances[code] = (accountBalances[code] || 0) + amt;
        } else {
          accountBalances[code] = (accountBalances[code] || 0) - amt;
        }
      } else {
        if (item.type === 'PEMASUKAN') {
          accountBalances[code] = (accountBalances[code] || 0) + amt;
        } else {
          accountBalances[code] = (accountBalances[code] || 0) - amt;
        }
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

  // 1. ASET LANCAR vs ASET TETAP
  const isFixedAsset = (acc: (typeof accounts)[0]) =>
    acc.code.startsWith('12') ||
    acc.name.toLowerCase().includes('peralatan') ||
    acc.name.toLowerCase().includes('mesin') ||
    acc.name.toLowerCase().includes('inventaris') ||
    acc.name.toLowerCase().includes('kendaraan');

  const currentAssetAccounts = accounts.filter(
    (a) => a.category === AccountCategory.ASET && !isFixedAsset(a)
  );

  const currentAssetItems: BalanceSheetItem[] = [];

  const kasAccount = currentAssetAccounts.find(
    (a) => a.code === '1001' || a.code === '101' || a.name.toLowerCase().includes('kas')
  );

  currentAssetItems.push({
    id: kasAccount?.id,
    code: kasAccount?.code || '1001',
    name: kasAccount?.name || 'Kas Tunai',
    amount: Math.max(0, netCashBalance),
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

  // 2. ASET TETAP
  const fixedAssetAccounts = accounts.filter(
    (a) => a.category === AccountCategory.ASET && isFixedAsset(a)
  );

  const fixedAssetItems: BalanceSheetItem[] = [];
  for (const acc of fixedAssetAccounts) {
    const isAccumulatedDepreciation = acc.code === '1209' || acc.name.toLowerCase().includes('akumulasi');
    const rawVal = accountBalances[acc.code] || 0;
    const finalAmount = isAccumulatedDepreciation ? -Math.abs(rawVal) : Math.abs(rawVal);

    if (finalAmount !== 0 || acc.code === '1005') {
      fixedAssetItems.push({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        amount: finalAmount,
      });
    }
  }

  const totalFixedAssets = fixedAssetItems.reduce((sum, item) => sum + item.amount, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;

  // 3. KEWAJIBAN (LIABILITAS)
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

  // 4. EKUITAS (MODAL)
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
  startDateInput: Date | string,
  endDateInput: Date | string
): Promise<EquityStatementResult> {
  const { start: startDate, end: endDate } = normalizeDateRange(startDateInput, endDateInput);

  // 1. Ambil Laba Rugi Periode Berjalan
  const incomeStatement = await getIncomeStatement(startDate, endDate);
  const netIncome = incomeStatement.netIncome;

  // 2. Ambil Transaksi Modal Historis (Sebelum startDate untuk Saldo Awal) & Periode Berjalan
  const [priorCapitalAgg, periodCapitalTrx, priorIncomeAgg, priorExpenseAgg] = await Promise.all([
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
    // Pendapatan historis sebelum startDate
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        OR: [
          { account: { category: AccountCategory.PENDAPATAN } },
          { account: null, type: 'PEMASUKAN' },
        ],
        date: { lt: startDate },
      },
      _sum: { amount: true },
    }),
    // Beban historis sebelum startDate
    prisma.transaction.groupBy({
      by: ['type'],
      where: {
        OR: [
          { account: { category: { in: [AccountCategory.BEBAN_OPERASIONAL, AccountCategory.BEBAN_NON_OPERASIONAL] } } },
          { account: null, type: 'PENGELUARAN' },
        ],
        date: { lt: startDate },
      },
      _sum: { amount: true },
    }),
  ]);

  let priorCapitalSum = 0;
  for (const item of priorCapitalAgg) {
    const amt = Number(item._sum.amount || 0);
    priorCapitalSum += item.type === 'PEMASUKAN' ? amt : -amt;
  }

  let priorRevenue = 0;
  for (const item of priorIncomeAgg) {
    const amt = Number(item._sum.amount || 0);
    if (item.type === 'PEMASUKAN') priorRevenue += amt;
    else priorRevenue -= amt;
  }

  let priorExpense = 0;
  for (const item of priorExpenseAgg) {
    const amt = Number(item._sum.amount || 0);
    if (item.type === 'PENGELUARAN') priorExpense += amt;
    else priorExpense -= amt;
  }

  const priorRetainedEarnings = priorRevenue - priorExpense;
  const beginningCapital = priorCapitalSum + priorRetainedEarnings;

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
    retainedEarnings: priorRetainedEarnings,
  };
}

