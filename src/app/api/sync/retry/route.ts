import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { retryPendingSync, ensureSheetHeaders } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    // Pastikan header spreadsheet ada
    await ensureSheetHeaders();

    // Jalankan retry sync
    const result = await retryPendingSync();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error during manual sync retry:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal melakukan sinkronisasi ulang ke Google Sheets',
      },
      { status: 500 }
    );
  }
}
