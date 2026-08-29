import { Decimal } from '@prisma/client/runtime/library';

/**
 * Konversi aman dari Prisma Decimal / string / number ke number standar JavaScript.
 */
export function toNum(val: Decimal | number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const parsed = Number(val);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format angka ke format mata uang Rupiah standar (contoh: "1.250.000").
 */
export function formatRupiah(val: number | string | null | undefined): string {
  const num = toNum(val);
  return num.toLocaleString('id-ID');
}

/**
 * Helper untuk normalisasi rentang tanggal dengan memperhitungkan zona waktu Indonesia (WIB - UTC+7).
 */
export function normalizeDateRangeWIB(
  startDateInput: Date | string,
  endDateInput: Date | string
): { start: Date; end: Date; startStr: string; endStr: string } {
  let start: Date;
  let end: Date;

  if (typeof startDateInput === 'string') {
    // Jika format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDateInput)) {
      start = new Date(`${startDateInput}T00:00:00.000+07:00`);
    } else {
      start = new Date(startDateInput);
      start.setHours(0, 0, 0, 0);
    }
  } else {
    start = new Date(startDateInput);
    start.setHours(0, 0, 0, 0);
  }

  if (typeof endDateInput === 'string') {
    // Jika format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDateInput)) {
      end = new Date(`${endDateInput}T23:59:59.999+07:00`);
    } else {
      end = new Date(endDateInput);
      end.setHours(23, 59, 59, 999);
    }
  } else {
    end = new Date(endDateInput);
    end.setHours(23, 59, 59, 999);
  }

  // Format YYYY-MM-DD dalam zona waktu Indonesia (WIB UTC+7)
  const formatWIB = (d: Date) => {
    const wibMs = d.getTime() + 7 * 60 * 60 * 1000;
    return new Date(wibMs).toISOString().split('T')[0];
  };

  const startStr =
    typeof startDateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDateInput)
      ? startDateInput
      : formatWIB(start);

  const endStr =
    typeof endDateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDateInput)
      ? endDateInput
      : formatWIB(end);

  return { start, end, startStr, endStr };
}
