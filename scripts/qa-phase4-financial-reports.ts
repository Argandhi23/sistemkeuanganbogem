import prisma from '../src/lib/prisma';
import { BusinessUnit } from '@prisma/client';
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowSummary,
  getEquityStatement,
  getGeneralLedger,
} from '../src/lib/accounting';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

async function testPhase4() {
  console.log('========================================================================');
  console.log('🧪 FASE 4: PENGUJIAN LAPORAN KEUANGAN STANDAR SAK EMKM & KONSOLIDASI');
  console.log('========================================================================\n');

  try {
    const now = new Date();
    const startDate2025 = new Date(2025, 0, 1);
    const endDate2025 = new Date(2025, 11, 31, 23, 59, 59, 999);
    const startDate2026 = new Date(2026, 0, 1);
    const endDate2026 = new Date(2026, 11, 31, 23, 59, 59, 999);

    // -------------------------------------------------------------------------
    // 1. LAPORAN LABA RUGI (INCOME STATEMENT)
    // -------------------------------------------------------------------------
    console.log('--- 1. LAPORAN LABA RUGI (SAK EMKM) ---');

    // 1A. Laba Rugi Catering 2025
    const lrCatering2025 = await getIncomeStatement(startDate2025, endDate2025, BusinessUnit.CATERING);
    const calcGrossProfit2025 = lrCatering2025.revenue.total - lrCatering2025.operatingExpenses.total;
    const calcNetIncome2025 = calcGrossProfit2025 - lrCatering2025.nonOperatingExpenses.total;

    if (
      lrCatering2025.grossOperatingProfit === calcGrossProfit2025 &&
      lrCatering2025.netIncome === calcNetIncome2025
    ) {
      results.push({
        step: '1A. Laba Rugi Catering 2025 (Integritas Matematika)',
        status: 'PASS',
        detail: `Pendapatan: Rp ${lrCatering2025.revenue.total.toLocaleString('id-ID')}, Beban Operasional: Rp ${lrCatering2025.operatingExpenses.total.toLocaleString('id-ID')}, Laba Bersih: Rp ${lrCatering2025.netIncome.toLocaleString('id-ID')}`,
      });
    } else {
      results.push({
        step: '1A. Laba Rugi Catering 2025 (Integritas Matematika)',
        status: 'FAIL',
        detail: `Gross/Net Income tidak cocok: calc ${calcNetIncome2025} vs report ${lrCatering2025.netIncome}`,
      });
    }

    // 1B. Laba Rugi Konsolidasi Seluruh Unit 2026
    const lrAll2026 = await getIncomeStatement(startDate2026, endDate2026, 'ALL');
    const calcNetAll2026 =
      lrAll2026.revenue.total - lrAll2026.operatingExpenses.total - lrAll2026.nonOperatingExpenses.total;

    if (lrAll2026.netIncome === calcNetAll2026) {
      results.push({
        step: '1B. Laba Rugi Konsolidasi 2026 (Seluruh Unit)',
        status: 'PASS',
        detail: `Pendapatan Konsolidasi: Rp ${lrAll2026.revenue.total.toLocaleString('id-ID')}, Beban: Rp ${lrAll2026.operatingExpenses.total.toLocaleString('id-ID')}, Laba Bersih: Rp ${lrAll2026.netIncome.toLocaleString('id-ID')}`,
      });
    } else {
      results.push({
        step: '1B. Laba Rugi Konsolidasi 2026 (Seluruh Unit)',
        status: 'FAIL',
        detail: 'Integritas formula Laba Rugi konsolidasi tidak valid',
      });
    }

    // -------------------------------------------------------------------------
    // 2. LAPORAN POSISI KEUANGAN / NERACA (BALANCE SHEET)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. LAPORAN NERACA (POSISI KEUANGAN SAK EMKM) ---');

    // 2A. Neraca Catering per 31 Desember 2025
    const neracaCatering2025 = await getBalanceSheet(endDate2025, BusinessUnit.CATERING);
    if (neracaCatering2025.isBalanced && neracaCatering2025.discrepancy === 0) {
      results.push({
        step: '2A. Neraca Catering per 31 Des 2025',
        status: 'PASS',
        detail: `Aset: Rp ${neracaCatering2025.assets.totalAssets.toLocaleString('id-ID')} == Pasiva: Rp ${neracaCatering2025.totalLiabilitiesAndEquity.toLocaleString('id-ID')} (SEIMBANG ✅)`,
      });
    } else {
      results.push({
        step: '2A. Neraca Catering per 31 Des 2025',
        status: 'FAIL',
        detail: `Neraca tidak seimbang! Selisih: Rp ${neracaCatering2025.discrepancy.toLocaleString('id-ID')}`,
      });
    }

    // 2B. Neraca Konsolidasi per Tanggal Berjalan (Hari Ini)
    const neracaAllNow = await getBalanceSheet(now, 'ALL');
    if (neracaAllNow.isBalanced && neracaAllNow.discrepancy === 0) {
      results.push({
        step: '2B. Neraca Konsolidasi Hari Ini (Seluruh Unit)',
        status: 'PASS',
        detail: `Total Aset: Rp ${neracaAllNow.assets.totalAssets.toLocaleString('id-ID')} == Total Pasiva: Rp ${neracaAllNow.totalLiabilitiesAndEquity.toLocaleString('id-ID')} (SEIMBANG ✅)`,
      });
    } else {
      results.push({
        step: '2B. Neraca Konsolidasi Hari Ini (Seluruh Unit)',
        status: 'FAIL',
        detail: `Neraca konsolidasi tidak seimbang! Selisih: Rp ${neracaAllNow.discrepancy.toLocaleString('id-ID')}`,
      });
    }

    // -------------------------------------------------------------------------
    // 3. LAPORAN ARUS KAS (CASH FLOW STATEMENT)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. LAPORAN ARUS KAS (CASH FLOW) ---');

    const cfAll2026 = await getCashFlowSummary(startDate2026, endDate2026, 'ALL');
    const calcEndCash = cfAll2026.openingCashBalance + cfAll2026.netCashFlow;
    // Toleransi pembulatan 1 rupiah untuk floating point
    const diffCash = Math.abs(cfAll2026.closingCashBalance - calcEndCash);

    if (diffCash <= 1) {
      results.push({
        step: '3. Rekap Arus Kas Konsolidasi 2026',
        status: 'PASS',
        detail: `Saldo Awal: Rp ${cfAll2026.openingCashBalance.toLocaleString('id-ID')}, Arus Kas Bersih: Rp ${cfAll2026.netCashFlow.toLocaleString('id-ID')}, Saldo Akhir: Rp ${cfAll2026.closingCashBalance.toLocaleString('id-ID')} (Tepat)`,
      });
    } else {
      results.push({
        step: '3. Rekap Arus Kas Konsolidasi 2026',
        status: 'FAIL',
        detail: `Saldo akhir kas tidak sesuai: calc ${calcEndCash} vs report ${cfAll2026.closingCashBalance}`,
      });
    }

    // -------------------------------------------------------------------------
    // 4. LAPORAN PERUBAHAN MODAL (EQUITY STATEMENT)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. LAPORAN PERUBAHAN MODAL ---');

    const eq2025 = await getEquityStatement(startDate2025, endDate2025, BusinessUnit.CATERING);
    const calcEndingCapital =
      eq2025.beginningCapital + eq2025.netIncome + eq2025.additionalCapital - eq2025.withdrawals;

    if (eq2025.endingCapital === calcEndingCapital) {
      results.push({
        step: '4. Laporan Perubahan Modal 2025',
        status: 'PASS',
        detail: `Modal Awal: Rp ${eq2025.beginningCapital.toLocaleString('id-ID')}, Laba Bersih: Rp ${eq2025.netIncome.toLocaleString('id-ID')}, Modal Akhir: Rp ${eq2025.endingCapital.toLocaleString('id-ID')}`,
      });
    } else {
      results.push({
        step: '4. Laporan Perubahan Modal 2025',
        status: 'FAIL',
        detail: `Modal akhir tidak konsisten: calc ${calcEndingCapital} vs report ${eq2025.endingCapital}`,
      });
    }

    // -------------------------------------------------------------------------
    // 5. BUKU BESAR (GENERAL LEDGER)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. BUKU BESAR (GENERAL LEDGER PER AKUN) ---');

    const accKas = await prisma.account.findUniqueOrThrow({ where: { code: '1001' } });
    const glKas = await getGeneralLedger(accKas.id, startDate2025, endDate2025);

    if (glKas.entries.length > 0 && glKas.account.code === '1001') {
      const lastEntry = glKas.entries[glKas.entries.length - 1];
      results.push({
        step: '5. Buku Besar Kas Tunai (1001)',
        status: 'PASS',
        detail: `Berhasil memuat ${glKas.entries.length} baris mutasi. Saldo Awal: Rp ${glKas.openingBalance.toLocaleString('id-ID')}, Saldo Akhir Buku: Rp ${glKas.closingBalance.toLocaleString('id-ID')}`,
      });
    } else {
      results.push({
        step: '5. Buku Besar Kas Tunai (1001)',
        status: 'FAIL',
        detail: 'Mutasi buku besar kosong atau akun salah',
      });
    }

  } catch (err: any) {
    results.push({
      step: 'Eksekusi Fase 4',
      status: 'FAIL',
      detail: `Error tak terduga: ${err.message}`,
    });
  }

  console.log('\n--- HASIL PENGUJIAN FASE 4 (LAPORAN KEUANGAN SAK EMKM) ---');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.step} -> ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  if (!allPass) {
    throw new Error('Pengujian Fase 4 gagal!');
  }
  console.log('\n🎉 FASE 4: SEMUA LAPORAN STANDAR SAK EMKM & KONSOLIDASI LULUS 100%!');
}

testPhase4()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
