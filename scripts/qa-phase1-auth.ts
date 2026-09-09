import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { authOptions } from '../src/lib/auth';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

async function testPhase1() {
  console.log('===============================================================');
  console.log('🧪 FASE 1: PENGUJIAN OTENTIKASI, SESSION & KEAMANAN RBAC');
  console.log('===============================================================\n');

  const provider = authOptions.providers[0] as any;
  const authorize = provider.options?.authorize || provider.authorize;
  if (!authorize) {
    throw new Error('Credential provider authorize function is not defined');
  }

  // 1. Uji Login Sukses Admin
  try {
    const adminSession = await authorize(
      { email: 'admin@bogem.desa.id', password: 'admin123' },
      {} as any
    );
    if (adminSession && adminSession.email === 'admin@bogem.desa.id' && adminSession.role === 'ADMIN') {
      results.push({
        step: '1. Login Sukses Akun Administrator',
        status: 'PASS',
        detail: `Berhasil login sebagai ${adminSession.name} dengan role ${adminSession.role}`,
      });
    } else {
      results.push({
        step: '1. Login Sukses Akun Administrator',
        status: 'FAIL',
        detail: 'User berhasil login tetapi role bukan ADMIN atau data tidak sesuai',
      });
    }
  } catch (err: any) {
    results.push({
      step: '1. Login Sukses Akun Administrator',
      status: 'FAIL',
      detail: `Error: ${err.message}`,
    });
  }

  // 2. Uji Login Sukses Petugas Catering
  try {
    const cateringSession = await authorize(
      { email: 'petugas@bogem.desa.id', password: 'petugas123' },
      {} as any
    );
    if (cateringSession && cateringSession.email === 'petugas@bogem.desa.id' && cateringSession.role === 'CATERING') {
      results.push({
        step: '2. Login Sukses Akun Petugas Catering',
        status: 'PASS',
        detail: `Berhasil login sebagai ${cateringSession.name} dengan role ${cateringSession.role}`,
      });
    } else {
      results.push({
        step: '2. Login Sukses Akun Petugas Catering',
        status: 'FAIL',
        detail: 'User berhasil login tetapi role bukan CATERING atau data tidak sesuai',
      });
    }
  } catch (err: any) {
    results.push({
      step: '2. Login Sukses Akun Petugas Catering',
      status: 'FAIL',
      detail: `Error: ${err.message}`,
    });
  }

  // 3. Uji Kegagalan Login: Kata Sandi Salah
  try {
    await authorize(
      { email: 'admin@bogem.desa.id', password: 'wrongpassword' },
      {} as any
    );
    results.push({
      step: '3. Penolakan Kata Sandi Salah',
      status: 'FAIL',
      detail: 'Sistem meloloskan login dengan password yang salah!',
    });
  } catch (err: any) {
    if (err.message === 'Email atau kata sandi salah') {
      results.push({
        step: '3. Penolakan Kata Sandi Salah',
        status: 'PASS',
        detail: `Ditolak dengan pesan yang tepat: "${err.message}"`,
      });
    } else {
      results.push({
        step: '3. Penolakan Kata Sandi Salah',
        status: 'FAIL',
        detail: `Ditolak tapi pesan tidak terstandarisasi: "${err.message}"`,
      });
    }
  }

  // 4. Uji Kegagalan Login: Email Tidak Terdaftar
  try {
    await authorize(
      { email: 'unregistered@bogem.desa.id', password: 'password123' },
      {} as any
    );
    results.push({
      step: '4. Penolakan Email Tidak Terdaftar',
      status: 'FAIL',
      detail: 'Sistem meloloskan email yang tidak terdaftar!',
    });
  } catch (err: any) {
    if (err.message === 'Email atau kata sandi salah') {
      results.push({
        step: '4. Penolakan Email Tidak Terdaftar',
        status: 'PASS',
        detail: `Ditolak secara aman tanpa membocorkan eksistensi akun: "${err.message}"`,
      });
    } else {
      results.push({
        step: '4. Penolakan Email Tidak Terdaftar',
        status: 'FAIL',
        detail: `Pesan galat: "${err.message}"`,
      });
    }
  }

  // 5. Uji Penolakan Akun Nonaktif (isActive: false)
  let testDisabledUserId: string | null = null;
  try {
    const hashedPass = await bcrypt.hash('dummy123', 10);
    const testDisabledUser = await prisma.user.create({
      data: {
        name: '[TEST-QA] Akun Nonaktif',
        email: 'disabled_test@bogem.desa.id',
        password: hashedPass,
        role: 'USER',
        isActive: false,
      },
    });
    testDisabledUserId = testDisabledUser.id;

    await authorize(
      { email: 'disabled_test@bogem.desa.id', password: 'dummy123' },
      {} as any
    );
    results.push({
      step: '5. Penolakan Akun Nonaktif (isActive: false)',
      status: 'FAIL',
      detail: 'Sistem meloloskan akun yang telah dinonaktifkan!',
    });
  } catch (err: any) {
    if (err.message.includes('Akun Anda dinonaktifkan')) {
      results.push({
        step: '5. Penolakan Akun Nonaktif (isActive: false)',
        status: 'PASS',
        detail: `Ditolak dengan pesan: "${err.message}"`,
      });
    } else {
      results.push({
        step: '5. Penolakan Akun Nonaktif (isActive: false)',
        status: 'FAIL',
        detail: `Pesan tidak sesuai: "${err.message}"`,
      });
    }
  } finally {
    if (testDisabledUserId) {
      await prisma.user.delete({ where: { id: testDisabledUserId } });
      console.log('   ✓ Akun uji coba nonaktif berhasil dibersihkan (Steril)');
    }
  }

  // 6. Uji Logika RBAC di Middleware & Helper Session
  try {
    const jwtCallback = authOptions.callbacks?.jwt;
    const sessionCallback = authOptions.callbacks?.session;

    if (!jwtCallback || !sessionCallback) {
      throw new Error('JWT / Session callbacks not found');
    }

    const mockAdminUser = { id: 'usr-admin-1', name: 'Admin', email: 'admin@bogem.desa.id', role: 'ADMIN' as const };
    const token = await jwtCallback({ token: {}, user: mockAdminUser as any });
    const session = await sessionCallback({ session: { user: {} as any, expires: '' }, token });

    if (session.user?.role === 'ADMIN' && session.user?.id === 'usr-admin-1') {
      results.push({
        step: '6. Integritas Session & JWT Role Mapping',
        status: 'PASS',
        detail: `Role ${session.user.role} dan ID ${session.user.id} terpetakan sempurna ke dalam Session`,
      });
    } else {
      results.push({
        step: '6. Integritas Session & JWT Role Mapping',
        status: 'FAIL',
        detail: 'Role atau ID tidak terpetakan dengan benar',
      });
    }
  } catch (err: any) {
    results.push({
      step: '6. Integritas Session & JWT Role Mapping',
      status: 'FAIL',
      detail: `Error: ${err.message}`,
    });
  }

  console.log('\n--- HASIL PENGUJIAN FASE 1 ---');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.step} -> ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  if (!allPass) {
    throw new Error('Fase 1 memiliki pengujian yang gagal!');
  }
  console.log('\n🎉 FASE 1: SEMUA TEST OTENTIKASI & KEAMANAN LULUS 100%!');
}

testPhase1()
  .catch((e) => {
    console.error('Fatal error in Phase 1:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
