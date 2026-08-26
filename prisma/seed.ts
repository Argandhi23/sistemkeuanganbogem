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
    { code: '1001', name: 'Kas Tunai', category: AccountCategory.ASET },
    { code: '1002', name: 'Bank / Rekening Operasional', category: AccountCategory.ASET },
    { code: '1003', name: 'Piutang Usaha Catering', category: AccountCategory.ASET },
    { code: '1004', name: 'Persediaan Bahan Baku & Bumbu', category: AccountCategory.ASET },
    { code: '1005', name: 'Peralatan & Perlengkapan Catering', category: AccountCategory.ASET },

    // 2xxx - KEWAJIBAN (UTANG)
    { code: '2001', name: 'Utang Usaha / Supplier', category: AccountCategory.KEWAJIBAN },

    // 3xxx - EKUITAS (MODAL)
    { code: '3001', name: 'Modal Usaha / Modal Awal BUMDes', category: AccountCategory.MODAL },
    { code: '3002', name: 'Laba Ditahan', category: AccountCategory.MODAL },

    // 4xxx - PENDAPATAN
    { code: '4001', name: 'Pendapatan Catering', category: AccountCategory.PENDAPATAN },
    { code: '4002', name: 'Pendapatan Usaha Lain-lain', category: AccountCategory.PENDAPATAN },

    // 5xxx - BEBAN OPERASIONAL
    { code: '5001', name: 'Beban Bahan Baku Makanan', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5002', name: 'Beban Upah & Tenaga Kerja Masak', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5003', name: 'Beban Kemasan, Box & Plastik', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5004', name: 'Beban Transportasi & Pengantaran', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5005', name: 'Beban Gas Elpiji, Listrik & Air', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '5006', name: 'Beban Operasional Lain-lain', category: AccountCategory.BEBAN_OPERASIONAL },
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
