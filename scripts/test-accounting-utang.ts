import { PrismaClient, AccountCategory, TransactionType } from '@prisma/client';
import {
  getIncomeStatement,
  getCashFlowSummary,
  getBalanceSheet,
  getGeneralLedger,
} from '../src/lib/accounting';

const prisma = new PrismaClient();

async function runUtangAccountingTest() {
  console.log('====================================================');
  console.log('🧪 MEMULAI TEST VALIDASI AKUNTANSI UTANG (KEWAJIBAN)');
  console.log('====================================================\n');

  try {
    // 1. Ambil atau buat akun 2002 (Utang Pinjaman)
    const utangAccount = await prisma.account.upsert({
      where: { code: '2002' },
      update: { name: 'Utang Pinjaman (Bank / Pihak Ketiga)', category: AccountCategory.KEWAJIBAN, isActive: true },
      create: {
        code: '2002',
        name: 'Utang Pinjaman (Bank / Pihak Ketiga)',
        category: AccountCategory.KEWAJIBAN,
        isActive: true,
      },
    });
    console.log(`✅ Master Akun: [${utangAccount.code}] ${utangAccount.name} (${utangAccount.category}) terverifikasi.`);

    // 2. Ambil user admin/petugas untuk relasi createdBy
    const testUser = await prisma.user.findFirst({ where: { isActive: true } });
    if (!testUser) {
      throw new Error('Tidak ada user aktif ditemukan di database untuk menjalankan test');
    }

    const testDate = new Date();
    const startDate = new Date(testDate.getFullYear(), testDate.getMonth(), 1);
    const endDate = new Date(testDate.getFullYear(), testDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Ambil baseline laporan sebelum test
    const baselineIncome = await getIncomeStatement(startDate, endDate);
    const baselineBalance = await getBalanceSheet(endDate);

    console.log('\n--- 1. TEST UANG MASUK: Penerimaan Pinjaman Rp 10.000.000 ---');
    const trxPinjamanMasuk = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: utangAccount.name,
        accountId: utangAccount.id,
        description: '[TEST] Pencairan Pinjaman Modal Kerja dari Bank',
        amount: 10000000,
        date: testDate,
        createdById: testUser.id,
        syncedToSheet: true,
      },
    });
    console.log(`✅ Transaksi berhasil dibuat: ID ${trxPinjamanMasuk.id} - Rp 10.000.000 (PEMASUKAN - UTANG)`);

    // Verifikasi Laba Rugi: Pendapatan & Laba Bersih TIDAK BOLEH bertambah
    const incomeAfterLoan = await getIncomeStatement(startDate, endDate);
    const revenueDiff = incomeAfterLoan.revenue.total - baselineIncome.revenue.total;
    const netIncomeDiff = incomeAfterLoan.netIncome - baselineIncome.netIncome;

    console.log(`- Perubahan Pendapatan di Laba Rugi: Rp ${revenueDiff.toLocaleString('id-ID')} (Harus Rp 0)`);
    console.log(`- Perubahan Laba Bersih di Laba Rugi: Rp ${netIncomeDiff.toLocaleString('id-ID')} (Harus Rp 0)`);
    if (revenueDiff !== 0 || netIncomeDiff !== 0) {
      throw new Error('❌ GAGAL: Penerimaan Utang tidak boleh menambah pendapatan atau laba di Laporan Laba Rugi!');
    }
    console.log('✅ PASS: Laba Rugi steril dari penerimaan pinjaman utang.');

    // Verifikasi Arus Kas: Harus masuk ke Aktivitas Pendanaan (Financing Inflow)
    const cashFlowAfterLoan = await getCashFlowSummary(startDate, endDate);
    const financingInflow = cashFlowAfterLoan.financingActivities.totalInflow;
    console.log(`- Arus Kas Masuk Aktivitas Pendanaan: Rp ${financingInflow.toLocaleString('id-ID')}`);
    if (financingInflow < 10000000) {
      throw new Error('❌ GAGAL: Penerimaan Utang harus tercatat di Arus Kas Aktivitas Pendanaan!');
    }
    console.log('✅ PASS: Arus Kas mencatat pinjaman di Aktivitas Pendanaan.');

    // Verifikasi Neraca: Total Aset = Total Kewajiban + Ekuitas (Harus Balanced)
    const balanceAfterLoan = await getBalanceSheet(endDate);
    console.log(`- Status Neraca: ${balanceAfterLoan.isBalanced ? 'SEIMBANG (BALANCED)' : 'TIDAK SEIMBANG'}`);
    console.log(`- Selisih Neraca (Discrepancy): Rp ${balanceAfterLoan.discrepancy.toLocaleString('id-ID')}`);
    if (!balanceAfterLoan.isBalanced || Math.abs(balanceAfterLoan.discrepancy) >= 1) {
      throw new Error('❌ GAGAL: Neraca tidak seimbang setelah pencatatan pinjaman utang!');
    }
    console.log('✅ PASS: Neraca seimbang sempurna.');

    console.log('\n--- 2. TEST UANG KELUAR: Pembayaran Cicilan Utang Rp 2.000.000 ---');
    const trxBayarUtang = await prisma.transaction.create({
      data: {
        type: TransactionType.PENGELUARAN,
        category: utangAccount.name,
        accountId: utangAccount.id,
        description: '[TEST] Pembayaran Angsuran Pokok Pinjaman',
        amount: 2000000,
        date: testDate,
        createdById: testUser.id,
        syncedToSheet: true,
      },
    });
    console.log(`✅ Transaksi berhasil dibuat: ID ${trxBayarUtang.id} - Rp 2.000.000 (PENGELUARAN - UTANG)`);

    // Verifikasi Laba Rugi: Beban Operasional TIDAK BOLEH bertambah
    const incomeAfterPayment = await getIncomeStatement(startDate, endDate);
    const expenseDiff = incomeAfterPayment.operatingExpenses.total - baselineIncome.operatingExpenses.total;
    console.log(`- Perubahan Beban di Laba Rugi: Rp ${expenseDiff.toLocaleString('id-ID')} (Harus Rp 0)`);
    if (expenseDiff !== 0) {
      throw new Error('❌ GAGAL: Pembayaran pokok utang tidak boleh menjadi beban di Laporan Laba Rugi!');
    }
    console.log('✅ PASS: Laba Rugi tidak mencatat bayar utang sebagai beban.');

    // Verifikasi Buku Besar Akun 2002
    const ledger = await getGeneralLedger(utangAccount.id, startDate, endDate);
    console.log(`- Buku Besar Akun 2002: Total Kredit = Rp ${ledger.totalCredit.toLocaleString('id-ID')}, Total Debet = Rp ${ledger.totalDebit.toLocaleString('id-ID')}`);
    console.log(`- Saldo Akhir Utang: Rp ${ledger.closingBalance.toLocaleString('id-ID')} (Harus Rp 8.000.000)`);
    if (ledger.closingBalance !== 8000000) {
      throw new Error(`❌ GAGAL: Saldo akhir utang seharusnya Rp 8.000.000, didapat Rp ${ledger.closingBalance}`);
    }
    console.log('✅ PASS: Buku Besar Utang mencatat mutasi Kredit dan Debet dengan tepat.');

    // Verifikasi Neraca Akhir
    const finalBalance = await getBalanceSheet(endDate);
    console.log(`- Neraca Akhir: Total Aset = Rp ${finalBalance.assets.totalAssets.toLocaleString('id-ID')}, Total Pasiva = Rp ${finalBalance.totalLiabilitiesAndEquity.toLocaleString('id-ID')}`);
    console.log(`- Status Neraca: ${finalBalance.isBalanced ? 'SEIMBANG (BALANCED)' : 'TIDAK SEIMBANG'}`);
    if (!finalBalance.isBalanced || Math.abs(finalBalance.discrepancy) >= 1) {
      throw new Error('❌ GAGAL: Neraca akhir tidak seimbang!');
    }
    console.log('✅ PASS: Neraca akhir seimbang.');

    // Cleanup Test Data
    await prisma.transaction.deleteMany({
      where: {
        id: { in: [trxPinjamanMasuk.id, trxBayarUtang.id] },
      },
    });
    console.log('\n🧹 Data transaksi pengujian berhasil dibersihkan dari database.');

    console.log('\n====================================================');
    console.log('🎉 SEMUA TEST AKUNTANSI UTANG LOLOS 100% SUKSES!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ ERROR SAAT PENGUJIAN:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runUtangAccountingTest();
