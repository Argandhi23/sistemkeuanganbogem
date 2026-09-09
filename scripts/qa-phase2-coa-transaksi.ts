import prisma from '../src/lib/prisma';
import { BusinessUnit, TransactionType, AccountCategory } from '@prisma/client';
import { invalidateAccountsCache, invalidateDashboardStatsCache } from '../src/lib/cache';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

async function testPhase2() {
  console.log('===============================================================');
  console.log('🧪 FASE 2: PENGUJIAN BAGAN AKUN (COA) & TRANSAKSI KAS UMUM');
  console.log('===============================================================\n');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('User admin tidak ditemukan');

  const initialTxCount = await prisma.transaction.count();
  const initialAccCount = await prisma.account.count();
  console.log(`Initial status: ${initialAccCount} akun, ${initialTxCount} transaksi kas.`);

  let createdTestAccountId: string | null = null;
  const createdTestTxIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // BAGIAN A: CHART OF ACCOUNTS (COA)
    // -------------------------------------------------------------
    console.log('\n--- 2A. PENGUJIAN MASTER BAGAN AKUN (COA) ---');

    // 1. Create Test Account
    const testAccount = await prisma.account.create({
      data: {
        code: '1099',
        name: '[TEST-QA] Rekening Titipan Uji Coba',
        category: AccountCategory.ASET,
        businessUnit: BusinessUnit.UMUM,
        isActive: true,
      },
    });
    createdTestAccountId = testAccount.id;
    invalidateAccountsCache();
    results.push({
      step: '1. Buat Akun Bagan Akun Baru',
      status: 'PASS',
      detail: `Akun berhasil dibuat: [${testAccount.code}] ${testAccount.name}`,
    });

    // 2. Cek Duplikasi Kode Akun
    try {
      await prisma.account.create({
        data: {
          code: '1099',
          name: '[TEST-QA] Akun Duplikat',
          category: AccountCategory.ASET,
          businessUnit: BusinessUnit.UMUM,
        },
      });
      results.push({
        step: '2. Validasi Duplikasi Kode Akun',
        status: 'FAIL',
        detail: 'Sistem mengizinkan duplikasi kode akun!',
      });
    } catch (err: any) {
      results.push({
        step: '2. Validasi Duplikasi Kode Akun',
        status: 'PASS',
        detail: 'Berhasil menolak kode akun duplikat (Unique Constraint Enforced)',
      });
    }

    // 3. Update Akun
    const updatedAcc = await prisma.account.update({
      where: { id: testAccount.id },
      data: {
        name: '[TEST-QA] Rekening Titipan Diperbarui',
        isActive: false,
      },
    });
    invalidateAccountsCache();
    if (updatedAcc.name.includes('Diperbarui') && updatedAcc.isActive === false) {
      results.push({
        step: '3. Perbarui Data & Status Akun',
        status: 'PASS',
        detail: `Nama dan status aktif berhasil diperbarui (isActive: ${updatedAcc.isActive})`,
      });
    } else {
      results.push({
        step: '3. Perbarui Data & Status Akun',
        status: 'FAIL',
        detail: 'Pembaruan akun gagal atau tidak sesuai',
      });
    }

    // -------------------------------------------------------------
    // BAGIAN B: TRANSAKSI KAS BUKU KAS
    // -------------------------------------------------------------
    console.log('\n--- 2B. PENGUJIAN TRANSAKSI KAS BUKU KAS ---');

    const accCateringRev = await prisma.account.findUniqueOrThrow({ where: { code: '4001' } });
    const accCateringExp = await prisma.account.findUniqueOrThrow({ where: { code: '5001' } });

    // 4. Tambah Transaksi Pemasukan Kas
    const txIn = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: accCateringRev.name,
        businessUnit: BusinessUnit.CATERING,
        paymentMethod: 'TUNAI',
        accountId: accCateringRev.id,
        description: '[TEST-QA] Penerimaan Cash Pesanan Konsumsi Hajatan',
        amount: 1750000,
        date: new Date(),
        createdById: admin.id,
      },
      include: { account: true, createdBy: true },
    });
    createdTestTxIds.push(txIn.id);
    results.push({
      step: '4. Tambah Transaksi Pemasukan Kas',
      status: 'PASS',
      detail: `ID: ${txIn.id}, Nominal: Rp ${Number(txIn.amount).toLocaleString('id-ID')}, Akun: [${txIn.account?.code}]`,
    });

    // 5. Tambah Transaksi Pengeluaran Kas
    const txOut = await prisma.transaction.create({
      data: {
        type: TransactionType.PENGELUARAN,
        category: accCateringExp.name,
        businessUnit: BusinessUnit.CATERING,
        paymentMethod: 'TUNAI',
        accountId: accCateringExp.id,
        description: '[TEST-QA] Pembelian Beras & Minyak Goreng',
        amount: 750000,
        date: new Date(),
        createdById: admin.id,
      },
      include: { account: true },
    });
    createdTestTxIds.push(txOut.id);
    results.push({
      step: '5. Tambah Transaksi Pengeluaran Kas',
      status: 'PASS',
      detail: `ID: ${txOut.id}, Nominal: Rp ${Number(txOut.amount).toLocaleString('id-ID')}, Akun: [${txOut.account?.code}]`,
    });

    // 6. Uji Filter & Pencarian Transaksi
    const searchFound = await prisma.transaction.findMany({
      where: {
        description: { contains: '[TEST-QA]', mode: 'insensitive' },
      },
    });
    if (searchFound.length >= 2) {
      results.push({
        step: '6. Filter & Pencarian Transaksi',
        status: 'PASS',
        detail: `Pencarian kata kunci menemukan ${searchFound.length} transaksi uji coba`,
      });
    } else {
      results.push({
        step: '6. Filter & Pencarian Transaksi',
        status: 'FAIL',
        detail: `Hasil pencarian tidak sesuai: ditemukan ${searchFound.length}`,
      });
    }

    // 7. Update / Edit Transaksi Kas
    const updatedTx = await prisma.transaction.update({
      where: { id: txIn.id },
      data: {
        amount: 1800000,
        description: '[TEST-QA] Penerimaan Cash Pesanan Konsumsi (Diperbarui +50k)',
      },
    });
    if (Number(updatedTx.amount) === 1800000 && updatedTx.description.includes('Diperbarui')) {
      results.push({
        step: '7. Edit / Perbarui Transaksi Kas',
        status: 'PASS',
        detail: `Nominal transaksi berhasil diubah menjadi Rp ${Number(updatedTx.amount).toLocaleString('id-ID')}`,
      });
    } else {
      results.push({
        step: '7. Edit / Perbarui Transaksi Kas',
        status: 'FAIL',
        detail: 'Perubahan nominal transaksi gagal',
      });
    }

    // 8. Hapus Transaksi Uji Coba & Akun Uji Coba (Sterilisasi)
    const delTx = await prisma.transaction.deleteMany({
      where: { id: { in: createdTestTxIds } },
    });
    createdTestTxIds.length = 0; // kosongkan array karena sudah dihapus

    const delAcc = await prisma.account.delete({
      where: { id: createdTestAccountId },
    });
    createdTestAccountId = null;
    invalidateAccountsCache();
    invalidateDashboardStatsCache();

    results.push({
      step: '8. Pembersihan Data Uji Coba (Sterilisasi Fase 2)',
      status: 'PASS',
      detail: `Berhasil menghapus ${delTx.count} transaksi uji coba dan akun [${delAcc.code}]`,
    });

    // 9. Verifikasi Jumlah Akhir Database
    const finalTxCount = await prisma.transaction.count();
    const finalAccCount = await prisma.account.count();
    if (finalTxCount === initialTxCount && finalAccCount === initialAccCount) {
      results.push({
        step: '9. Verifikasi Sterilisasi Database Awal vs Akhir',
        status: 'PASS',
        detail: `Database 100% steril: Transaksi ${finalTxCount}/${initialTxCount}, Akun ${finalAccCount}/${initialAccCount}`,
      });
    } else {
      results.push({
        step: '9. Verifikasi Sterilisasi Database Awal vs Akhir',
        status: 'FAIL',
        detail: `Ada residu data: Transaksi ${finalTxCount} (awal ${initialTxCount}), Akun ${finalAccCount} (awal ${initialAccCount})`,
      });
    }

  } catch (err: any) {
    results.push({
      step: 'Eksekusi Fase 2',
      status: 'FAIL',
      detail: `Error tak terduga: ${err.message}`,
    });
  } finally {
    // Safety fallback cleanup
    if (createdTestTxIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { id: { in: createdTestTxIds } } });
      console.log('   [Cleaned up remaining test transactions]');
    }
    if (createdTestAccountId) {
      await prisma.account.deleteMany({ where: { id: createdTestAccountId } });
      console.log('   [Cleaned up remaining test account]');
    }
  }

  console.log('\n--- HASIL PENGUJIAN FASE 2 ---');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.step} -> ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  if (!allPass) {
    throw new Error('Pengujian Fase 2 gagal!');
  }
  console.log('\n🎉 FASE 2: SEMUA TEST BAGAN AKUN & TRANSAKSI KAS LULUS 100%!');
}

testPhase2()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
