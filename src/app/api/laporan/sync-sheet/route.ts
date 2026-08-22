import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { syncMonthlyFinancialReportToSheet, syncBalanceSheetToSheet } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { year, month } = body;

    const [monthlyResult, balanceSheetResult] = await Promise.all([
      syncMonthlyFinancialReportToSheet(
        typeof year === 'number' ? year : undefined,
        typeof month === 'number' ? month : undefined
      ),
      syncBalanceSheetToSheet(
        typeof year === 'number' && typeof month === 'number'
          ? new Date(year, month + 1, 0)
          : undefined
      ),
    ]);

    if (monthlyResult.success || balanceSheetResult.success) {
      return NextResponse.json({
        message: 'Laporan Bulanan & Neraca Keuangan berhasil disinkronkan ke Google Sheets',
      });
    } else {
      return NextResponse.json(
        { error: 'Gagal menyinkronkan laporan ke Google Sheets. Periksa koneksi atau kredensial.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in sync-sheet API:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyinkronkan laporan ke Google Sheets' },
      { status: 500 }
    );
  }
}
