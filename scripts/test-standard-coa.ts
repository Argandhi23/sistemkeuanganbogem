import { PrismaClient, AccountCategory, TransactionType } from '@prisma/client';
import {
  getIncomeStatement,
  getCashFlowSummary,
  getBalanceSheet,
  getGeneralLedger,
  getEquityStatement,
} from '../src/lib/accounting';

const prisma = new PrismaClient();

async function runStandardCOATest() {
  console.log('====================================================');
  console.log('🧪 MEMULAI TEST STANDAR POS AKUN KEUANGAN (COA BUMDes)');
  console.log('====================================================\n');

  try {
    // 1. Verifikasi seluruh akun standar tersedia di database
    const requiredCodes = [
      '1001', '1002', '1003', '1004', '1005', '1201', '1209',
      '2001', '2002',
      '3001', '3002', '3003', '3004',
      '4001', '4002', '4003', '4004', '4101',
      '5001', '5002', '5003', '5004', '5005', '5006', '5007', '5008', '5009', '5010',
      '6001',
    ];

    const existingAccounts = await prisma.account.findMany({
      where: { code: { in: requiredCodes }, isActive: true },
    });

    const existingCodeSet = new Set(existingAccounts.map((a) => a.code));
    const missingCodes = requiredCodes.filter((c) => !existingCodeSet.has(c));

    console.log(`- Total Akun Standar Terdaftar: ${existingAccounts.length} dari ${requiredCodes.length} akun`);
    if (missingCodes.length > 0) {
      throw new Error(`❌ GAGAL: Akun berikut belum terdaftar di database: ${missingCodes.join(', ')}`);
    }
    console.log('✅ PASS: Seluruh 29 Pos Akun Standar SAK EMKM terdaftar & aktif.');

    // 2. Ambil user aktif untuk relasi audit
    const testUser = await prisma.user.findFirst({ where: { isActive: true } });
    if (!testUser) {
      throw new Error('Tidak ada user aktif ditemukan di database');
    }

    const testDate = new Date();
    const startDate = new Date(testDate.getFullYear(), testDate.getMonth(), 1);
    const endDate = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const accountMap = new Map(existingAccounts.map((a) => [a.code, a]));

    const accSewa = accountMap.get('4003')!;
    const accBunga = accountMap.get('4101')!;
    const accAset = accountMap.get('1201')!;
    const accModalDesa = accountMap.get('3003')!;
    const accPADes = accountMap.get('3004')!;

    // Baseline sebelum test
    const baseIncome = await getIncomeStatement(startDate, endDate);
    const baseEquity = await getEquityStatement(startDate, endDate);

    console.log('\n--- 1. TEST UANG MASUK: Sewa Alat (4003) & Bunga Bank (4101) ---');
    const trxSewa = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: accSewa.name,
        accountId: accSewa.id,
        description: '[TEST] Sewa 5 Set Pemanas Prasmanan & Meja',
        amount: 750000,
        date: testDate,
        createdById: testUser.id,
        syncedToSheet: true,
      },
    });

    const trxBunga = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: accBunga.name,
        accountId: accBunga.id,
        description: '[TEST] Bunga Jasa Giro Rekening Bank BUMDes',
        amount: 50000,
        date: testDate,
        createdById: testUser.id,
        syncedToSheet: true,
      },
    });

    const incomeAfterRevenue = await getIncomeStatement(startDate, endDate);
    const revDiff = incomeAfterRevenue.revenue.total - baseIncome.revenue.total;
    console.log(`- Total Pendapatan Bertambah: Rp ${revDiff.toLocaleString('id-ID')} (Harus Rp 800.000)`);
    if (revDiff !== 800000) {
      throw new Error(`❌ GAGAL: Pendapatan bertambah Rp ${revDiff}, seharusnya Rp 800.000`);
    }
    console.log('✅ PASS: Pos Sewa Alat dan Bunga Bank tercatat presisi di Laba Rugi.');

    console.log('\n--- 2. TEST BELANJA MODAL: Beli Alat Masak Baru (1201 Aset Tetap) Rp 3.000.000 ---');
    const trxBeliAlat = await prisma.transaction.create({
      data: {
        type: TransactionType.PENGELUARAN,
        category: accAset.name,
        accountId: accAset.id,
        description: '[TEST] Beli 2 Unit Kompor Mawar Besar & Kuali Stainless',
        amount: 3000000,
        date: testDate,
        createdById: testUser.id,
        syncedToSheet: true,
      },
    });

    // Verifikasi: Belanja Aset TIDAK BOLEH menjadi Beban Operasional di Laba Rugi
    const incomeAfterAsset = await getIncomeStatement(startDate, endDate);
    const expDiff = incomeAfterAsset.operatingExpenses.total - baseIncome.operatingExpenses.total;
    console.log(`- Perubahan Beban Operasional di Laba Rugi: Rp ${expDiff.toLocaleString('id-ID')} (Harus Rp 0)`);
    if (expDiff !== 0) {
      throw new Error('❌ GAGAL: Belanja Aset Tetap tidak boleh masuk sebagai Beban Operasional!');
    }
    console.log('✅ PASS: Pengadaan Aset tidak mengurangi laba operasional katering.');

    // Verifikasi Arus Kas Investasi
    const cashFlowAfterAsset = await getCashFlowSummary(startDate, endDate);
    const invOutflow = cashFlowAfterAsset.investingActivities.totalOutflow;
    console.log(`- Arus Kas Keluar Aktivitas Investasi: Rp ${invOutflow.toLocaleString('id-ID')}`);
    if (invOutflow < 3000000) {
      throw new Error('❌ GAGAL: Belanja alat harus masuk ke Arus Kas Aktivitas Investasi!');
    }
    console.log('✅ PASS: Arus Kas mencatat pengadaan alat di Aktivitas Investasi.');

    console.log('\n--- 3. TEST BAGI HASIL PADes: Setor Laba ke Kas Desa (3004) Rp 1.500.000 ---');
    const trxPADes = await prisma.transaction.create({
      data: {
        type: TransactionType.PENGELUARAN,
        category: accPADes.name,
        accountId: accPADes.id,
        description: '[TEST] Setoran Bagi Hasil Laba BUMDes ke Rekening Kas Desa',
        amount: 1500000,
        date: testDate,
        createdById: testUser.id,
        syncedToSheet: true,
      },
    });

    // Verifikasi Laporan Perubahan Modal: Harus tercatat sebagai Withdrawals / Penarikan Laba
    const equityAfterPADes = await getEquityStatement(startDate, endDate);
    const withdrawalDiff = equityAfterPADes.withdrawals - baseEquity.withdrawals;
    console.log(`- Penarikan Dividen / Bagi Hasil PADes: Rp ${withdrawalDiff.toLocaleString('id-ID')} (Harus Rp 1.500.000)`);
    if (withdrawalDiff !== 1500000) {
      throw new Error(`❌ GAGAL: Bagi Hasil PADes harus tercatat di Perubahan Modal sebagai penarikan (Rp ${withdrawalDiff})`);
    }
    console.log('✅ PASS: Laporan Perubahan Modal mencatat bagi hasil PADes dengan tepat.');

    console.log('\n--- 4. TEST INTEGRITAS NERACA KESELURUHAN (BALANCE CHECK) ---');
    const finalBalanceSheet = await getBalanceSheet(endDate);
    console.log(`- Total Aset (Aktiva): Rp ${finalBalanceSheet.assets.totalAssets.toLocaleString('id-ID')}`);
    console.log(`- Total Kewajiban & Ekuitas (Pasiva): Rp ${finalBalanceSheet.totalLiabilitiesAndEquity.toLocaleString('id-ID')}`);
    console.log(`- Status Neraca: ${finalBalanceSheet.isBalanced ? 'SEIMBANG (BALANCED)' : 'TIDAK SEIMBANG'}`);
    console.log(`- Selisih Discrepancy: Rp ${finalBalanceSheet.discrepancy.toLocaleString('id-ID')}`);

    if (!finalBalanceSheet.isBalanced || Math.abs(finalBalanceSheet.discrepancy) >= 1) {
      throw new Error('❌ GAGAL: Neraca tidak seimbang!');
    }
    console.log('✅ PASS: Neraca terverifikasi seimbang sempurna.');

    // Cleanup Test Data
    await prisma.transaction.deleteMany({
      where: {
        id: { in: [trxSewa.id, trxBunga.id, trxBeliAlat.id, trxPADes.id] },
      },
    });
    console.log('\n🧹 Seluruh data transaksi uji coba telah dibersihkan secara aman.');

    console.log('\n====================================================');
    console.log('🎉 SEMUA TEST POS AKUN LENGKAP LOLOS 100% SUKSES!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ ERROR SAAT PENGUJIAN POS AKUN:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runStandardCOATest();
