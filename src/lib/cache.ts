export let cachedStats: { data: unknown; timestamp: number } | null = null;
export const STATS_CACHE_MS = 10 * 1000;

export function invalidateDashboardStatsCache() {
  cachedStats = null;
}

export function setDashboardStatsCache(data: unknown) {
  cachedStats = { data, timestamp: Date.now() };
}

export function getDashboardStatsCache() {
  if (cachedStats && Date.now() - cachedStats.timestamp < STATS_CACHE_MS) {
    return cachedStats.data;
  }
  return null;
}

export let cachedAccounts: { data: unknown; timestamp: number } | null = null;
export const ACCOUNTS_CACHE_MS = 30 * 1000;

export function invalidateAccountsCache() {
  cachedAccounts = null;
}

export function setAccountsCache(data: unknown) {
  cachedAccounts = { data, timestamp: Date.now() };
}

export function getAccountsCache() {
  if (cachedAccounts && Date.now() - cachedAccounts.timestamp < ACCOUNTS_CACHE_MS) {
    return cachedAccounts.data;
  }
  return null;
}
