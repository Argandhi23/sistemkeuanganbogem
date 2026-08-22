import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { getGeneralLedger } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!accountId) {
      return NextResponse.json({ error: 'Pilih akun yang ingin ditampilkan' }, { status: 400 });
    }

    const now = new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getFullYear(), 0, 1); // Default awal tahun

    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    if (endDateParam) {
      endDate.setHours(23, 59, 59, 999);
    }

    const report = await getGeneralLedger(accountId, startDate, endDate);
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error('Error in buku-besar API:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyusun Buku Besar' },
      { status: 500 }
    );
  }
}
