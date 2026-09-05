import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { getBalanceSheet } from '@/lib/accounting';
import { BusinessUnit } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const asOfDateParam = searchParams.get('asOfDate') || searchParams.get('endDate');
    const businessUnitParam = searchParams.get('businessUnit');

    const asOfDate = asOfDateParam
      ? new Date(asOfDateParam)
      : new Date();

    const report = await getBalanceSheet(asOfDate, (businessUnitParam as BusinessUnit | 'ALL') || undefined);
    return NextResponse.json({ data: report });
  } catch (error) {
    console.error('Error in neraca API:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyusun Laporan Neraca Standar' },
      { status: 500 }
    );
  }
}
