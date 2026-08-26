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

  // 3. Seed Chart of Accounts (COA) sesuai catatan standar BUMDes Bogem
  const defaultAccounts = [
    // 1xx - ASET
    { code: '101', name: 'Kas', category: AccountCategory.ASET },
    { code: '102', name: 'Bank / Rekening', category: AccountCategory.ASET },
    { code: '103', name: 'Piutang', category: AccountCategory.ASET },
    { code: '104', name: 'Persediaan bahan baku', category: AccountCategory.ASET },
    { code: '105', name: 'Peralatan catering', category: AccountCategory.ASET },

    // 2xx - KEWAJIBAN / UTANG
    { code: '201', name: 'Utang usaha', category: AccountCategory.KEWAJIBAN },

    // 3xx - EKUITAS / MODAL
    { code: '301', name: 'Modal usaha', category: AccountCategory.MODAL },
    { code: '302', name: 'Laba ditahan', category: AccountCategory.MODAL },

    // 4xx - PENDAPATAN
    { code: '401', name: 'Pendapatan catering', category: AccountCategory.PENDAPATAN },
    { code: '402', name: 'Pend. Usaha lain-lain', category: AccountCategory.PENDAPATAN },

    // 5xx - BEBAN OPERASIONAL
    { code: '501', name: 'Beban bahan baku', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '502', name: 'Beban tenaga kerja', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '503', name: 'Beban kemasan', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '504', name: 'Beban transportasi', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '505', name: 'Beban Gas, listrik & air', category: AccountCategory.BEBAN_OPERASIONAL },
    { code: '506', name: 'Beban lain-lain', category: AccountCategory.BEBAN_OPERASIONAL },
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
          category: 'Pendapatan catering',
          accountId: accountMap['401'],
          description: 'Pembayaran DP Pesanan Prasmanan Pernikahan Bu Rini',
          amount: 2500000,
          date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          type: TransactionType.PENGELUARAN,
          category: 'Beban bahan baku',
          accountId: accountMap['501'],
          description: 'Beli beras 50kg, ayam potong 20kg, dan bumbu dapur di Pasar Bogem',
          amount: 1200000,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          type: TransactionType.PENGELUARAN,
          category: 'Beban Gas, listrik & air',
          accountId: accountMap['505'],
          description: 'Beli gas elpiji 3kg (4 tabung) dan token listrik dapur catering',
          amount: 180000,
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          createdById: user.id,
          syncedToSheet: false,
        },
        {
          type: TransactionType.PEMASUKAN,
          category: 'Pendapatan catering',
          accountId: accountMap['401'],
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
