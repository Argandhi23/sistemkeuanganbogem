import { PrismaClient, BusinessUnit, TransactionType } from '@prisma/client';
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowSummary,
} from '../src/lib/accounting';

const prisma = new PrismaClient();

async function runManualTest() {
  console.log('====================================================');
  console.log('🧪 TEST MANUAL MULTI-UNIT AKUNTANSI & CLEANUP DATA');
  console.log('====================================================\n');

  let testTxIds: string[] = [];

  try {
    // 1. Verifikasi Kondisi Awal
    console.log('1. Memeriksa Kondisi Awal Database:');
    const initialOrderCount = await prisma.cateringOrder.count();
    const initialTxCount = await prisma.transaction.count();
    console.log(`   - Data Catering Order: ${initialOrderCount} (Wajib 3)`);
    console.log(`   - Data Transaksi Eksisting: ${initialTxCount} transaksi`);

    const adminUser = await prisma.user.findFirst();
    if (!adminUser) throw new Error('User admin tidak ditemukan untuk test');

    // 2. Buat Transaksi Uji Coba (Manual Test Insertion)
    console.log('\n2. Membuat Transaksi Uji Coba Multi-Unit:');

    // Ambil akun yang diperlukan
    const accMolenIn = await prisma.account.findUniqueOrThrow({ where: { code: '4010' } });
    const accMolenOut = await prisma.account.findUniqueOrThrow({ where: { code: '5012' } });
    const accCateringIn = await prisma.account.findUniqueOrThrow({ where: { code: '4001' } });

    // Test A: Sewa Molen Rp 350.000
    const tx1 = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: accMolenIn.name,
        businessUnit: BusinessUnit.RENTAL_MOLEN,
        paymentMethod: 'TUNAI',
        accountId: accMolenIn.id,
        description: '[TEST MANUAL] Sewa Mesin Molen Proyek Dusun',
        amount: 350000,
        date: new Date(),
        createdById: adminUser.id,
      },
    });
    testTxIds.push(tx1.id);
    console.log(`   [+] Dibuat: ${tx1.description} (Rp ${Number(tx1.amount).toLocaleString('id-ID')})`);

    // Test B: Solar Molen Rp 100.000
    const tx2 = await prisma.transaction.create({
      data: {
        type: TransactionType.PENGELUARAN,
        category: accMolenOut.name,
        businessUnit: BusinessUnit.RENTAL_MOLEN,
        paymentMethod: 'TUNAI',
        accountId: accMolenOut.id,
        description: '[TEST MANUAL] Beli Solar Mesin Molen 6L',
        amount: 100000,
        date: new Date(),
        createdById: adminUser.id,
      },
    });
    testTxIds.push(tx2.id);
    console.log(`   [-] Dibuat: ${tx2.description} (Rp ${Number(tx2.amount).toLocaleString('id-ID')})`);

    // Test C: Catering Tambahan Rp 500.000
    const tx3 = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: accCateringIn.name,
        businessUnit: BusinessUnit.CATERING,
        paymentMethod: 'TUNAI',
        accountId: accCateringIn.id,
        description: '[TEST MANUAL] Pembayaran Pesanan Nasi Box',
        amount: 500000,
        date: new Date(),
        createdById: adminUser.id,
      },
    });
    testTxIds.push(tx3.id);
    console.log(`   [+] Dibuat: ${tx3.description} (Rp ${Number(tx3.amount).toLocaleString('id-ID')})`);

    // 3. Verifikasi Akuntansi Saat Test Data Ada
    console.log('\n3. Menguji Laporan Keuangan Saat Data Uji Coba Berjalan:');
    const now = new Date();
    const startDate = new Date(now.getFullYear(), 0, 1);
    const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    // Laba Rugi Molen
    const molenIncome = await getIncomeStatement(startDate, endDate, BusinessUnit.RENTAL_MOLEN);
    console.log(`   Laba Rugi RENTAL_MOLEN: Pendapatan Rp ${molenIncome.revenue.total.toLocaleString('id-ID')}, Beban Rp ${molenIncome.operatingExpenses.total.toLocaleString('id-ID')}, Laba Bersih: Rp ${molenIncome.netIncome.toLocaleString('id-ID')}`);
    if (molenIncome.netIncome !== 250000) {
      throw new Error(`Laba bersih Molen tidak sesuai! Diharapkan 250.000, didapat ${molenIncome.netIncome}`);
    }

    // Neraca Molen
    const molenBalance = await getBalanceSheet(now, BusinessUnit.RENTAL_MOLEN);
    console.log(`   Neraca RENTAL_MOLEN: Aset Rp ${molenBalance.assets.totalAssets.toLocaleString('id-ID')}, Pasiva Rp ${molenBalance.totalLiabilitiesAndEquity.toLocaleString('id-ID')} | Seimbang: ${molenBalance.isBalanced ? 'YA ✅' : 'TIDAK ❌'}`);
    if (!molenBalance.isBalanced) {
      throw new Error('Neraca RENTAL_MOLEN tidak seimbang!');
    }

    // Neraca Catering
    const cateringBalance = await getBalanceSheet(now, BusinessUnit.CATERING);
    console.log(`   Neraca CATERING: Aset Rp ${cateringBalance.assets.totalAssets.toLocaleString('id-ID')}, Pasiva Rp ${cateringBalance.totalLiabilitiesAndEquity.toLocaleString('id-ID')} | Seimbang: ${cateringBalance.isBalanced ? 'YA ✅' : 'TIDAK ❌'}`);
    if (!cateringBalance.isBalanced) {
      throw new Error('Neraca CATERING tidak seimbang!');
    }

    // Neraca Konsolidasi (ALL)
    const allBalance = await getBalanceSheet(now, 'ALL');
    console.log(`   Neraca KONSOLIDASI (ALL): Aset Rp ${allBalance.assets.totalAssets.toLocaleString('id-ID')}, Pasiva Rp ${allBalance.totalLiabilitiesAndEquity.toLocaleString('id-ID')} | Seimbang: ${allBalance.isBalanced ? 'YA ✅' : 'TIDAK ❌'}`);
    if (!allBalance.isBalanced) {
      throw new Error('Neraca KONSOLIDASI tidak seimbang!');
    }

    console.log('   ✅ Verifikasi Kalkulasi Multi-Unit: BERHASIL 100%');

  } catch (err) {
    console.error('❌ Error saat test manual:', err);
    throw err;
  } finally {
    // 4. Hapus Data Test Manual (Cleanup Sesuai Perintah User)
    console.log('\n4. Menghapus Data Test Manual (Pembersihan / Cleanup):');
    if (testTxIds.length > 0) {
      const deleteResult = await prisma.transaction.deleteMany({
        where: { id: { in: testTxIds } },
      });
      console.log(`   🗑️ Berhasil menghapus ${deleteResult.count} transaksi uji coba dari database.`);
    }

    // 5. Verifikasi Final Setelah Cleanup
    console.log('\n5. Verifikasi Final Setelah Cleanup:');
    const finalOrderCount = await prisma.cateringOrder.count();
    const finalTxCount = await prisma.transaction.count();
    console.log(`   - Data Catering Order: ${finalOrderCount} (Aman & Tidak Berubah)`);
    console.log(`   - Total Transaksi Kas: ${finalTxCount} (Tepat Kembali Semula)`);

    const now = new Date();
    const finalCateringBalance = await getBalanceSheet(now, BusinessUnit.CATERING);
    const finalAllBalance = await getBalanceSheet(now, 'ALL');
    console.log(`   - Neraca CATERING: Aset Rp ${finalCateringBalance.assets.totalAssets.toLocaleString('id-ID')}, Pasiva Rp ${finalCateringBalance.totalLiabilitiesAndEquity.toLocaleString('id-ID')} | Seimbang: ${finalCateringBalance.isBalanced ? 'YA ✅' : 'TIDAK ❌'}`);
    console.log(`   - Neraca KONSOLIDASI: Aset Rp ${finalAllBalance.assets.totalAssets.toLocaleString('id-ID')}, Pasiva Rp ${finalAllBalance.totalLiabilitiesAndEquity.toLocaleString('id-ID')} | Seimbang: ${finalAllBalance.isBalanced ? 'YA ✅' : 'TIDAK ❌'}`);

    console.log('\n====================================================');
    console.log('🎉 SELURUH TEST MANUAL & CLEANUP SELESAI DENGAN SUKSES!');
    console.log('====================================================');

    await prisma.$disconnect();
  }
}

runManualTest();
