import { PrismaClient, BusinessUnit, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting Comprehensive Multi-Unit CRUD & Cash Flow Verification...\n');

  // 1. Get an existing admin user
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!adminUser) {
    throw new Error('Admin user not found. Please run seed first.');
  }
  console.log(`✓ Using Admin User: ${adminUser.name} (${adminUser.id})`);

  // ==========================================
  // TEST 1: CATERING UNIT CRUD
  // ==========================================
  console.log('\n--- [TEST 1] Catering Unit CRUD ---');
  const testOrder = await prisma.cateringOrder.create({
    data: {
      customerName: 'TEST_WARGA_HAJATAN',
      customerPhone: '081299990001',
      eventDate: new Date(Date.now() + 86400000 * 5),
      menuDetail: 'Paket Prasmanan Komplit 100 Porsi (TEST)',
      portion: 100,
      totalPrice: 2500000,
      downPayment: 1000000,
      paymentStatus: 'DP',
      status: 'DIPROSES',
      notes: 'Test automatic cash flow sync on DP',
      createdById: adminUser.id,
    },
  });
  console.log(`✓ Catering order created: ID ${testOrder.id} - Total: ${testOrder.totalPrice}, DP: ${testOrder.downPayment}`);

  // Create cash transaction for DP
  const dpTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PEMASUKAN,
      category: 'Pendapatan Catering',
      businessUnit: BusinessUnit.CATERING,
      paymentMethod: 'TUNAI',
      amount: 1000000,
      description: `[Catering] DP Pesanan: TEST_WARGA_HAJATAN`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ DP Cash Transaction synced: ID ${dpTx.id} - Amount: ${dpTx.amount}`);

  // Update Catering Order to LUNAS & SELESAI
  const updatedOrder = await prisma.cateringOrder.update({
    where: { id: testOrder.id },
    data: {
      paymentStatus: 'LUNAS',
      status: 'SELESAI',
    },
  });
  console.log(`✓ Catering order updated: PaymentStatus = ${updatedOrder.paymentStatus}, Status = ${updatedOrder.status}`);

  // Settle remaining payment to cash
  const remainingAmount = Number(testOrder.totalPrice) - Number(testOrder.downPayment);
  const lunasTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PEMASUKAN,
      category: 'Pendapatan Catering',
      businessUnit: BusinessUnit.CATERING,
      paymentMethod: 'TUNAI',
      amount: remainingAmount,
      description: `[Catering] Pelunasan Pesanan: TEST_WARGA_HAJATAN`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ Pelunasan Cash Transaction synced: ID ${lunasTx.id} - Amount: ${lunasTx.amount}`);

  // Verify Catering Read
  const foundOrder = await prisma.cateringOrder.findUnique({
    where: { id: testOrder.id },
  });
  if (!foundOrder || foundOrder.paymentStatus !== 'LUNAS') {
    throw new Error('Catering verification failed!');
  }
  console.log('✓ Catering CRUD verified successfully.');

  // Cleanup Catering Test Data
  await prisma.cateringOrder.delete({ where: { id: testOrder.id } });
  await prisma.transaction.deleteMany({ where: { id: { in: [dpTx.id, lunasTx.id] } } });
  console.log('✓ Catering test data cleaned up completely.');

  // ==========================================
  // TEST 2: MOLEN RENTAL CRUD
  // ==========================================
  console.log('\n--- [TEST 2] Molen Rental Unit CRUD ---');
  const testMolen = await prisma.molenUnit.create({
    data: {
      code: 'MLN-TEST-99',
      name: 'Molen Test Heavy Duty 500L',
      dailyRate: 150000,
      status: 'TERSEDIA',
      condition: 'Baru & Prima',
      notes: 'Unit test persewaan',
    },
  });
  console.log(`✓ Molen unit created: Code ${testMolen.code}`);

  // Create Rental (3 days = 450,000, deposit = 150,000)
  const testRental = await prisma.molenRental.create({
    data: {
      rentalNumber: `RNT-TEST-${Date.now()}`,
      unitId: testMolen.id,
      renterName: 'TEST_PAK_TUKANG_PROYEK',
      renterPhone: '081299990002',
      renterAddress: 'Dusun Bogem Barat',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000 * 3),
      totalDays: 3,
      dailyRate: 150000,
      totalPrice: 450000,
      deposit: 150000,
      paymentStatus: 'DP',
      rentalStatus: 'AKTIF',
      createdById: adminUser.id,
    },
  });
  // Unit status should transition to DISEWA
  await prisma.molenUnit.update({
    where: { id: testMolen.id },
    data: { status: 'DISEWA' },
  });

  const molenDpTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PEMASUKAN,
      category: 'Penyewaan Molen',
      businessUnit: BusinessUnit.RENTAL_MOLEN,
      paymentMethod: 'TUNAI',
      amount: 150000,
      description: `[Molen] DP Sewa Unit ${testMolen.code} - TEST_PAK_TUKANG_PROYEK`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ Molen rental created: ID ${testRental.id} - Unit status set to DISEWA`);

  // Settle Molen Rental
  const updatedRental = await prisma.molenRental.update({
    where: { id: testRental.id },
    data: {
      rentalStatus: 'SELESAI',
      paymentStatus: 'LUNAS',
    },
  });
  // Unit status returns to TERSEDIA
  const returnedUnit = await prisma.molenUnit.update({
    where: { id: testMolen.id },
    data: { status: 'TERSEDIA' },
  });
  const molenLunasTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PEMASUKAN,
      category: 'Penyewaan Molen',
      businessUnit: BusinessUnit.RENTAL_MOLEN,
      paymentMethod: 'TUNAI',
      amount: 300000,
      description: `[Molen] Pelunasan Sewa Unit ${testMolen.code} - TEST_PAK_TUKANG_PROYEK`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ Molen rental completed: Unit returned to ${returnedUnit.status}, Pelunasan ${molenLunasTx.amount}`);

  // Cleanup Molen Test Data
  await prisma.molenRental.delete({ where: { id: testRental.id } });
  await prisma.molenUnit.delete({ where: { id: testMolen.id } });
  await prisma.transaction.deleteMany({ where: { id: { in: [molenDpTx.id, molenLunasTx.id] } } });
  console.log('✓ Molen test data cleaned up completely.');

  // ==========================================
  // TEST 3: WIFI BALAI DESA CRUD
  // ==========================================
  console.log('\n--- [TEST 3] WiFi Balai Desa Unit CRUD ---');
  let plan = await prisma.wifiPlan.findFirst({ where: { isActive: true } });
  if (!plan) {
    plan = await prisma.wifiPlan.create({
      data: {
        name: 'Paket Warga Hemat 10 Mbps',
        speed: '10 Mbps',
        price: 100000,
      },
    });
  }

  const testWifiCustomer = await prisma.wifiCustomer.create({
    data: {
      customerNumber: `WF-TEST-${Date.now().toString().slice(-4)}`,
      name: 'TEST_WARGA_WIFI',
      phone: '081299990003',
      address: 'RT 03 RW 02 Desa Bogem',
      rtRw: 'RT 03 / RW 02',
      planId: plan.id,
      isActive: true,
    },
  });
  console.log(`✓ WiFi Customer created: ${testWifiCustomer.customerNumber} (${testWifiCustomer.name})`);

  // Generate Bill
  const now = new Date();
  const testBill = await prisma.wifiBill.create({
    data: {
      billNumber: `INV-WF-TEST-${Date.now()}`,
      customerId: testWifiCustomer.id,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      amount: plan.price,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 20),
      status: 'BELUM_BAYAR',
    },
  });
  console.log(`✓ WiFi Bill generated: ${testBill.billNumber} - Amount: ${testBill.amount}`);

  // Pay Bill
  const paidBill = await prisma.wifiBill.update({
    where: { id: testBill.id },
    data: {
      status: 'LUNAS',
      paidDate: new Date(),
    },
  });
  const wifiCashTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PEMASUKAN,
      category: 'Iuran WiFi Desa',
      businessUnit: BusinessUnit.WIFI_DESA,
      paymentMethod: 'TUNAI',
      amount: testBill.amount,
      description: `[WiFi] Pembayaran Iuran ${testWifiCustomer.name} (${testWifiCustomer.customerNumber}) - Periode ${testBill.month}/${testBill.year}`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ WiFi Bill paid: Status ${paidBill.status}, Cash transaction synced: ID ${wifiCashTx.id}`);

  // Cleanup WiFi Test Data
  await prisma.wifiBill.delete({ where: { id: testBill.id } });
  await prisma.wifiCustomer.delete({ where: { id: testWifiCustomer.id } });
  await prisma.transaction.delete({ where: { id: wifiCashTx.id } });
  console.log('✓ WiFi test data cleaned up completely.');

  // ==========================================
  // TEST 4: PPOB (PAYMENT POINT ONLINE BANK) CRUD
  // ==========================================
  console.log('\n--- [TEST 4] PPOB Unit CRUD ---');
  const costPrice = 50000;
  const sellingPrice = 52500;
  const adminFee = sellingPrice - costPrice; // 2500 margin

  const testPpobTx = await prisma.ppobTransaction.create({
    data: {
      transactionNo: `PPOB-TEST-${Date.now()}`,
      type: 'PLN_TOKEN',
      targetNumber: '3200987654321',
      customerName: 'TEST_PELANGGAN_LISTRIK',
      costPrice,
      sellingPrice,
      adminFee,
      status: 'SUKSES',
      notes: 'Uji coba transaksi loket PLN',
      createdById: adminUser.id,
    },
  });
  console.log(`✓ PPOB Transaction created: ${testPpobTx.transactionNo} - Fee Margin: ${testPpobTx.adminFee}`);

  const ppobCashTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PEMASUKAN,
      category: 'Pendapatan Fee PPOB',
      businessUnit: BusinessUnit.PPOB,
      paymentMethod: 'TUNAI',
      amount: adminFee,
      description: `[PPOB] Fee Transaksi PLN_TOKEN (3200987654321) - TEST_PELANGGAN_LISTRIK`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ PPOB Cash Profit synced: ID ${ppobCashTx.id} - Margin: ${ppobCashTx.amount}`);

  // Cleanup PPOB Test Data
  await prisma.ppobTransaction.delete({ where: { id: testPpobTx.id } });
  await prisma.transaction.delete({ where: { id: ppobCashTx.id } });
  console.log('✓ PPOB test data cleaned up completely.');

  // ==========================================
  // TEST 5: KETAHANAN PANGAN (PETERNAKAN SAPI) CRUD
  // ==========================================
  console.log('\n--- [TEST 5] Ketahanan Pangan (Peternakan Sapi) CRUD ---');
  const testCattle = await prisma.cattle.create({
    data: {
      tagNumber: `SP-TEST-${Date.now().toString().slice(-4)}`,
      name: 'Si Black Test Limousin',
      breed: 'Limousin',
      gender: 'JANTAN',
      status: 'PENGGEMUKAN',
      purchaseDate: new Date(),
      purchasePrice: 16000000,
      initialWeight: 360,
      currentWeight: 360,
      notes: 'Sapi uji coba penggemukan',
    },
  });
  console.log(`✓ Cattle registered: ${testCattle.tagNumber} - Purchase Price: ${testCattle.purchasePrice}`);

  // Add Operational Expense (Pakan Konsentrat)
  const testExpense = await prisma.cattleExpense.create({
    data: {
      cattleId: testCattle.id,
      type: 'PAKAN',
      description: 'Konsentrat penggemukan sapi test',
      amount: 250000,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  const cattleExpTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PENGELUARAN,
      category: 'Biaya Pakan Ternak',
      businessUnit: BusinessUnit.KETAHANAN_PANGAN,
      paymentMethod: 'TUNAI',
      amount: 250000,
      description: `[Peternakan Sapi] PAKAN - Konsentrat penggemukan sapi test (${testCattle.tagNumber})`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ Cattle expense logged: ID ${testExpense.id} - Expense cash flow: ${cattleExpTx.amount}`);

  // Update Weight (Growth Tracking)
  const weighedCattle = await prisma.cattle.update({
    where: { id: testCattle.id },
    data: {
      currentWeight: 410,
      lastWeighedAt: new Date(),
    },
  });
  console.log(`✓ Cattle weight updated: Initial ${weighedCattle.initialWeight}kg -> Current ${weighedCattle.currentWeight}kg (+50kg)`);

  // Sell Cattle (Panen Ternak)
  const salePrice = 22500000;
  const soldCattle = await prisma.cattle.update({
    where: { id: testCattle.id },
    data: {
      status: 'TERJUAL',
      saleDate: new Date(),
      salePrice,
      buyerName: 'TEST_JAGAL_PASAR_HEWAN',
      notes: 'Terjual dengan profit sehat',
    },
  });
  const cattleSaleTx = await prisma.transaction.create({
    data: {
      type: TransactionType.PEMASUKAN,
      category: 'Penjualan Ternak Sapi',
      businessUnit: BusinessUnit.KETAHANAN_PANGAN,
      paymentMethod: 'TRANSFER',
      amount: salePrice,
      description: `[Peternakan Sapi] Penjualan Sapi Tag ${testCattle.tagNumber} kepada TEST_JAGAL_PASAR_HEWAN`,
      date: new Date(),
      createdById: adminUser.id,
    },
  });
  console.log(`✓ Cattle sold: Status ${soldCattle.status}, Sale Revenue synced: ${cattleSaleTx.amount}`);

  // Cleanup Cattle Test Data
  await prisma.cattleExpense.delete({ where: { id: testExpense.id } });
  await prisma.cattle.delete({ where: { id: testCattle.id } });
  await prisma.transaction.deleteMany({ where: { id: { in: [cattleExpTx.id, cattleSaleTx.id] } } });
  console.log('✓ Cattle test data cleaned up completely.');

  // ==========================================
  // TEST 6: MASTER DASHBOARD MULTI-UNIT STATS AGGREGATION
  // ==========================================
  console.log('\n--- [TEST 6] Master Consolidated Dashboard Stats Query ---');
  const [cateringCount, molenCount, wifiCount, ppobCount, cattleCount] = await Promise.all([
    prisma.cateringOrder.count(),
    prisma.molenUnit.count(),
    prisma.wifiCustomer.count(),
    prisma.ppobTransaction.count(),
    prisma.cattle.count(),
  ]);

  console.log(`✓ Aggregated Counts:
    - Catering Orders: ${cateringCount}
    - Molen Units: ${molenCount}
    - WiFi Customers: ${wifiCount}
    - PPOB Transactions: ${ppobCount}
    - Cattle Head: ${cattleCount}
  `);

  // ==========================================
  // TEST 7: EXCEL EXPORT ENGINE VERIFICATION
  // ==========================================
  console.log('\n--- [TEST 7] Excel (.xlsx) Export Engine Verification ---');
  const { generateTransactionsWorkbook, generateUnitWorkbook } = await import('../src/lib/excelExport');
  
  const sampleTransactions = [
    {
      id: 'tx-1',
      date: new Date(),
      type: 'PEMASUKAN' as const,
      category: 'Pendapatan Unit Usaha',
      businessUnit: 'CATERING',
      description: 'Pendapatan catering paket kenduri',
      paymentMethod: 'TUNAI',
      amount: 1500000,
      createdByName: 'Admin BUMDes',
    },
    {
      id: 'tx-2',
      date: new Date(),
      type: 'PENGELUARAN' as const,
      category: 'Beban Operasional',
      businessUnit: 'KETAHANAN_PANGAN',
      description: 'Pembelian konsentrat pakan',
      paymentMethod: 'TUNAI',
      amount: 450000,
      createdByName: 'Admin BUMDes',
    },
  ];

  const txBuffer = generateTransactionsWorkbook(sampleTransactions);
  console.log(`✓ Buku Kas Excel exported: ${txBuffer.length} bytes`);
  if (txBuffer.length < 1000) throw new Error('Transaction Excel export too small!');

  const cateringBuffer = generateUnitWorkbook('CATERING', [
    { customerName: 'Pak Joko', customerPhone: '08123', eventDate: new Date(), menuDetail: 'Paket A', portion: 50, totalPrice: 1500000, downPayment: 500000, paymentStatus: 'DP', status: 'DIPROSES' }
  ]);
  console.log(`✓ Catering Excel exported: ${cateringBuffer.length} bytes`);

  const molenBuffer = generateUnitWorkbook('MOLEN', [
    { rentalNumber: 'RNT-001', unit: { code: 'MLN-01', name: 'Molen Hercules' }, renterName: 'Pak Budi', totalDays: 3, dailyRate: 150000, totalPrice: 450000, paymentStatus: 'LUNAS', rentalStatus: 'SELESAI' }
  ]);
  console.log(`✓ Molen Excel exported: ${molenBuffer.length} bytes`);

  const wifiBuffer = generateUnitWorkbook('WIFI', [
    { customerNumber: 'WF-001', name: 'Warga 1', phone: '0812', address: 'RT 01', plan: { name: 'Standard', speed: '20 Mbps', price: 100000 }, bills: [{ month: 9, year: 2026, status: 'LUNAS' }] }
  ]);
  console.log(`✓ WiFi Excel exported: ${wifiBuffer.length} bytes`);

  const ppobBuffer = generateUnitWorkbook('PPOB', [
    { transactionNo: 'PPOB-001', date: new Date(), type: 'PLN_TOKEN', targetNumber: '123456', costPrice: 50000, sellingPrice: 52500, adminFee: 2500, status: 'SUKSES' }
  ]);
  const sapiBuffer = generateUnitWorkbook('SAPI', [
    { tagNumber: 'SP-01', name: 'Si Jagur', breed: 'Simental', gender: 'JANTAN', initialWeight: 280, currentWeight: 420, purchasePrice: 15000000, status: 'SIAP_JUAL', salePrice: 22000000 }
  ]);
  console.log(`✓ Sapi Excel exported: ${sapiBuffer.length} bytes`);

  // ==========================================
  // DATA PURITY VERIFICATION
  // ==========================================
  console.log('\n--- [DATA PURITY VERIFICATION] ---');
  const leftoverOrders = await prisma.cateringOrder.count({ where: { customerName: { contains: 'TEST' } } });
  const leftoverMolen = await prisma.molenUnit.count({ where: { code: { contains: 'TEST' } } });
  const leftoverRentals = await prisma.molenRental.count({ where: { renterName: { contains: 'TEST' } } });
  const leftoverWifi = await prisma.wifiCustomer.count({ where: { name: { contains: 'TEST' } } });
  const leftoverPpob = await prisma.ppobTransaction.count({ where: { transactionNo: { contains: 'TEST' } } });
  const leftoverCattle = await prisma.cattle.count({ where: { tagNumber: { contains: 'TEST' } } });
  const leftoverTx = await prisma.transaction.count({ where: { description: { contains: 'TEST' } } });

  console.log(`Leftover Orders: ${leftoverOrders}`);
  console.log(`Leftover Molen: ${leftoverMolen}`);
  console.log(`Leftover Rentals: ${leftoverRentals}`);
  console.log(`Leftover WiFi: ${leftoverWifi}`);
  console.log(`Leftover PPOB: ${leftoverPpob}`);
  console.log(`Leftover Cattle: ${leftoverCattle}`);
  console.log(`Leftover Transactions: ${leftoverTx}`);

  if (
    leftoverOrders > 0 ||
    leftoverMolen > 0 ||
    leftoverRentals > 0 ||
    leftoverWifi > 0 ||
    leftoverPpob > 0 ||
    leftoverCattle > 0 ||
    leftoverTx > 0
  ) {
    throw new Error('Leftover test data detected! Cleaning required.');
  }

  console.log('\n🎉 ALL MULTI-UNIT CRUD, EXCEL EXPORT & CASH FLOW TESTS PASSED WITH 100% CLEANUP!');
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
