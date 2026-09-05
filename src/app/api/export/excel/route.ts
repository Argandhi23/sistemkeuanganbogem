import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { BusinessUnit, Prisma } from '@prisma/client';
import {
  generateTransactionsWorkbook,
  generateUnitWorkbook,
  generateIncomeStatementWorkbook,
  generateBalanceSheetWorkbook,
  TransactionExportItem,
} from '@/lib/excelExport';
import { getIncomeStatement, getBalanceSheet } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const exportType = searchParams.get('type') || 'transaksi';
    const businessUnit = searchParams.get('businessUnit') as BusinessUnit | null;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    let buffer: Buffer;
    let filename = `BUMDes_Bogem_${exportType}_${new Date().toISOString().split('T')[0]}.xlsx`;

    if (exportType === 'transaksi') {
      const where: Prisma.TransactionWhereInput = {};
      if (businessUnit && Object.values(BusinessUnit).includes(businessUnit)) {
        where.businessUnit = businessUnit;
      }

      if (year) {
        const y = parseInt(year);
        if (month) {
          const m = parseInt(month);
          where.date = {
            gte: new Date(y, m - 1, 1),
            lte: new Date(y, m, 0, 23, 59, 59, 999),
          };
        } else {
          where.date = {
            gte: new Date(y, 0, 1),
            lte: new Date(y, 11, 31, 23, 59, 59, 999),
          };
        }
      }

      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        include: {
          createdBy: { select: { name: true } },
        },
      });

      const exportItems: TransactionExportItem[] = transactions.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        category: t.category,
        businessUnit: t.businessUnit,
        paymentMethod: t.paymentMethod,
        description: t.description,
        amount: Number(t.amount),
        createdByName: t.createdBy?.name,
      }));

      buffer = generateTransactionsWorkbook(exportItems, {
        businessUnit: businessUnit || undefined,
        month: month || undefined,
        year: year || undefined,
      });
      filename = `Buku_Kas_BUMDes_${businessUnit || 'Semua'}_${year || 'Semua'}.xlsx`;
    } else if (exportType === 'catering') {
      const orders = await prisma.cateringOrder.findMany({
        orderBy: { eventDate: 'desc' },
      });
      buffer = generateUnitWorkbook('CATERING', orders);
      filename = `Rekap_Catering_BUMDes_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (exportType === 'molen') {
      const rentals = await prisma.molenRental.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          unit: { select: { code: true, name: true } },
        },
      });
      buffer = generateUnitWorkbook('MOLEN', rentals);
      filename = `Rekap_Sewa_Molen_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (exportType === 'wifi') {
      const now = new Date();
      const currentMonth = month ? parseInt(month) : now.getMonth() + 1;
      const currentYear = year ? parseInt(year) : now.getFullYear();

      const customers = await prisma.wifiCustomer.findMany({
        orderBy: { name: 'asc' },
        include: {
          plan: true,
          bills: {
            where: { month: currentMonth, year: currentYear },
            take: 1,
          },
        },
      });
      buffer = generateUnitWorkbook('WIFI', customers);
      filename = `Rekap_WiFi_Desa_${currentMonth}_${currentYear}.xlsx`;
    } else if (exportType === 'ppob') {
      const txs = await prisma.ppobTransaction.findMany({
        take: 500,
        orderBy: { date: 'desc' },
      });
      buffer = generateUnitWorkbook('PPOB', txs);
      filename = `Rekap_PPOB_Loket_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (exportType === 'sapi') {
      const cattle = await prisma.cattle.findMany({
        orderBy: { purchaseDate: 'desc' },
      });
      buffer = generateUnitWorkbook('SAPI', cattle);
      filename = `Rekap_Peternakan_Sapi_${new Date().toISOString().split('T')[0]}.xlsx`;
    } else if (exportType === 'laba-rugi') {
      const now = new Date();
      const y = year ? parseInt(year) : now.getFullYear();
      let startDate: Date;
      let endDate: Date;
      if (month) {
        const m = parseInt(month);
        startDate = new Date(y, m - 1, 1);
        endDate = new Date(y, m, 0, 23, 59, 59, 999);
      } else {
        startDate = new Date(y, 0, 1);
        endDate = new Date(y, 11, 31, 23, 59, 59, 999);
      }
      const report = await getIncomeStatement(startDate, endDate, businessUnit || undefined);
      const unitName = businessUnit ? String(businessUnit).replace(/_/g, ' ') : 'Konsolidasi Seluruh Unit';
      buffer = generateIncomeStatementWorkbook(report, unitName);
      filename = `Laba_Rugi_BUMDes_${businessUnit || 'Konsolidasi'}_${y}${month ? `_Bln_${month}` : ''}.xlsx`;
    } else if (exportType === 'neraca') {
      const asOfDate = new Date();
      if (year) {
        const y = parseInt(year);
        if (month) {
          const m = parseInt(month);
          asOfDate.setFullYear(y, m, 0);
        } else {
          asOfDate.setFullYear(y, 11, 31);
        }
      }
      asOfDate.setHours(23, 59, 59, 999);
      const report = await getBalanceSheet(asOfDate, businessUnit || undefined);
      const unitName = businessUnit ? String(businessUnit).replace(/_/g, ' ') : 'Konsolidasi Seluruh Unit';
      buffer = generateBalanceSheetWorkbook(report, unitName);
      filename = `Neraca_BUMDes_${businessUnit || 'Konsolidasi'}_${asOfDate.toISOString().split('T')[0]}.xlsx`;
    } else {
      return NextResponse.json({ error: 'Tipe ekspor tidak dikenali' }, { status: 400 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating excel export:', error);
    return NextResponse.json({ error: 'Gagal mengekspor file Excel' }, { status: 500 });
  }
}
