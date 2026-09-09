import { execSync } from 'child_process';

console.log('========================================================================');
console.log('🚀 MENJALANKAN SELURUH RANGKAIAN TEST SUITE QA PRA-LAUNCHING BUMDES');
console.log('========================================================================\n');

const testSuites = [
  { name: 'Fase 1.1: Otentikasi & Kredensial', script: 'scripts/qa-phase1-auth.ts' },
  { name: 'Fase 1.2: Middleware & Keamanan RBAC', script: 'scripts/qa-phase1-middleware.ts' },
  { name: 'Fase 2: Bagan Akun (COA) & Buku Kas', script: 'scripts/qa-phase2-coa-transaksi.ts' },
  { name: 'Fase 3: 5 Unit Usaha & Auto-Sync Kas', script: 'scripts/qa-phase3-multiunit.ts' },
  { name: 'Fase 4: Laporan Keuangan SAK EMKM', script: 'scripts/qa-phase4-financial-reports.ts' },
  { name: 'Fase 5: Ekspor Excel & Dashboard Stats', script: 'scripts/qa-phase5-export-dashboard.ts' },
  { name: 'Fase 6: User Management & Sterilisasi', script: 'scripts/qa-phase6-users-sterilization.ts' },
];

let allPassed = true;

for (const suite of testSuites) {
  console.log(`\n▶️ Menjalankan ${suite.name}...`);
  try {
    const output = execSync(`npx tsx ${suite.script}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ ${suite.name} GAGAL!`);
    allPassed = false;
    break;
  }
}

if (allPassed) {
  console.log('\n========================================================================');
  console.log('🎉 SEMUA 6 FASE PENGUJIAN BERHASIL 100% TANPA KESALAHAN ATAU RESIDU DATA!');
  console.log('========================================================================');
} else {
  process.exit(1);
}
