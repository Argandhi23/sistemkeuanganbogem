import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { getCashFlowSummary } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(now.getFullYear(), now.getMonth(), 1);

    const endDate = endDateParam
      ? new Date(endDateParam)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    if (endDateParam) {
      endDate.setHours(23, 59, 59, 999);
    }

    const report = await getCashFlowSummary(startDate, endDate);
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error('Error in arus-kas API:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyusun Rekap Arus Kas' },
      { status: 500 }
    );
  }
}
