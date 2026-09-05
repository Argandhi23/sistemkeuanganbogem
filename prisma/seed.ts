import {
  PrismaClient,
  Role,
  TransactionType,
  OrderStatus,
  AccountCategory,
  BusinessUnit,
  MolenStatus,
  CattleStatus,
  CattleGender,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data & Chart of Accounts for BUMDes Desa Bogem (Multi-Unit)...');

  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
  const hashedPasswordPetugas = await bcrypt.hash('petugas123', 10);

  // 1. Seed Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bogem.desa.id' },
    update: {},
    create: {
      name: 'Bapak Sugeng (Ketua BUMDes)',
      email: 'admin@bogem.desa.id',
      password: hashedPasswordAdmin,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  // 2. Seed User / Petugas
  const user = await prisma.user.upsert({
    where: { email: 'petugas@bogem.desa.id' },
    update: {},
    create: {
      name: 'Ibu Sri (Bendahara BUMDes)',
      email: 'petugas@bogem.desa.id',
      password: hashedPasswordPetugas,
      role: Role.USER,
      isActive: true,
    },
  });

  console.log('Users seeded:');
  console.log(`- Admin: ${admin.email} (Password: admin123)`);
  console.log(`- Petugas: ${user.email} (Password: petugas123)`);

  // 3. Seed Chart of Accounts (COA) 4-Digit Lengkap SAK EMKM BUMDes Bogem Multi Unit
  const defaultAccounts = [
    // 1xxx - ASET (AKTIVA)
    { code: '1001', name: 'Kas Tunai', category: AccountCategory.ASET, businessUnit: BusinessUnit.UMUM },
    { code: '1002', name: 'Bank / Rekening Operasional BUMDes', category: AccountCategory.ASET, businessUnit: BusinessUnit.UMUM },
    { code: '1003', name: 'Piutang Usaha Catering & Sewa', category: AccountCategory.ASET, businessUnit: BusinessUnit.CATERING },
    { code: '1004', name: 'Persediaan Bahan Baku & Bumbu Masak', category: AccountCategory.ASET, businessUnit: BusinessUnit.CATERING },
    { code: '1005', name: 'Perlengkapan Usaha & Kemasan', category: AccountCategory.ASET, businessUnit: BusinessUnit.CATERING },
    { code: '1201', name: 'Aset Peralatan & Mesin Molen', category: AccountCategory.ASET, businessUnit: BusinessUnit.RENTAL_MOLEN },
    { code: '1202', name: 'Aset Jaringan & Router WiFi Desa', category: AccountCategory.ASET, businessUnit: BusinessUnit.WIFI_DESA },
    { code: '1203', name: 'Aset Biologis (Ternak Sapi)', category: AccountCategory.ASET, businessUnit: BusinessUnit.KETAHANAN_PANGAN },
    { code: '1209', name: 'Akumulasi Penyusutan Peralatan', category: AccountCategory.ASET, businessUnit: BusinessUnit.UMUM },

    // 2xxx - KEWAJIBAN (UTANG)
    { code: '2001', name: 'Utang Usaha / Supplier', category: AccountCategory.KEWAJIBAN, businessUnit: BusinessUnit.UMUM },
    { code: '2002', name: 'Utang Pinjaman (Bank / Pihak Ketiga)', category: AccountCategory.KEWAJIBAN, businessUnit: BusinessUnit.UMUM },

    // 3xxx - EKUITAS (MODAL)
    { code: '3001', name: 'Modal Usaha / Modal Awal BUMDes', category: AccountCategory.MODAL, businessUnit: BusinessUnit.UMUM },
    { code: '3002', name: 'Laba Ditahan', category: AccountCategory.MODAL, businessUnit: BusinessUnit.UMUM },
    { code: '3003', name: 'Penyertaan Modal Desa / Ketahanan Pangan', category: AccountCategory.MODAL, businessUnit: BusinessUnit.KETAHANAN_PANGAN },
    { code: '3004', name: 'Bagi Hasil PADes ke Kas Desa', category: AccountCategory.MODAL, businessUnit: BusinessUnit.UMUM },

    // 4xxx - PENDAPATAN (PER UNIT USAHA)
    // 4.1 Catering
    { code: '4001', name: 'Pendapatan Catering (Nasi Box, Prasmanan, Snack)', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.CATERING },
    { code: '4002', name: 'Pendapatan Usaha Lain-lain', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.UMUM },
    { code: '4003', name: 'Pendapatan Sewa Peralatan Catering', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.CATERING },
    // 4.2 Rental Molen
    { code: '4010', name: 'Pendapatan Sewa Mesin Molen', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.RENTAL_MOLEN },
    // 4.3 WiFi Balai Desa
    { code: '4020', name: 'Pendapatan Retribusi / Iuran WiFi Balai Desa', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.WIFI_DESA },
    // 4.4 PPOB Loket Desa
    { code: '4030', name: 'Pendapatan Margin & Admin Fee PPOB', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.PPOB },
    // 4.5 Ketahanan Pangan (Peternakan Sapi)
    { code: '4040', name: 'Pendapatan Penjualan Ternak Sapi', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.KETAHANAN_PANGAN },
    { code: '4101', name: 'Pendapatan Bunga Bank & Jasa Giro', category: AccountCategory.PENDAPATAN, businessUnit: BusinessUnit.UMUM },

    // 5xxx - BEBAN OPERASIONAL (PER UNIT USAHA)
    // 5.1 Catering
    { code: '5001', name: 'Beban Bahan Baku Catering (Beras, Daging, Bumbu)', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.CATERING },
    { code: '5002', name: 'Beban Perlengkapan & Kemasan Box Snack', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.CATERING },
    { code: '5003', name: 'Beban Upah Masak & Tenaga Kerja Catering', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.CATERING },
    { code: '5004', name: 'Beban Gas Elpiji, Listrik & Air Dapur Catering', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.CATERING },
    // 5.2 Rental Molen
    { code: '5011', name: 'Beban Pemeliharaan, Oli & Sparepart Molen', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.RENTAL_MOLEN },
    { code: '5012', name: 'Beban Bahan Bakar / Solar Mesin Molen', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.RENTAL_MOLEN },
    // 5.3 WiFi Balai Desa
    { code: '5021', name: 'Beban Langganan Bandwidth & Upstream ISP', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.WIFI_DESA },
    { code: '5022', name: 'Beban Pemeliharaan Jaringan & Kabel WiFi', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.WIFI_DESA },
    // 5.4 PPOB
    { code: '5031', name: 'Beban Operasional & Kertas Struk PPOB', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.PPOB },
    // 5.5 Ketahanan Pangan (Ternak Sapi)
    { code: '5041', name: 'Beban Pakan Konsentrat & Rumput Sapi', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.KETAHANAN_PANGAN },
    { code: '5042', name: 'Beban Vaksin, Vitamin & Dokter Hewan Sapi', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.KETAHANAN_PANGAN },
    { code: '5043', name: 'Beban Pemeliharaan Kandang & Upah Peternak', category: AccountCategory.BEBAN_OPERASIONAL, businessUnit: BusinessUnit.KETAHANAN_PANGAN },

    // 6xxx - BEBAN NON-OPERASIONAL
    { code: '6001', name: 'Beban Administrasi Bank & Non-Operasional', category: AccountCategory.BEBAN_NON_OPERASIONAL, businessUnit: BusinessUnit.UMUM },
  ];

  const accountMap: Record<string, string> = {};
  for (const acc of defaultAccounts) {
    const createdAcc = await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name, category: acc.category, businessUnit: acc.businessUnit, isActive: true },
      create: acc,
    });
    accountMap[acc.code] = createdAcc.id;
  }
  console.log(`Seeded ${defaultAccounts.length} standard accounts across all 5 Business Units.`);

  // 4. Seed Molen Units if empty
  const countMolen = await prisma.molenUnit.count();
  if (countMolen === 0) {
    await prisma.molenUnit.createMany({
      data: [
        {
          code: 'MLN-01',
          name: 'Molen Beton Tiger 500L (Honda GX200)',
          dailyRate: 150000,
          status: MolenStatus.TERSEDIA,
          condition: 'Kondisi prima, oli baru',
          notes: 'Ditempatkan di Gudang BUMDes samping balai desa',
        },
        {
          code: 'MLN-02',
          name: 'Molen Beton Hercules 350L (Mesin Diesel 7PK)',
          dailyRate: 120000,
          status: MolenStatus.TERSEDIA,
          condition: 'Normal siap pakai',
          notes: 'Cocok untuk proyek cor jalan kampung / rumah warga',
        },
      ],
    });
    console.log('Sample Molen units seeded.');
  }

  // 5. Seed WiFi Plans if empty
  const countWifiPlans = await prisma.wifiPlan.count();
  if (countWifiPlans === 0) {
    await prisma.wifiPlan.createMany({
      data: [
        {
          name: 'Paket Warga Hemat',
          speed: '10 Mbps',
          price: 100000,
          description: 'Akses internet cepat hemat untuk rumah tangga',
          isActive: true,
        },
        {
          name: 'Paket Usaha & Keluarga',
          speed: '20 Mbps',
          price: 150000,
          description: 'Optimal untuk warung, streaming & kebutuhan keluarga',
          isActive: true,
        },
        {
          name: 'Paket Balai & Kantor Desa',
          speed: '50 Mbps',
          price: 300000,
          description: 'Koneksi dedicated balai desa & fasilitas publik',
          isActive: true,
        },
      ],
    });
    console.log('Sample WiFi plans seeded.');
  }

  // 6. Seed Sample Cattle (Sapi) if empty
  const countCattle = await prisma.cattle.count();
  if (countCattle === 0) {
    await prisma.cattle.createMany({
      data: [
        {
          tagNumber: 'SP-BGM-01',
          name: 'Si Bima',
          breed: 'Simental Super',
          gender: CattleGender.JANTAN,
          status: CattleStatus.PENGGEMUKAN,
          purchaseDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          purchasePrice: 16500000,
          initialWeight: 280,
          currentWeight: 375,
          lastWeighedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          notes: 'Program Ketahanan Pangan Desa Bogem 2026',
        },
        {
          tagNumber: 'SP-BGM-02',
          name: 'Si Arjuna',
          breed: 'Limousin Cross',
          gender: CattleGender.JANTAN,
          status: CattleStatus.SIAP_JUAL,
          purchaseDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
          purchasePrice: 17000000,
          initialWeight: 310,
          currentWeight: 440,
          lastWeighedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          notes: 'Siap panen kurban / pesanan peternak',
        },
      ],
    });
    console.log('Sample Cattle records seeded.');
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
