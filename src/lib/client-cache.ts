// Client-side in-memory cache for instant navigation (0ms perceived latency)

export interface DashboardDataCache {
  summary: {
    monthlyIncome: number;
    monthlyExpense: number;
    incomeGrowth?: number;
    expenseGrowth?: number;
    currentBalance: number;
    totalIncome: number;
    totalExpense: number;
  };
  recentTransactions?: Array<{
    id: string;
    type: 'PEMASUKAN' | 'PENGELUARAN';
    businessUnit?: string;
    description: string;
    amount: number | string;
    date: string;
    account?: { name: string; code: string };
    createdBy?: { name: string };
  }>;
  unitFinancials?: Array<{
    unit: 'CATERING' | 'RENTAL_MOLEN' | 'WIFI_DESA' | 'PPOB' | 'KETAHANAN_PANGAN' | 'UMUM';
    name: string;
    category: string;
    route: string;
    allTime: {
      income: number;
      expense: number;
      net: number;
      count: number;
    };
    thisMonth: {
      income: number;
      expense: number;
      net: number;
      count: number;
    };
    activeOrdersCount?: number;
  }>;
}

export let clientDashboardMemoryCache: DashboardDataCache | null = null;

export function setClientDashboardCache(data: DashboardDataCache) {
  clientDashboardMemoryCache = data;
}

export function getClientDashboardCache(): DashboardDataCache | null {
  return clientDashboardMemoryCache;
}

export function invalidateClientDashboardCache() {
  clientDashboardMemoryCache = null;
}
