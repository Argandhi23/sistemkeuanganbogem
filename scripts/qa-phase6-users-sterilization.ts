import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { logActivity } from '../src/lib/activityLog';
import { getBalanceSheet } from '../src/lib/accounting';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

async function testPhase6() {
  console.log('========================================================================');
  console.log('🧪 FASE 6: PENGUJIAN USER MANAGEMENT, AUDIT TRAIL & STERILISASI AKHIR');
  console.log('========================================================================\n');

  let testUserId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // 1. MANAJEMEN PENGGUNA (CRUD & SAFETY RULES)
    // -------------------------------------------------------------------------
    console.log('--- 1. PENGUJIAN MANAJEMEN PENGGUNA ---');

    // 1A. Buat User Uji Coba Baru
    const hashedPass = await bcrypt.hash('password123', 10);
    const testUser = await prisma.user.create({
      data: {
        name: '[TEST-QA] Staf Pengawas BUMDes',
        email: 'pengawas.qa@bogem.desa.id',
        password: hashedPass,
        role: 'USER',
        isActive: true,
      },
    });
    testUserId = testUser.id;

    results.push({
      step: '1A. Tambah Pengguna Baru',
      status: 'PASS',
      detail: `User dibuat: ${testUser.name} (${testUser.email}), Role: ${testUser.role}`,
    });

    // 1B. Uji Penolakan Email Duplikat
    try {
      await prisma.user.create({
        data: {
          name: '[TEST-QA] Duplikat',
          email: 'pengawas.qa@bogem.desa.id',
          password: hashedPass,
          role: 'USER',
        },
      });
      results.push({
        step: '1B. Validasi Duplikasi Email Pengguna',
        status: 'FAIL',
        detail: 'Sistem mengizinkan email ganda!',
      });
    } catch (err: any) {
      results.push({
        step: '1B. Validasi Duplikasi Email Pengguna',
        status: 'PASS',
        detail: 'Berhasil menolak pendaftaran email yang sudah terpakai (Unique Constraint)',
      });
    }

    // 1C. Perbarui Profil & Role Pengguna
    const updatedUser = await prisma.user.update({
      where: { id: testUserId },
      data: {
        name: '[TEST-QA] Staf Pengawas Diperbarui',
        role: 'CATERING',
      },
    });

    if (updatedUser.name.includes('Diperbarui') && updatedUser.role === 'CATERING') {
      results.push({
        step: '1C. Perbarui Profil & Role Pengguna',
        status: 'PASS',
        detail: `Nama dan role berhasil diperbarui menjadi ${updatedUser.role}`,
      });
    } else {
      results.push({
        step: '1C. Perbarui Profil & Role Pengguna',
        status: 'FAIL',
        detail: 'Pembaruan data pengguna gagal',
      });
    }

    // 1D. Hapus User Uji Coba (Clean Deletion)
    await prisma.user.delete({ where: { id: testUserId } });
    testUserId = null;

    results.push({
      step: '1D. Hapus Pengguna Uji Coba Tanpa Relasi',
      status: 'PASS',
      detail: 'Pengguna uji coba berhasil dihapus permanen dari sistem',
    });

    // -------------------------------------------------------------------------
    // 2. AUDIT TRAIL LOG AKTIVITAS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. PENGUJIAN AUDIT TRAIL & LOG AKTIVITAS ---');

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) throw new Error('Admin user tidak ditemukan');

    // Catat log uji coba
    const testLog = await logActivity({
      userId: admin.id,
      action: 'QA_TEST_AUDIT',
      targetType: 'SystemVerification',
      targetId: 'sys-01',
      detail: 'Verifikasi pencatatan audit trail pra-launching',
    });

    const foundLog = await prisma.activityLog.findFirst({
      where: { action: 'QA_TEST_AUDIT' },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (foundLog) {
      results.push({
        step: '2A. Pencatatan Audit Trail Aktivitas',
        status: 'PASS',
        detail: `Aktivitas [${foundLog.action}] oleh ${foundLog.user.name} tercatat dengan presisi (ID: ${foundLog.id})`,
      });

      // Bersihkan log uji coba agar log aktivitas juga steril
      await prisma.activityLog.delete({ where: { id: foundLog.id } });
      results.push({
        step: '2B. Sterilisasi Log Uji Coba',
        status: 'PASS',
        detail: 'Log aktivitas uji coba berhasil dibersihkan',
      });
    } else {
      results.push({
        step: '2A. Pencatatan Audit Trail Aktivitas',
        status: 'FAIL',
        detail: 'Log aktivitas tidak ditemukan di database',
      });
    }

    // -------------------------------------------------------------------------
    // 3. VERIFIKASI AKHIR KEBERSIHAN & STERILISASI DATABASE (ZERO RESIDUE)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. VERIFIKASI AKHIR DATABASE ZERO RESIDUE ---');

    const [
      usersCount,
      accountsCount,
      txCount,
      ordersCount,
      molenCount,
      rentalCount,
      wifiPlanCount,
      wifiCustCount,
      wifiBillCount,
      ppobCount,
      cattleCount,
      cattleExpCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.account.count(),
      prisma.transaction.count(),
      prisma.cateringOrder.count(),
      prisma.molenUnit.count(),
      prisma.molenRental.count(),
      prisma.wifiPlan.count(),
      prisma.wifiCustomer.count(),
      prisma.wifiBill.count(),
      prisma.ppobTransaction.count(),
      prisma.cattle.count(),
      prisma.cattleExpense.count(),
    ]);

    const expectedState = {
      users: 2,
      accounts: 46,
      transactions: 253,
      cateringOrders: 3,
      molenUnits: 2,
      molenRentals: 0,
      wifiPlans: 3,
      wifiCustomers: 1,
      wifiBills: 1,
      ppob: 0,
      cattle: 2,
      cattleExpenses: 0,
    };

    const actualState = {
      users: usersCount,
      accounts: accountsCount,
      transactions: txCount,
      cateringOrders: ordersCount,
      molenUnits: molenCount,
      molenRentals: rentalCount,
      wifiPlans: wifiPlanCount,
      wifiCustomers: wifiCustCount,
      wifiBills: wifiBillCount,
      ppob: ppobCount,
      cattle: cattleCount,
      cattleExpenses: cattleExpCount,
    };

    console.log('Kondisi Database Saat Ini vs Ekspektasi Baseline:');
    console.table({
      Ekspektasi: expectedState,
      Aktual: actualState,
    });

    let isZeroResidue = true;
    for (const key of Object.keys(expectedState) as Array<keyof typeof expectedState>) {
      if (expectedState[key] !== actualState[key]) {
        isZeroResidue = false;
        console.error(`❌ Mismatch pada ${key}: ekspektasi ${expectedState[key]}, aktual ${actualState[key]}`);
      }
    }

    if (isZeroResidue) {
      results.push({
        step: '3A. Integritas Tabel & Sterilisasi Total (Zero Residue)',
        status: 'PASS',
        detail: 'Seluruh 12 tabel database 100% STERIL dan kembali tepat ke data riil BUMDes tanpa sisa data uji coba!',
      });
    } else {
      results.push({
        step: '3A. Integritas Tabel & Sterilisasi Total (Zero Residue)',
        status: 'FAIL',
        detail: 'Terdapat ketidaksesuaian jumlah data pada database',
      });
    }

    // 3B. Verifikasi Neraca Finansial Konsolidasi
    const finalBalanceSheet = await getBalanceSheet(new Date(), 'ALL');
    if (finalBalanceSheet.isBalanced && finalBalanceSheet.discrepancy === 0) {
      results.push({
        step: '3B. Keseimbangan Neraca Finansial Pasca-Pengujian',
        status: 'PASS',
        detail: `Neraca Konsolidasi SEIMBANG (Aset Rp ${finalBalanceSheet.assets.totalAssets.toLocaleString('id-ID')} == Pasiva Rp ${finalBalanceSheet.totalLiabilitiesAndEquity.toLocaleString('id-ID')}, Selisih: 0)`,
      });
    } else {
      results.push({
        step: '3B. Keseimbangan Neraca Finansial Pasca-Pengujian',
        status: 'FAIL',
        detail: `Neraca pasca-test tidak seimbang: selisih Rp ${finalBalanceSheet.discrepancy}`,
      });
    }

  } catch (err: any) {
    results.push({
      step: 'Eksekusi Fase 6',
      status: 'FAIL',
      detail: `Error tak terduga: ${err.message}`,
    });
  } finally {
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  }

  console.log('\n--- HASIL PENGUJIAN FASE 6 ---');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.step} -> ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  if (!allPass) {
    throw new Error('Pengujian Fase 6 gagal!');
  }
  console.log('\n🎉 FASE 6: USER MANAGEMENT & STERILISASI AKHIR DATABASE LULUS 100%!');
}

testPhase6()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
