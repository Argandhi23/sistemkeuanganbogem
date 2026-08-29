import { PrismaClient, Role, TransactionType, OrderStatus, AccountCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data & Chart of Accounts for BUMDes Catering Desa Bogem...');

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
      name: 'Ibu Sri (Pengurus Catering)',
      email: 'petugas@bogem.desa.id',
      password: hashedPasswordPetugas,
      role: Role.USER,
      isActive: true,
    },
  });

  console.log('Users seeded:');
  console.log(`- Admin: ${admin.email} (Password: admin123)`);
  console.log(`- Petugas: ${user.email} (Password: petugas123)`);

  // 3. Seed Chart of Accounts (COA) 4-Digit Lengkap SAK EMKM BUMDes Bogem
  const defaultAccounts = [
    // 1xxx - ASET (AKTIVA)
    // 1.1 Aset Lancar
    { code: '1001', name: 'Kas Tunai', category: AccountCategory.ASET },
    { code: '1002', name: 'Bank / Rekening Operasional', category: AccountCategory.ASET },
    { code: '1003', name: 'Piutang Usaha Catering', category: AccountCategory.ASET },
    { code: '1004', name: 'Persediaan Bahan Baku & Bumbu Masak', category: AccountCategory.ASET },
    { code: '1005', name: 'Perlengkapan Usaha & Kemasan', category: AccountCategory.ASET },
    // 1.2 Aset Tetap
    { code: '1201', name: 'Peralatan & Mesin Catering', category: AccountCategory.ASET },
    { code: '1209', name: 'Akumulasi Penyusutan Peralatan', category: AccountCategory.ASET },

    // 2xxx - KEWAJIBAN (UTANG)
    { code: '2001', name: 'Utang Usaha / Supplier', category: AccountCategory.KEWAJIBAN },
    { code: '2002', name: 'Utang Pinjaman (Bank / Pihak Ketiga)', category: AccountCategory.KEWAJIBAN },

    // 3xxx - EKUITAS (MODAL)
    { code: '3001', name: 'Modal Usaha / Modal Awal BUMDes', category: AccountCategory.MODAL },
    { code: '3002', name: 'Laba Ditahan', category: AccountCategory.MODAL },
    { code: '3003', name: 'Penyertaan Modal Tambahan Desa / Hibah', category: AccountCategory.MODAL },
    { code: '3004', name: 'Bagi Hasil PADes ke Kas Desa', category: AccountCategory.MODAL },

    // 4xxx - PENDAPATAN
    { code: '4001', name: 'Pendapatan Catering (Nasi Box, Prasmanan, Snack)', category: AccountCategory.PENDAPATAN },
    { code: '4002', name: 'Pendapatan Usaha Lain-lain', category: AccountCategory.PENDAPATAN },
    { code: '4003', name: 'Pendapatan Sewa Peralatan & Perlengkapan Catering', category: AccountCategory.PENDAPATAN },
    { code: '4004', name: 'Pendapatan Jasa Pengantaran / Ongkir', category: AccountCategory.PENDAPATAN },
    { code: '4101', name: 'Pendapatan Bunga Bank & Jasa Giro', category: AccountCategory.PENDAPATAN },

    // 5xxx - BEBAN OPERASIONAL (HPP & BEBAN USAHA)
    { code: '5001', name: 'Beban Bahan Baku Makanan (Beras, Daging, Bumbu)', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5002', name: 'Beban Perlengkapan & Kemasan (Box, Plastik, Sendok)', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5003', name: 'Beban Upah & Tenaga Kerja Masak (Tukang Masak, Rewang)', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5004', name: 'Beban Pemeliharaan & Servis Peralatan Masak', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5005', name: 'Beban Transportasi, Bensin & Pengantaran', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5006', name: 'Beban Gas Elpiji, Listrik & Air', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5007', name: 'Beban Operasional Lain-lain', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5008', name: 'Beban Pengembalian Dana / Diskon Pelanggan', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5009', name: 'Beban Pemasaran, Spanduk & Promosi', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5010', name: 'Beban Kebersihan, Sampah & Retribusi Lingkungan', category: AccountCategory.BEBAN_OPERASIONAL },

    // 6xxx - BEBAN NON-OPERASIONAL
    { code: '6001', name: 'Beban Administrasi Bank & Non-Operasional', category: AccountCategory.BEBAN_NON_OPERASIONAL },
  ];

  const accountMap: Record<string, string> = {};
  for (const acc of defaultAccounts) {
    const createdAcc = await prisma.account.upsert({
      where: { code: acc.code },
      update: { name: acc.name, category: acc.category, isActive: true },
      create: acc,
    });
    accountMap[acc.code] = createdAcc.id;
  }
  console.log(`Seeded ${defaultAccounts.length} standard accounts in Chart of Accounts.`);

  // 3.5. Bersihkan & Hapus seluruh akun 3-digit lama dari database
  const old3DigitCodes = [
    '101', '102', '103', '104', '105',
    '201',
    '301', '302',
    '401', '402',
    '501', '502', '503', '504', '505', '506'
  ];

  for (const oldCode of old3DigitCodes) {
    const newCode = oldCode[0] + '00' + oldCode.slice(1);
    const newAccId = accountMap[newCode];
    const oldAcc = await prisma.account.findUnique({ where: { code: oldCode } });

    if (oldAcc && newAccId) {
      await prisma.transaction.updateMany({
        where: { accountId: oldAcc.id },
        data: { accountId: newAccId },
      });
    }
  }

  const deleteResult = await prisma.account.deleteMany({
    where: { code: { in: old3DigitCodes } },
  });
  console.log(`Cleaned up ${deleteResult.count} legacy 3-digit accounts from database.`);

  // 4. Seed Sample Transactions if empty
  const countTransactions = await prisma.transaction.count();
  if (countTransactions === 0) {
    await prisma.transaction.createMany({
      data: [
        {
          type: TransactionType.PEMASUKAN,
          category: 'Pendapatan Catering',
          accountId: accountMap['4001'],
          description: 'Pembayaran DP Pesanan Prasmanan Pernikahan Bu Rini',
          amount: 2500000,
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          type: TransactionType.PENGELUARAN,
          category: 'Beban Bahan Baku Makanan',
          accountId: accountMap['5001'],
          description: 'Beli beras 50kg, ayam potong 20kg, dan bumbu dapur di Pasar Bogem',
          amount: 1200000,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          type: TransactionType.PENGELUARAN,
          category: 'Beban Gas Elpiji, Listrik & Air',
          accountId: accountMap['5005'],
          description: 'Beli gas elpiji 3kg (4 tabung) dan token listrik dapur catering',
          amount: 180000,
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          type: TransactionType.PEMASUKAN,
          category: 'Pendapatan Catering',
          accountId: accountMap['4001'],
          description: 'Pelunasan Nasi Box Rapat Desa Bogem (100 Kotak)',
          amount: 2000000,
          date: new Date(),
          createdById: admin.id,
          syncedToSheet: false,
        },
      ],
    });
    console.log('Sample transactions created.');
  }

  // 5. Seed Sample Orders if empty
  const countOrders = await prisma.cateringOrder.count();
  if (countOrders === 0) {
    await prisma.cateringOrder.createMany({
      data: [
        {
          customerName: 'Pak RT 03 Bogem',
          customerPhone: '081234567890',
          eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          menuDetail: 'Nasi Kuning Komplit, Ayam Goreng Lengkuas, Sambal Goreng Ati, Kerupuk, Buah Pisang',
          portion: 80,
          totalPrice: 1600000,
          status: OrderStatus.DIPROSES,
          notes: 'Diantar ke balai RT 03 jam 11 siang tepat.',
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          customerName: 'Ibu Ratna (Arisan PKK)',
          customerPhone: '085712345678',
          eventDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          menuDetail: 'Snack Box (Lemper Ayam, Pastel Basah, Bolu Kukus, Air Mineral Cup)',
          portion: 50,
          totalPrice: 500000,
          status: OrderStatus.PENDING,
          notes: 'Box warna putih polos.',
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          customerName: 'Karang Taruna Bogem',
          customerPhone: '087899887766',
          eventDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          menuDetail: 'Nasi Liwet Sunda, Ayam Bakar Madu, Tahu Tempe, Lalapan, Es Teh Manis',
          portion: 120,
          totalPrice: 3000000,
          status: OrderStatus.SELESAI,
          notes: 'Sudah lunas dan acara selesai lancar.',
          createdById: admin.id,
          syncedToSheet: false,
        },
      ],
    });
    console.log('Sample catering orders created.');
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
