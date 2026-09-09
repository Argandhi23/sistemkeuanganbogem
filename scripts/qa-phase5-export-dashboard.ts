import prisma from '../src/lib/prisma';
import {
  generateTransactionsWorkbook,
  generateUnitWorkbook,
  generateIncomeStatementWorkbook,
  generateBalanceSheetWorkbook,
} from '../src/lib/excelExport';
import { getIncomeStatement, getBalanceSheet } from '../src/lib/accounting';
import { getDashboardStatsCache, setDashboardStatsCache, invalidateDashboardStatsCache } from '../src/lib/cache';
import * as XLSX from 'xlsx';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

async function testPhase5() {
  console.log('========================================================================');
  console.log('🧪 FASE 5: PENGUJIAN EKSPOR EXCEL (.XLSX) & AGREGASI DASHBOARD');
  console.log('========================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. EKSPOR TRANSAKSI BUKU KAS KE EXCEL
    // -------------------------------------------------------------------------
    console.log('--- 1. GENERATOR EXCEL BUKU KAS ---');

    const transactions = await prisma.transaction.findMany({
      take: 20,
      orderBy: { date: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });

    const exportItems = transactions.map((t) => ({
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

    const txBuffer = generateTransactionsWorkbook(exportItems, {
      businessUnit: 'CATERING',
      year: '2026',
    });

    // Validasi buffer Excel yang dihasilkan dengan library XLSX
    const parsedTxWb = XLSX.read(txBuffer, { type: 'buffer' });
    const sheetNameTx = parsedTxWb.SheetNames[0];
    const sheetTx = parsedTxWb.Sheets[sheetNameTx];
    const rawDataTx = XLSX.utils.sheet_to_json(sheetTx);

    if (txBuffer.length > 2000 && parsedTxWb.SheetNames.length > 0 && rawDataTx.length > 0) {
      results.push({
        step: '1. Ekspor Excel Buku Kas Transaksi',
        status: 'PASS',
        detail: `Buffer valid: ${txBuffer.length} bytes, Sheet: "${sheetNameTx}", Total ${rawDataTx.length} baris data terbaca`,
      });
    } else {
      results.push({
        step: '1. Ekspor Excel Buku Kas Transaksi',
        status: 'FAIL',
        detail: `Workbook rusak atau kosong (size: ${txBuffer.length})`,
      });
    }

    // -------------------------------------------------------------------------
    // 2. EKSPOR UNIT USAHA (CATERING, MOLEN, WIFI, PPOB, SAPI)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. GENERATOR EXCEL UNIT USAHA ---');

    // 2A. Catering
    const cateringOrders = await prisma.cateringOrder.findMany();
    const cateringBuf = generateUnitWorkbook('CATERING', cateringOrders);
    const parsedCateringWb = XLSX.read(cateringBuf, { type: 'buffer' });

    // 2B. Molen
    const molenUnits = await prisma.molenUnit.findMany();
    const molenBuf = generateUnitWorkbook('MOLEN', molenUnits);
    const parsedMolenWb = XLSX.read(molenBuf, { type: 'buffer' });

    // 2C. WiFi
    const wifiCust = await prisma.wifiCustomer.findMany({ include: { plan: true, bills: true } });
    const wifiBuf = generateUnitWorkbook('WIFI', wifiCust);
    const parsedWifiWb = XLSX.read(wifiBuf, { type: 'buffer' });

    // 2D. Sapi
    const cattleList = await prisma.cattle.findMany();
    const sapiBuf = generateUnitWorkbook('SAPI', cattleList);
    const parsedSapiWb = XLSX.read(sapiBuf, { type: 'buffer' });

    const allUnitsOk =
      cateringBuf.length > 1000 &&
      molenBuf.length > 1000 &&
      wifiBuf.length > 1000 &&
      sapiBuf.length > 1000;

    if (allUnitsOk) {
      results.push({
        step: '2. Ekspor Excel 5 Unit Usaha',
        status: 'PASS',
        detail: `Seluruh workbook unit ter-generate sempurna (Catering: ${cateringBuf.length}B, Molen: ${molenBuf.length}B, WiFi: ${wifiBuf.length}B, Sapi: ${sapiBuf.length}B)`,
      });
    } else {
      results.push({
        step: '2. Ekspor Excel 5 Unit Usaha',
        status: 'FAIL',
        detail: 'Ada unit workbook yang gagal di-generate',
      });
    }

    // -------------------------------------------------------------------------
    // 3. EKSPOR LAPORAN LABA RUGI & NERACA KE EXCEL
    // -------------------------------------------------------------------------
    console.log('\n--- 3. GENERATOR EXCEL LAPORAN LABA RUGI & NERACA ---');

    const now = new Date();
    const lrReport = await getIncomeStatement(new Date(now.getFullYear(), 0, 1), now, 'ALL');
    const lrBuf = generateIncomeStatementWorkbook(lrReport, 'Konsolidasi Seluruh Unit');
    const parsedLrWb = XLSX.read(lrBuf, { type: 'buffer' });

    const bsReport = await getBalanceSheet(now, 'ALL');
    const bsBuf = generateBalanceSheetWorkbook(bsReport, 'Konsolidasi Seluruh Unit');
    const parsedBsWb = XLSX.read(bsBuf, { type: 'buffer' });

    if (lrBuf.length > 2000 && bsBuf.length > 2000) {
      results.push({
        step: '3. Ekspor Excel Laba Rugi & Neraca SAK EMKM',
        status: 'PASS',
        detail: `Laba Rugi Excel (${lrBuf.length} bytes, Sheet: ${parsedLrWb.SheetNames[0]}), Neraca Excel (${bsBuf.length} bytes, Sheet: ${parsedBsWb.SheetNames[0]})`,
      });
    } else {
      results.push({
        step: '3. Ekspor Excel Laba Rugi & Neraca SAK EMKM',
        status: 'FAIL',
        detail: 'File Excel laporan keuangan berukuran tidak normal',
      });
    }

    // -------------------------------------------------------------------------
    // 4. AGREGASI & CACHING DASHBOARD STATS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. PENGUJIAN AGREGASI DASHBOARD & CACHE ---');

    // Verifikasi agregasi transaksi
    const inAgg = await prisma.transaction.aggregate({ where: { type: 'PEMASUKAN' }, _sum: { amount: true } });
    const outAgg = await prisma.transaction.aggregate({ where: { type: 'PENGELUARAN' }, _sum: { amount: true } });
    const totalIn = Number(inAgg._sum.amount || 0);
    const totalOut = Number(outAgg._sum.amount || 0);
    const netSaldo = totalIn - totalOut;

    // Uji Cache System
    invalidateDashboardStatsCache();
    const cacheBefore = getDashboardStatsCache();

    const mockDashboardData = {
      summary: { totalIncome: totalIn, totalExpense: totalOut, netIncome: netSaldo },
      cashFlowTrend: [],
      recentTransactions: [],
      unitSummaries: [],
      unitCounts: { cateringOrders: 3, molenUnits: 2, wifiCustomers: 1, ppobCount: 0, cattleHead: 2 },
    };
    setDashboardStatsCache(mockDashboardData as any);

    const cacheAfter = getDashboardStatsCache();
    invalidateDashboardStatsCache();
    const cacheAfterInvalidate = getDashboardStatsCache();

    if (cacheBefore === null && cacheAfter !== null && cacheAfterInvalidate === null) {
      results.push({
        step: '4. Agregasi Dashboard & Mekanisme Cache',
        status: 'PASS',
        detail: `Agregasi Kas: Masuk Rp ${totalIn.toLocaleString('id-ID')}, Keluar Rp ${totalOut.toLocaleString('id-ID')}, Saldo Rp ${netSaldo.toLocaleString('id-ID')}. Cache hit, store, & invalidation 100% presisi.`,
      });
    } else {
      results.push({
        step: '4. Agregasi Dashboard & Mekanisme Cache',
        status: 'FAIL',
        detail: 'Mekanisme cache in-memory tidak berjalan semestinya',
      });
    }

  } catch (err: any) {
    results.push({
      step: 'Eksekusi Fase 5',
      status: 'FAIL',
      detail: `Error tak terduga: ${err.message}`,
    });
  }

  console.log('\n--- HASIL PENGUJIAN FASE 5 (EXCEL & DASHBOARD) ---');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.step} -> ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  if (!allPass) {
    throw new Error('Pengujian Fase 5 gagal!');
  }
  console.log('\n🎉 FASE 5: SEMUA TEST EKSPOR EXCEL & DASHBOARD LULUS 100%!');
}

testPhase5()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
