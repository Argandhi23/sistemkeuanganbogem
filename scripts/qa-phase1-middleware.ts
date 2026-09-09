import middleware from '../src/middleware';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];
const secret = process.env.NEXTAUTH_SECRET || 'bumdes-bogem-catering-secret-key-super-secure-2026';
process.env.NEXTAUTH_SECRET = secret;

async function createAuthRequest(path: string, method: string = 'GET', tokenPayload: any = null): Promise<NextRequest> {
  const url = `http://localhost:3000${path}`;
  const req = new NextRequest(url, { method });
  if (tokenPayload) {
    const sessionToken = await encode({ token: tokenPayload, secret });
    req.cookies.set('next-auth.session-token', sessionToken);
  }
  return req;
}

async function testMiddleware() {
  console.log('===============================================================');
  console.log('🧪 FASE 1.2: PENGUJIAN MIDDLEWARE & ROLE ACCESS ISOLATION');
  console.log('===============================================================\n');

  const adminToken = { id: 'admin-id', role: 'ADMIN', name: 'Admin BUMDes' };
  const cateringToken = { id: 'catering-id', role: 'CATERING', name: 'Petugas Catering' };

  // 1. Admin akses /users (diizinkan -> next())
  const req1 = await createAuthRequest('/users', 'GET', adminToken);
  const res1 = await (middleware as any)(req1);
  const loc1 = res1?.headers.get('location');
  if (!loc1 && res1?.status === 200) {
    results.push({
      step: '1. Admin Akses Halaman Admin (/users)',
      status: 'PASS',
      detail: 'Admin diizinkan mengakses halaman manajemen pengguna',
    });
  } else {
    results.push({
      step: '1. Admin Akses Halaman Admin (/users)',
      status: 'FAIL',
      detail: `Admin dialihkan: ${loc1 || res1?.status}`,
    });
  }

  // 2. Catering akses /users (harus diblokir / dialihkan ke /units/catering)
  const req2 = await createAuthRequest('/users', 'GET', cateringToken);
  const res2 = await (middleware as any)(req2);
  const loc2 = res2?.headers.get('location');
  if (loc2 && loc2.includes('/units/catering')) {
    results.push({
      step: '2. Catering Akses Halaman Admin (/users)',
      status: 'PASS',
      detail: 'Petugas Catering dicegah dan dialihkan otomatis ke /units/catering',
    });
  } else {
    results.push({
      step: '2. Catering Akses Halaman Admin (/users)',
      status: 'FAIL',
      detail: `Tidak dialihkan ke /units/catering: ${loc2 || res2?.status}`,
    });
  }

  // 3. Catering akses API admin (/api/users - harus ditolak 403)
  const req3 = await createAuthRequest('/api/users', 'GET', cateringToken);
  const res3 = await (middleware as any)(req3);
  if (res3?.status === 403) {
    results.push({
      step: '3. Catering Akses API Admin (/api/users)',
      status: 'PASS',
      detail: 'Ditolak dengan HTTP 403 Forbidden',
    });
  } else {
    results.push({
      step: '3. Catering Akses API Admin (/api/users)',
      status: 'FAIL',
      detail: `Status yang didapat: ${res3?.status}`,
    });
  }

  // 4. Catering akses unit lain (/units/molen - harus dialihkan ke /units/catering)
  const req4 = await createAuthRequest('/units/molen', 'GET', cateringToken);
  const res4 = await (middleware as any)(req4);
  const loc4 = res4?.headers.get('location');
  if (loc4 && loc4.includes('/units/catering')) {
    results.push({
      step: '4. Catering Akses Halaman Unit Usaha Lain (/units/molen)',
      status: 'PASS',
      detail: 'Dicegah mengakses unit lain dan dialihkan ke unit catering',
    });
  } else {
    results.push({
      step: '4. Catering Akses Halaman Unit Usaha Lain (/units/molen)',
      status: 'FAIL',
      detail: `Tidak dialihkan dengan tepat: ${loc4}`,
    });
  }

  // 5. Catering akses API unit lain (/api/units/molen - harus 403)
  const req5 = await createAuthRequest('/api/units/molen', 'GET', cateringToken);
  const res5 = await (middleware as any)(req5);
  if (res5?.status === 403) {
    results.push({
      step: '5. Catering Akses API Unit Lain (/api/units/molen)',
      status: 'PASS',
      detail: 'Ditolak dengan HTTP 403 Forbidden',
    });
  } else {
    results.push({
      step: '5. Catering Akses API Unit Lain (/api/units/molen)',
      status: 'FAIL',
      detail: `Status yang didapat: ${res5?.status}`,
    });
  }

  // 6. Catering akses unitnya sendiri (/units/catering - diizinkan -> next())
  const req6 = await createAuthRequest('/units/catering', 'GET', cateringToken);
  const res6 = await (middleware as any)(req6);
  const loc6 = res6?.headers.get('location');
  if (!loc6 && res6?.status === 200) {
    results.push({
      step: '6. Catering Akses Unitnya Sendiri (/units/catering)',
      status: 'PASS',
      detail: 'Petugas Catering dapat mengakses modul Catering tanpa kendala',
    });
  } else {
    results.push({
      step: '6. Catering Akses Unitnya Sendiri (/units/catering)',
      status: 'FAIL',
      detail: `Malah dialihkan: ${loc6 || res6?.status}`,
    });
  }

  // 7. Unauthenticated user akses /transaksi (harus dialihkan ke /login)
  const req7 = await createAuthRequest('/transaksi', 'GET', null);
  const res7 = await (middleware as any)(req7);
  const loc7 = res7?.headers.get('location');
  if (loc7 && loc7.includes('/login')) {
    results.push({
      step: '7. Tamu Tanpa Login Akses Fitur Terproteksi (/transaksi)',
      status: 'PASS',
      detail: 'Dicegah dan diarahkan login ke /login',
    });
  } else {
    results.push({
      step: '7. Tamu Tanpa Login Akses Fitur Terproteksi (/transaksi)',
      status: 'FAIL',
      detail: `Tamu tidak dialihkan ke login: ${loc7 || res7?.status}`,
    });
  }

  console.log('\n--- HASIL PENGUJIAN FASE 1.2 (MIDDLEWARE RBAC) ---');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.step} -> ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  if (!allPass) {
    throw new Error('Pengujian Middleware RBAC gagal!');
  }
  console.log('\n🎉 FASE 1.2: SEMUA RULE MIDDLEWARE RBAC TERVERIFIKASI AMAN 100%!');
}

testMiddleware().catch((err) => {
  console.error(err);
  process.exit(1);
});
