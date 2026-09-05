/**
 * Modul ini sebelumnya digunakan untuk sinkronisasi otomatis ke Google Sheets.
 * Sekarang sistem telah beralih menggunakan fitur Export Excel (.xlsx) on-demand
 * yang jauh lebih cepat, andal, dan tidak bergantung pada kredensial eksternal.
 */

export function formatDateIndo(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatRupiahNumber(val: number | string): number {
  return Number(val) || 0;
}

export async function ensureSheetHeaders() {
  return { success: true };
}

export async function retryPendingSync() {
  return { success: true, message: 'Sinkronisasi telah dialihkan ke fitur Export Excel.' };
}

export async function syncAllFinancialReportsToSheet() {
  return { success: true, message: 'Laporan dapat diunduh via fitur Export Excel.' };
}

export async function syncMonthlyFinancialReportToSheet() {
  return { success: true, message: 'Laporan dapat diunduh via fitur Export Excel.' };
}

export async function compactPembukuanSheet() {
  return { success: true };
}

export async function appendTransactionRow() {
  return { success: true };
}

export async function updateTransactionRow() {
  return { success: true };
}

export async function clearTransactionRow() {
  return { success: true };
}

export function triggerDebouncedReportSync() {
  // No-op
}
