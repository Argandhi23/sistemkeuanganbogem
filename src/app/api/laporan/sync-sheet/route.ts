import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { syncAllFinancialReportsToSheet } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { year, month, periodType } = body;

    const result = await syncAllFinancialReportsToSheet({
      year: typeof year === 'number' ? year : undefined,
      month: typeof month === 'number' ? month : undefined,
      periodType,
    });

    if (result.success) {
      return NextResponse.json({
        message: 'Seluruh lembar laporan (Laba Rugi, Neraca, Arus Kas, Perubahan Modal, dan Buku Besar Kas) berhasil disinkronkan ke Google Sheets!',
        details: result.details,
      });
    } else {
      return NextResponse.json(
        { error: 'Gagal menyinkronkan seluruh laporan ke Google Sheets. Periksa koneksi internet atau kredensial API.' },
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

