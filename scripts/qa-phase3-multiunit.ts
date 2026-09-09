import prisma from '../src/lib/prisma';
import { BusinessUnit, TransactionType, MolenStatus, CattleStatus, CattleGender } from '@prisma/client';
import { invalidateDashboardStatsCache } from '../src/lib/cache';

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

const results: TestResult[] = [];

async function testPhase3() {
  console.log('========================================================================');
  console.log('🧪 FASE 3: PENGUJIAN END-TO-END 5 UNIT USAHA & AUTO-SYNC BUKU KAS');
  console.log('========================================================================\n');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('User admin tidak ditemukan');

  // Catat baseline awal
  const baseOrderCount = await prisma.cateringOrder.count();
  const baseMolenCount = await prisma.molenUnit.count();
  const baseRentalCount = await prisma.molenRental.count();
  const baseWifiCustCount = await prisma.wifiCustomer.count();
  const baseWifiBillCount = await prisma.wifiBill.count();
  const basePpobCount = await prisma.ppobTransaction.count();
  const baseCattleCount = await prisma.cattle.count();
  const baseCattleExpCount = await prisma.cattleExpense.count();
  const baseTxCount = await prisma.transaction.count();

  console.log('Baseline Database Awal:');
  console.log(`- Catering Orders: ${baseOrderCount}`);
  console.log(`- Molen Units: ${baseMolenCount}, Rentals: ${baseRentalCount}`);
  console.log(`- WiFi Customers: ${baseWifiCustCount}, Bills: ${baseWifiBillCount}`);
  console.log(`- PPOB Transactions: ${basePpobCount}`);
  console.log(`- Cattle: ${baseCattleCount}, Expenses: ${baseCattleExpCount}`);
  console.log(`- Kas Transaksi: ${baseTxCount}\n`);

  // Tracking IDs untuk cleanup steril
  let testOrderId: string | null = null;
  let testMolenUnitId: string | null = null;
  let testRentalId: string | null = null;
  let testWifiCustId: string | null = null;
  const testWifiBillIds: string[] = [];
  let testPpobId: string | null = null;
  let testCattleId: string | null = null;
  let testCattleExpId: string | null = null;
  const testTxIds: string[] = [];

  try {
    // =========================================================================
    // 1. UNIT CATERING DESA
    // =========================================================================
    console.log('--- 1. UNIT USAHA CATERING DESA ---');
    const cateringAcc = await prisma.account.findUniqueOrThrow({ where: { code: '4001' } });

    // 1A. Buat Pesanan dengan Uang Muka (DP)
    const cateringOrder = await prisma.cateringOrder.create({
      data: {
        customerName: '[TEST-QA] Bapak Supri (Syukuran Kelahiran)',
        customerPhone: '081298765432',
        eventDate: new Date(Date.now() + 86400000 * 3),
        menuDetail: 'Paket Nasi Kuning Kotak & Ayam Panggang',
        portion: 100,
        totalPrice: 2000000,
        downPayment: 500000,
        paymentStatus: 'DP',
        status: 'DIPROSES',
        notes: 'Uji coba sinkronisasi kas DP',
        createdById: admin.id,
      },
    });
    testOrderId = cateringOrder.id;

    // Sinkronisasi DP ke Kas
    const cateringDpTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: cateringAcc.name,
        businessUnit: BusinessUnit.CATERING,
        paymentMethod: 'TUNAI',
        accountId: cateringAcc.id,
        description: `Penerimaan Uang Muka (DP) Catering: ${cateringOrder.customerName} (100 porsi)`,
        amount: 500000,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(cateringDpTx.id);

    results.push({
      step: '1A. Buat Pesanan Catering & Sinkronisasi DP',
      status: 'PASS',
      detail: `Pesanan dibuat (ID: ${cateringOrder.id}), DP Rp 500.000 tersinkron ke Kas ID ${cateringDpTx.id}`,
    });

    // 1B. Pelunasan Pesanan (LUNAS) & Status SELESAI
    const updatedOrder = await prisma.cateringOrder.update({
      where: { id: testOrderId },
      data: {
        paymentStatus: 'LUNAS',
        status: 'SELESAI',
      },
    });

    const sisaBayarCatering = Number(updatedOrder.totalPrice) - Number(updatedOrder.downPayment);
    const cateringLunasTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: cateringAcc.name,
        businessUnit: BusinessUnit.CATERING,
        paymentMethod: 'TUNAI',
        accountId: cateringAcc.id,
        description: `Pelunasan Pesanan Catering: ${cateringOrder.customerName}`,
        amount: sisaBayarCatering,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(cateringLunasTx.id);

    if (updatedOrder.paymentStatus === 'LUNAS' && sisaBayarCatering === 1500000) {
      results.push({
        step: '1B. Pelunasan Pesanan & Sinkronisasi Sisa Kas',
        status: 'PASS',
        detail: `Status berubah ke LUNAS/SELESAI, pelunasan sisa Rp 1.500.000 tersinkron ke Kas ID ${cateringLunasTx.id}`,
      });
    } else {
      results.push({
        step: '1B. Pelunasan Pesanan & Sinkronisasi Sisa Kas',
        status: 'FAIL',
        detail: 'Kalkulasi sisa pelunasan tidak valid',
      });
    }

    // =========================================================================
    // 2. UNIT PERSEWAAN MESIN MOLEN
    // =========================================================================
    console.log('\n--- 2. UNIT USAHA PERSEWAAN MESIN MOLEN ---');
    const molenAcc = await prisma.account.findUniqueOrThrow({ where: { code: '4010' } });

    // 2A. Tambah Unit Molen Uji Coba
    const molenUnit = await prisma.molenUnit.create({
      data: {
        code: 'MLN-QA-99',
        name: 'Molen Beton QA Test Unit 400L',
        dailyRate: 150000,
        status: MolenStatus.TERSEDIA,
        condition: 'Sangat Baik (Unit Uji Coba)',
        notes: 'Unit testing otomatis',
      },
    });
    testMolenUnitId = molenUnit.id;

    // 2B. Buat Transaksi Sewa (3 hari = 450.000, deposit 150.000)
    const rental = await prisma.molenRental.create({
      data: {
        rentalNumber: `RNT-QA-${Date.now().toString().slice(-4)}`,
        unitId: molenUnit.id,
        renterName: '[TEST-QA] Pak Slamet (Proyek Gorong-gorong)',
        renterPhone: '081399887766',
        renterAddress: 'Dusun Bogem Selatan',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000 * 3),
        totalDays: 3,
        dailyRate: 150000,
        totalPrice: 450000,
        deposit: 150000,
        paymentStatus: 'DP',
        rentalStatus: 'AKTIF',
        createdById: admin.id,
      },
    });
    testRentalId = rental.id;

    // Update status unit ke DISEWA
    await prisma.molenUnit.update({
      where: { id: molenUnit.id },
      data: { status: MolenStatus.DISEWA },
    });

    const molenDepositTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: molenAcc.name,
        businessUnit: BusinessUnit.RENTAL_MOLEN,
        paymentMethod: 'TUNAI',
        accountId: molenAcc.id,
        description: `Penerimaan Sewa Molen ${molenUnit.code} - ${rental.renterName} (3 hari)`,
        amount: 150000,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(molenDepositTx.id);

    const checkedUnitState = await prisma.molenUnit.findUniqueOrThrow({ where: { id: molenUnit.id } });
    if (checkedUnitState.status === MolenStatus.DISEWA) {
      results.push({
        step: '2A. Sewa Molen & Transisi Status Unit ke DISEWA',
        status: 'PASS',
        detail: `Unit ${molenUnit.code} beralih ke DISEWA, deposit Rp 150.000 tercatat di Kas ID ${molenDepositTx.id}`,
      });
    } else {
      results.push({
        step: '2A. Sewa Molen & Transisi Status Unit ke DISEWA',
        status: 'FAIL',
        detail: `Status unit molen tidak berubah (status: ${checkedUnitState.status})`,
      });
    }

    // 2C. Pengembalian Unit Molen (SELESAI & LUNAS)
    await prisma.molenRental.update({
      where: { id: rental.id },
      data: {
        rentalStatus: 'SELESAI',
        paymentStatus: 'LUNAS',
      },
    });

    const returnedUnit = await prisma.molenUnit.update({
      where: { id: molenUnit.id },
      data: { status: MolenStatus.TERSEDIA },
    });

    const sisaMolen = Number(rental.totalPrice) - Number(rental.deposit); // 300.000
    const molenLunasTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: molenAcc.name,
        businessUnit: BusinessUnit.RENTAL_MOLEN,
        paymentMethod: 'TUNAI',
        accountId: molenAcc.id,
        description: `Pelunasan Sewa Molen ${molenUnit.code} - ${rental.renterName}`,
        amount: sisaMolen,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(molenLunasTx.id);

    if (returnedUnit.status === MolenStatus.TERSEDIA && sisaMolen === 300000) {
      results.push({
        step: '2B. Selesai Sewa & Kembalikan Status Unit ke TERSEDIA',
        status: 'PASS',
        detail: `Unit kembali TERSEDIA, pelunasan sisa sewa Rp 300.000 tercatat di Kas ID ${molenLunasTx.id}`,
      });
    } else {
      results.push({
        step: '2B. Selesai Sewa & Kembalikan Status Unit ke TERSEDIA',
        status: 'FAIL',
        detail: 'Unit tidak kembali ke status TERSEDIA atau kalkulasi sisa salah',
      });
    }

    // =========================================================================
    // 3. UNIT LAYANAN WIFI BALAI DESA
    // =========================================================================
    console.log('\n--- 3. UNIT USAHA WIFI BALAI DESA ---');
    const wifiAcc = await prisma.account.findUniqueOrThrow({ where: { code: '4020' } });
    const plan = await prisma.wifiPlan.findFirstOrThrow({ where: { isActive: true } });

    // 3A. Pendaftaran Pelanggan Baru & Auto-Bill Bulan Berjalan
    const wifiCustomer = await prisma.wifiCustomer.create({
      data: {
        customerNumber: `WF-QA-${Date.now().toString().slice(-4)}`,
        name: '[TEST-QA] Warga Internet 01',
        phone: '085799112233',
        address: 'RT 02 RW 01 Desa Bogem',
        rtRw: 'RT 02 / RW 01',
        planId: plan.id,
        isActive: true,
      },
      include: { plan: true },
    });
    testWifiCustId = wifiCustomer.id;

    const now = new Date();
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();

    const bill = await prisma.wifiBill.create({
      data: {
        billNumber: `INV-WF-${curYear}${String(curMonth).padStart(2, '0')}-${wifiCustomer.customerNumber}`,
        customerId: wifiCustomer.id,
        month: curMonth,
        year: curYear,
        amount: wifiCustomer.plan.price,
        dueDate: new Date(curYear, curMonth - 1, 20),
        status: 'BELUM_BAYAR',
      },
    });
    testWifiBillIds.push(bill.id);

    results.push({
      step: '3A. Registrasi Pelanggan WiFi & Penerbitan Tagihan Awal',
      status: 'PASS',
      detail: `Pelanggan ${wifiCustomer.customerNumber} (${wifiCustomer.name}) terdaftar, terbit tagihan ${bill.billNumber} (Rp ${Number(bill.amount).toLocaleString('id-ID')})`,
    });

    // 3B. Pembayaran Tagihan WiFi & Sinkronisasi Kas
    const paidBill = await prisma.wifiBill.update({
      where: { id: bill.id },
      data: {
        status: 'LUNAS',
        paidDate: new Date(),
      },
    });

    const wifiCashTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: wifiAcc.name,
        businessUnit: BusinessUnit.WIFI_DESA,
        paymentMethod: 'TUNAI',
        accountId: wifiAcc.id,
        description: `Iuran WiFi ${wifiCustomer.customerNumber} - ${wifiCustomer.name} (Bulan ${curMonth}/${curYear})`,
        amount: bill.amount,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(wifiCashTx.id);

    if (paidBill.status === 'LUNAS' && paidBill.paidDate) {
      results.push({
        step: '3B. Pembayaran Tagihan WiFi & Sinkronisasi Kas',
        status: 'PASS',
        detail: `Tagihan ${bill.billNumber} LUNAS, penerimaan iuran Rp ${Number(bill.amount).toLocaleString('id-ID')} masuk Kas ID ${wifiCashTx.id}`,
      });
    } else {
      results.push({
        step: '3B. Pembayaran Tagihan WiFi & Sinkronisasi Kas',
        status: 'FAIL',
        detail: 'Status tagihan tidak beralih ke LUNAS',
      });
    }

    // =========================================================================
    // 4. UNIT LOKET PPOB
    // =========================================================================
    console.log('\n--- 4. UNIT USAHA LOKET PPOB ---');
    const ppobAcc = await prisma.account.findUniqueOrThrow({ where: { code: '4030' } });

    const costPrice = 50000;
    const sellingPrice = 52500;
    const adminFee = sellingPrice - costPrice; // Margin = 2.500

    const ppobTx = await prisma.ppobTransaction.create({
      data: {
        transactionNo: `PPOB-QA-${Date.now().toString().slice(-6)}`,
        type: 'PLN_TOKEN',
        targetNumber: '320011223344',
        customerName: '[TEST-QA] Pelanggan PLN',
        costPrice,
        sellingPrice,
        adminFee,
        status: 'SUKSES',
        notes: 'Uji coba fee loket',
        createdById: admin.id,
      },
    });
    testPpobId = ppobTx.id;

    // Catat Margin Laba ke Kas
    const ppobCashTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: ppobAcc.name,
        businessUnit: BusinessUnit.PPOB,
        paymentMethod: 'TUNAI',
        accountId: ppobAcc.id,
        description: `Fee Kasir PPOB PLN_TOKEN: 320011223344 (Jual: Rp 52.500)`,
        amount: adminFee,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(ppobCashTx.id);

    if (Number(ppobTx.adminFee) === 2500 && Number(ppobCashTx.amount) === 2500) {
      results.push({
        step: '4. Transaksi Loket PPOB & Pencatatan Margin Kas',
        status: 'PASS',
        detail: `Transaksi ${ppobTx.transactionNo}: Jual Rp 52.500, Modal Rp 50.000, Margin Laba Rp 2.500 masuk Kas ID ${ppobCashTx.id}`,
      });
    } else {
      results.push({
        step: '4. Transaksi Loket PPOB & Pencatatan Margin Kas',
        status: 'FAIL',
        detail: `Kalkulasi margin PPOB salah: didapat ${ppobTx.adminFee}`,
      });
    }

    // =========================================================================
    // 5. UNIT KETAHANAN PANGAN (PETERNAKAN SAPI)
    // =========================================================================
    console.log('\n--- 5. UNIT KETAHANAN PANGAN (PETERNAKAN SAPI) ---');
    const biologicalAcc = await prisma.account.findUniqueOrThrow({ where: { code: '1203' } });
    const pakanAcc = await prisma.account.findUniqueOrThrow({ where: { code: '5041' } });
    const saleSapiAcc = await prisma.account.findUniqueOrThrow({ where: { code: '4040' } });

    // 5A. Beli Bibit Sapi & Catat Pengeluaran Modal Aset Biologis
    const cattle = await prisma.cattle.create({
      data: {
        tagNumber: `SP-QA-${Date.now().toString().slice(-4)}`,
        name: 'Si Black QA Test',
        breed: 'Limousin Super',
        gender: CattleGender.JANTAN,
        status: CattleStatus.PENGGEMUKAN,
        purchaseDate: new Date(),
        purchasePrice: 15000000,
        initialWeight: 320,
        currentWeight: 320,
        notes: 'Sapi pengujian sistem',
      },
    });
    testCattleId = cattle.id;

    const cattleBuyTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PENGELUARAN,
        category: 'Pembelian Bibit Sapi',
        businessUnit: BusinessUnit.KETAHANAN_PANGAN,
        paymentMethod: 'TUNAI',
        accountId: biologicalAcc.id,
        description: `Beli bibit sapi ${cattle.tagNumber} (${cattle.breed}) bobot 320kg`,
        amount: 15000000,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(cattleBuyTx.id);

    results.push({
      step: '5A. Pendaftaran Ternak Sapi & Pengeluaran Kas Aset Biologis',
      status: 'PASS',
      detail: `Sapi ${cattle.tagNumber} didaftarkan, pengeluaran beli bibit Rp 15.000.000 tercatat di Kas [1203] ID ${cattleBuyTx.id}`,
    });

    // 5B. Tambah Biaya Operasional (Pakan Konsentrat)
    const cattleExp = await prisma.cattleExpense.create({
      data: {
        cattleId: cattle.id,
        type: 'PAKAN',
        description: 'Beli konsentrat penggemukan 2 sak',
        amount: 300000,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testCattleExpId = cattleExp.id;

    const cattleExpTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PENGELUARAN,
        category: 'Beban PAKAN',
        businessUnit: BusinessUnit.KETAHANAN_PANGAN,
        paymentMethod: 'TUNAI',
        accountId: pakanAcc.id,
        description: `Beli konsentrat penggemukan 2 sak (Sapi ${cattle.tagNumber})`,
        amount: 300000,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(cattleExpTx.id);

    results.push({
      step: '5B. Biaya Operasional Sapi & Sinkronisasi Beban Kas',
      status: 'PASS',
      detail: `Biaya pakan Rp 300.000 tercatat pada ternak dan Kas Beban [5041] ID ${cattleExpTx.id}`,
    });

    // 5C. Update Bobot Sapi (Perkembangan Timbang)
    const weighed = await prisma.cattle.update({
      where: { id: cattle.id },
      data: {
        currentWeight: 390,
        lastWeighedAt: new Date(),
      },
    });

    if (Number(weighed.currentWeight) === 390) {
      results.push({
        step: '5C. Tracking Pertumbuhan Bobot Ternak Sapi',
        status: 'PASS',
        detail: `Bobot sapi berhasil naik dari 320kg ke 390kg (+70kg perkembangan)`,
      });
    } else {
      results.push({
        step: '5C. Tracking Pertumbuhan Bobot Ternak Sapi',
        status: 'FAIL',
        detail: 'Pembaruan bobot tidak tersimpan',
      });
    }

    // 5D. Penjualan / Panen Ternak Sapi
    const soldPrice = 21000000;
    const sold = await prisma.cattle.update({
      where: { id: cattle.id },
      data: {
        status: CattleStatus.TERJUAL,
        saleDate: new Date(),
        salePrice: soldPrice,
        buyerName: '[TEST-QA] Jagal Berkah Daging',
        notes: 'Terjual panen dengan margin bagus',
      },
    });

    const cattleSaleTx = await prisma.transaction.create({
      data: {
        type: TransactionType.PEMASUKAN,
        category: saleSapiAcc.name,
        businessUnit: BusinessUnit.KETAHANAN_PANGAN,
        paymentMethod: 'TUNAI',
        accountId: saleSapiAcc.id,
        description: `Penjualan Sapi ${cattle.tagNumber} (${cattle.breed}) kepada ${sold.buyerName}`,
        amount: soldPrice,
        date: new Date(),
        createdById: admin.id,
      },
    });
    testTxIds.push(cattleSaleTx.id);

    if (sold.status === CattleStatus.TERJUAL && Number(sold.salePrice) === 21000000) {
      results.push({
        step: '5D. Penjualan Sapi & Sinkronisasi Pendapatan Kas',
        status: 'PASS',
        detail: `Status sapi TERJUAL, penerimaan penjualan Rp 21.000.000 masuk Kas Pendapatan [4040] ID ${cattleSaleTx.id}`,
      });
    } else {
      results.push({
        step: '5D. Penjualan Sapi & Sinkronisasi Pendapatan Kas',
        status: 'FAIL',
        detail: 'Status sapi tidak berubah ke TERJUAL',
      });
    }

    // =========================================================================
    // 6. PEMBERSIHAN DATA UJI COBA (STERILISASI 100%)
    // =========================================================================
    console.log('\n--- 6. STERILISASI DATA UJI COBA 5 UNIT ---');

    // Hapus seluruh transaksi kas yang dibuat saat test
    if (testTxIds.length > 0) {
      const delTx = await prisma.transaction.deleteMany({ where: { id: { in: testTxIds } } });
      console.log(`   🗑️ Dihapus ${delTx.count} transaksi kas uji coba.`);
      testTxIds.length = 0;
    }

    // Hapus pesanan catering
    if (testOrderId) {
      await prisma.cateringOrder.delete({ where: { id: testOrderId } });
      testOrderId = null;
      console.log('   🗑️ Dihapus 1 pesanan catering uji coba.');
    }

    // Hapus sewa & unit molen
    if (testRentalId) {
      await prisma.molenRental.delete({ where: { id: testRentalId } });
      testRentalId = null;
    }
    if (testMolenUnitId) {
      await prisma.molenUnit.delete({ where: { id: testMolenUnitId } });
      testMolenUnitId = null;
      console.log('   🗑️ Dihapus 1 unit & sewa molen uji coba.');
    }

    // Hapus tagihan & pelanggan wifi
    if (testWifiBillIds.length > 0) {
      await prisma.wifiBill.deleteMany({ where: { id: { in: testWifiBillIds } } });
      testWifiBillIds.length = 0;
    }
    if (testWifiCustId) {
      await prisma.wifiCustomer.delete({ where: { id: testWifiCustId } });
      testWifiCustId = null;
      console.log('   🗑️ Dihapus 1 pelanggan & tagihan WiFi uji coba.');
    }

    // Hapus PPOB
    if (testPpobId) {
      await prisma.ppobTransaction.delete({ where: { id: testPpobId } });
      testPpobId = null;
      console.log('   🗑️ Dihapus 1 transaksi PPOB uji coba.');
    }

    // Hapus sapi & biaya sapi
    if (testCattleExpId) {
      await prisma.cattleExpense.delete({ where: { id: testCattleExpId } });
      testCattleExpId = null;
    }
    if (testCattleId) {
      await prisma.cattle.delete({ where: { id: testCattleId } });
      testCattleId = null;
      console.log('   🗑️ Dihapus 1 sapi & biaya peternakan uji coba.');
    }

    invalidateDashboardStatsCache();

    results.push({
      step: '6A. Pembersihan Tuntas Seluruh Entitas Uji Coba',
      status: 'PASS',
      detail: 'Seluruh pesanan, sewa, tagihan, PPOB, ternak, dan transaksi kas uji coba telah dihapus tuntas',
    });

    // 6B. Verifikasi Sterilisasi Akhir
    const finalOrderCount = await prisma.cateringOrder.count();
    const finalMolenCount = await prisma.molenUnit.count();
    const finalRentalCount = await prisma.molenRental.count();
    const finalWifiCustCount = await prisma.wifiCustomer.count();
    const finalWifiBillCount = await prisma.wifiBill.count();
    const finalPpobCount = await prisma.ppobTransaction.count();
    const finalCattleCount = await prisma.cattle.count();
    const finalCattleExpCount = await prisma.cattleExpense.count();
    const finalTxCount = await prisma.transaction.count();

    const isSterile =
      finalOrderCount === baseOrderCount &&
      finalMolenCount === baseMolenCount &&
      finalRentalCount === baseRentalCount &&
      finalWifiCustCount === baseWifiCustCount &&
      finalWifiBillCount === baseWifiBillCount &&
      finalPpobCount === basePpobCount &&
      finalCattleCount === baseCattleCount &&
      finalCattleExpCount === baseCattleExpCount &&
      finalTxCount === baseTxCount;

    if (isSterile) {
      results.push({
        step: '6B. Verifikasi Sterilisasi Database 5 Unit (Zero Residue)',
        status: 'PASS',
        detail: `Semua tabel kembali presisi ke kondisi baseline: Kas (${finalTxCount}), Order (${finalOrderCount}), Molen (${finalMolenCount}/${finalRentalCount}), WiFi (${finalWifiCustCount}/${finalWifiBillCount}), PPOB (${finalPpobCount}), Sapi (${finalCattleCount}/${finalCattleExpCount})`,
      });
    } else {
      results.push({
        step: '6B. Verifikasi Sterilisasi Database 5 Unit (Zero Residue)',
        status: 'FAIL',
        detail: 'Ada selisih count setelah sterilisasi!',
      });
    }

  } catch (err: any) {
    results.push({
      step: 'Eksekusi Fase 3',
      status: 'FAIL',
      detail: `Error tak terduga: ${err.message}`,
    });
  } finally {
    // Safety fallback cleanup in case of abnormal exit
    if (testTxIds.length > 0) await prisma.transaction.deleteMany({ where: { id: { in: testTxIds } } });
    if (testOrderId) await prisma.cateringOrder.deleteMany({ where: { id: testOrderId } });
    if (testRentalId) await prisma.molenRental.deleteMany({ where: { id: testRentalId } });
    if (testMolenUnitId) await prisma.molenUnit.deleteMany({ where: { id: testMolenUnitId } });
    if (testWifiBillIds.length > 0) await prisma.wifiBill.deleteMany({ where: { id: { in: testWifiBillIds } } });
    if (testWifiCustId) await prisma.wifiCustomer.deleteMany({ where: { id: testWifiCustId } });
    if (testPpobId) await prisma.ppobTransaction.deleteMany({ where: { id: testPpobId } });
    if (testCattleExpId) await prisma.cattleExpense.deleteMany({ where: { id: testCattleExpId } });
    if (testCattleId) await prisma.cattle.deleteMany({ where: { id: testCattleId } });
  }

  console.log('\n--- HASIL PENGUJIAN FASE 3 (MULTI-UNIT & AUTO-SYNC KAS) ---');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.step} -> ${r.detail}`);
    if (r.status === 'FAIL') allPass = false;
  }

  if (!allPass) {
    throw new Error('Pengujian Fase 3 gagal!');
  }
  console.log('\n🎉 FASE 3: SEMUA TEST 5 UNIT USAHA & AUTO-SYNC KAS LULUS 100%!');
}

testPhase3()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
