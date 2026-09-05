import * as XLSX from 'xlsx';
import { IncomeStatementResult, BalanceSheetResult } from './accounting';

export interface TransactionExportItem {
  id: string;
  date: Date | string;
  type: 'PEMASUKAN' | 'PENGELUARAN';
  category: string;
  businessUnit: string;
  paymentMethod?: string | null;
  description: string;
  amount: number | string;
  createdByName?: string | null;
}

export function generateTransactionsWorkbook(
  items: TransactionExportItem[],
  filters?: { businessUnit?: string; month?: string; year?: string }
): Buffer {
  const wb = XLSX.utils.book_new();

  // 1. Prepare Rows
  const rows: (string | number)[][] = [];

  // Header Titles
  rows.push(['BUMDES BOGEM - PEMBUKUAN KEUANGAN DESA']);
  rows.push(['LAPORAN TRANSAKSI BUKU KAS UMUM']);
  rows.push([
    `Unit Usaha: ${filters?.businessUnit || 'Semua Unit'} | Periode: ${
      filters?.month ? `Bulan ${filters.month}/` : ''
    }${filters?.year || 'Semua Waktu'} | Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`,
  ]);
  rows.push([]); // Empty spacing line

  // Column Headers
  rows.push([
    'No.',
    'Tanggal',
    'Unit Usaha',
    'Jenis Kas',
    'Kategori',
    'Keterangan',
    'Metode Bayar',
    'Pemasukan (Rp)',
    'Pengeluaran (Rp)',
    'Petugas Input',
  ]);

  let totalIn = 0;
  let totalOut = 0;

  items.forEach((item, index) => {
    const amt = Number(item.amount) || 0;
    const isMasuk = item.type === 'PEMASUKAN';
    const masukVal = isMasuk ? amt : 0;
    const keluarVal = !isMasuk ? amt : 0;

    totalIn += masukVal;
    totalOut += keluarVal;

    const dateStr = item.date
      ? new Date(item.date).toLocaleDateString('id-ID', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '-';

    rows.push([
      index + 1,
      dateStr,
      item.businessUnit || 'UMUM',
      isMasuk ? 'UANG MASUK' : 'UANG KELUAR',
      item.category || '-',
      item.description || '-',
      item.paymentMethod || 'TUNAI',
      masukVal,
      keluarVal,
      item.createdByName || '-',
    ]);
  });

  // Summary Row
  rows.push([]);
  rows.push([
    '',
    '',
    '',
    '',
    '',
    'TOTAL REKAPITULASI',
    '',
    totalIn,
    totalOut,
    '',
  ]);
  rows.push([
    '',
    '',
    '',
    '',
    '',
    'SALDO BERSIH (SURPLUS / DEFISIT)',
    '',
    totalIn - totalOut,
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Auto column widths
  ws['!cols'] = [
    { wch: 5 },  // No
    { wch: 12 }, // Tanggal
    { wch: 15 }, // Unit Usaha
    { wch: 14 }, // Jenis
    { wch: 22 }, // Kategori
    { wch: 35 }, // Keterangan
    { wch: 14 }, // Metode
    { wch: 18 }, // Masuk
    { wch: 18 }, // Keluar
    { wch: 20 }, // Petugas
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Buku Kas');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Unit-Specific Workbooks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateUnitWorkbook(unit: string, data: any[]): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [];

  if (unit === 'CATERING') {
    rows.push(['BUMDES BOGEM - UNIT USAHA CATERING DESA']);
    rows.push([`REKAPITULASI PESANAN ACARA | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`]);
    rows.push([]);
    rows.push([
      'No.',
      'Nama Pemesan',
      'No. WhatsApp',
      'Tgl Acara',
      'Menu Pesanan',
      'Porsi',
      'Total Harga (Rp)',
      'Uang Muka/DP (Rp)',
      'Sisa Tagihan (Rp)',
      'Status Bayar',
      'Status Pesanan',
    ]);

    data.forEach((o, i) => {
      const tot = Number(o.totalPrice) || 0;
      const dp = Number(o.downPayment) || 0;
      const sisa = Math.max(0, tot - dp);
      rows.push([
        i + 1,
        o.customerName,
        o.customerPhone || '-',
        new Date(o.eventDate).toLocaleDateString('id-ID'),
        o.menuDetail,
        o.portion,
        tot,
        dp,
        sisa,
        o.paymentStatus,
        o.status,
      ]);
    });
  } else if (unit === 'MOLEN') {
    rows.push(['BUMDES BOGEM - UNIT USAHA PENYEWAAN MOLEN']);
    rows.push([`REKAPITULASI PERSEWAAN ARMADA | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`]);
    rows.push([]);
    rows.push([
      'No.',
      'No. Sewa',
      'Unit Molen',
      'Penyewa',
      'No. HP',
      'Alamat Proyek',
      'Tgl Mulai',
      'Tgl Selesai',
      'Durasi (Hari)',
      'Tarif/Hari (Rp)',
      'Total Biaya (Rp)',
      'Uang Muka (Rp)',
      'Status Bayar',
      'Status Sewa',
    ]);

    data.forEach((r, i) => {
      rows.push([
        i + 1,
        r.rentalNumber,
        r.unit?.code ? `[${r.unit.code}] ${r.unit.name}` : '-',
        r.renterName,
        r.renterPhone,
        r.renterAddress || '-',
        new Date(r.startDate).toLocaleDateString('id-ID'),
        new Date(r.endDate).toLocaleDateString('id-ID'),
        r.totalDays,
        Number(r.dailyRate),
        Number(r.totalPrice),
        Number(r.deposit),
        r.paymentStatus,
        r.rentalStatus,
      ]);
    });
  } else if (unit === 'WIFI') {
    rows.push(['BUMDES BOGEM - UNIT USAHA WIFI BALAI DESA']);
    rows.push([`REKAPITULASI PELANGGAN & IURAN BULANAN | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`]);
    rows.push([]);
    rows.push([
      'No.',
      'ID Pelanggan',
      'Nama Warga',
      'No. HP',
      'Alamat',
      'RT / RW',
      'Paket Internet',
      'Kecepatan',
      'Iuran/Bulan (Rp)',
      'Status Tagihan Bulan Ini',
      'Tgl Bayar',
    ]);

    data.forEach((c, i) => {
      const activeBill = c.bills && c.bills.length > 0 ? c.bills[0] : null;
      rows.push([
        i + 1,
        c.customerNumber,
        c.name,
        c.phone,
        c.address,
        c.rtRw || '-',
        c.plan?.name || '-',
        c.plan?.speed || '-',
        Number(c.plan?.price || 0),
        activeBill ? (activeBill.status === 'LUNAS' ? 'LUNAS' : 'MENUNGGAK') : 'BELUM TERBIT',
        activeBill?.paidDate ? new Date(activeBill.paidDate).toLocaleDateString('id-ID') : '-',
      ]);
    });
  } else if (unit === 'PPOB') {
    rows.push(['BUMDES BOGEM - UNIT USAHA PPOB & LOKET PEMBAYARAN DESA']);
    rows.push([`REKAPITULASI TRANSAKSI KASIR | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`]);
    rows.push([]);
    rows.push([
      'No.',
      'No. Transaksi',
      'Waktu',
      'Jenis Layanan',
      'Tujuan / No. Meter / HP',
      'Pelanggan',
      'Modal Server (Rp)',
      'Harga Jual (Rp)',
      'Laba Fee Admin (Rp)',
      'Status',
    ]);

    data.forEach((p, i) => {
      rows.push([
        i + 1,
        p.transactionNo,
        new Date(p.date || p.createdAt).toLocaleString('id-ID'),
        p.type,
        p.targetNumber,
        p.customerName || '-',
        Number(p.costPrice),
        Number(p.sellingPrice),
        Number(p.adminFee),
        p.status,
      ]);
    });
  } else if (unit === 'SAPI') {
    rows.push(['BUMDES BOGEM - KETAHANAN PANGAN (PETERNAKAN SAPI)']);
    rows.push([`REKAPITULASI INVENTARIS & PANEN TERNAK | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`]);
    rows.push([]);
    rows.push([
      'No.',
      'Tag ID',
      'Nama Sapi',
      'Ras',
      'Status',
      'Tgl Masuk/Beli',
      'Harga Beli (Rp)',
      'Bobot Masuk (kg)',
      'Bobot Terkini (kg)',
      'Total Kenaikan (kg)',
      'Laju ADG (kg/hari)',
      'Tgl Panen/Jual',
      'Harga Jual (Rp)',
      'Pembeli',
    ]);

    data.forEach((s, i) => {
      const initW = Number(s.initialWeight) || 0;
      const curW = Number(s.currentWeight) || 0;
      const gain = Math.max(0, curW - initW);
      const days = Math.max(1, Math.floor((Date.now() - new Date(s.purchaseDate).getTime()) / 86400000));
      const adg = Number((gain / days).toFixed(2));

      rows.push([
        i + 1,
        s.tagNumber,
        s.name || '-',
        s.breed,
        s.status,
        new Date(s.purchaseDate).toLocaleDateString('id-ID'),
        Number(s.purchasePrice),
        initW,
        curW,
        gain,
        adg,
        s.saleDate ? new Date(s.saleDate).toLocaleDateString('id-ID') : '-',
        s.salePrice ? Number(s.salePrice) : '-',
        s.buyerName || '-',
      ]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, unit);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function generateIncomeStatementWorkbook(
  report: IncomeStatementResult,
  unitLabel = 'Konsolidasi Seluruh Unit'
): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [];

  rows.push(['BUMDES BOGEM - PEMBUKUAN KEUANGAN DESA']);
  rows.push(['LAPORAN LABA RUGI (INCOME STATEMENT - SAK EMKM)']);
  rows.push([
    `Unit Usaha: ${unitLabel} | Periode: ${report.period.startDate} s/d ${report.period.endDate} | Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`,
  ]);
  rows.push([]);

  // A. PENDAPATAN
  rows.push(['I. PENDAPATAN USAHA', '', '', '']);
  rows.push(['Kode Akun', 'Nama Pos Pendapatan', 'Jumlah (Rp)', 'Keterangan']);

  if (report.revenue.accounts.length === 0) {
    rows.push(['-', 'Tidak ada pendapatan pada periode ini', 0, 'Belum ada transaksi']);
  } else {
    report.revenue.accounts.forEach((acc) => {
      rows.push([acc.code, acc.name, acc.total, `${acc.transactionCount} Transaksi`]);
    });
  }
  rows.push(['', 'TOTAL PENDAPATAN USAHA (A)', report.revenue.total, '']);
  rows.push([]);

  // B. BEBAN OPERASIONAL
  rows.push(['II. BEBAN OPERASIONAL', '', '', '']);
  rows.push(['Kode Akun', 'Nama Pos Beban Operasional', 'Jumlah (Rp)', 'Keterangan']);

  if (report.operatingExpenses.accounts.length === 0) {
    rows.push(['-', 'Tidak ada beban operasional pada periode ini', 0, 'Belum ada transaksi']);
  } else {
    report.operatingExpenses.accounts.forEach((acc) => {
      rows.push([acc.code, acc.name, acc.total, `${acc.transactionCount} Transaksi`]);
    });
  }
  rows.push(['', 'TOTAL BEBAN OPERASIONAL (B)', report.operatingExpenses.total, '']);
  rows.push(['', 'LABA OPERASIONAL / KOTOR (A - B)', report.grossOperatingProfit, '']);
  rows.push([]);

  // C. BEBAN NON OPERASIONAL
  rows.push(['III. BEBAN NON-OPERASIONAL', '', '', '']);
  rows.push(['Kode Akun', 'Nama Pos Beban Non-Operasional', 'Jumlah (Rp)', 'Keterangan']);

  if (report.nonOperatingExpenses.accounts.length === 0) {
    rows.push(['-', 'Tidak ada beban non-operasional', 0, '-']);
  } else {
    report.nonOperatingExpenses.accounts.forEach((acc) => {
      rows.push([acc.code, acc.name, acc.total, `${acc.transactionCount} Transaksi`]);
    });
  }
  rows.push(['', 'TOTAL BEBAN NON-OPERASIONAL (C)', report.nonOperatingExpenses.total, '']);
  rows.push([]);

  // HASIL AKHIR
  rows.push(['', 'LABA BERSIH / HASIL USAHA BERSIH (A - B - C)', report.netIncome, '']);
  rows.push([]);
  rows.push(['Lembar Pengesahan Laporan Keuangan BUMDes Bogem:']);
  rows.push(['Mengetahui,', 'Disetujui Oleh,', '', 'Dibuat Oleh,']);
  rows.push(['Kepala Desa Bogem', 'Direktur / Ketua BUMDes', '', 'Bendahara BUMDes']);
  rows.push(['', '', '', '']);
  rows.push(['( ................................... )', '( ................................... )', '', '( ................................... )']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 15 }, { wch: 38 }, { wch: 22 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Laba Rugi');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function generateBalanceSheetWorkbook(
  report: BalanceSheetResult,
  unitLabel = 'Konsolidasi Seluruh Unit'
): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: (string | number)[][] = [];

  rows.push(['BUMDES BOGEM - PEMBUKUAN KEUANGAN DESA']);
  rows.push(['LAPORAN POSISI KEUANGAN (NERACA - SAK EMKM)']);
  rows.push([
    `Unit Usaha: ${unitLabel} | Per Tanggal: ${report.asOfDate} | Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}`,
  ]);
  rows.push([]);

  // ASET
  rows.push(['AKTIVA / ASET', '', '', '']);
  rows.push(['Kode Akun', 'Pos Akun Keuangan', 'Jumlah (Rp)', 'Subtotal']);
  rows.push(['A. Aset Lancar', '', '', '']);
  report.assets.currentAssets.items.forEach((item) => {
    rows.push([item.code, item.name, item.amount, '']);
  });
  rows.push(['', 'Total Aset Lancar', '', report.assets.currentAssets.total]);

  rows.push(['B. Aset Tetap', '', '', '']);
  report.assets.fixedAssets.items.forEach((item) => {
    rows.push([item.code, item.name, item.amount, '']);
  });
  rows.push(['', 'Total Aset Tetap', '', report.assets.fixedAssets.total]);
  rows.push(['', 'TOTAL KESELURUHAN ASET (AKTIVA)', '', report.assets.totalAssets]);
  rows.push([]);

  // KEWAJIBAN & EKUITAS
  rows.push(['PASIVA (KEWAJIBAN & EKUITAS)', '', '', '']);
  rows.push(['A. Kewajiban Jangka Pendek', '', '', '']);
  report.liabilities.currentLiabilities.items.forEach((item) => {
    rows.push([item.code, item.name, item.amount, '']);
  });
  rows.push(['', 'Total Kewajiban Jangka Pendek', '', report.liabilities.currentLiabilities.total]);

  rows.push(['B. Kewajiban Jangka Panjang', '', '', '']);
  report.liabilities.longTermLiabilities.items.forEach((item) => {
    rows.push([item.code, item.name, item.amount, '']);
  });
  rows.push(['', 'Total Kewajiban Jangka Panjang', '', report.liabilities.longTermLiabilities.total]);
  rows.push(['', 'Total Seluruh Kewajiban', '', report.liabilities.totalLiabilities]);

  rows.push(['C. Ekuitas / Modal', '', '', '']);
  report.equity.capital.items.forEach((item) => {
    rows.push([item.code, item.name, item.amount, '']);
  });
  rows.push(['', 'Laba / Hasil Usaha Periode Berjalan', report.equity.currentPeriodProfit, '']);
  rows.push(['', 'Total Ekuitas / Modal Bersih', '', report.equity.totalEquity]);
  rows.push(['', 'TOTAL PASIVA (KEWAJIBAN + EKUITAS)', '', report.totalLiabilitiesAndEquity]);
  rows.push(['', 'STATUS KESEIMBANGAN (BALANCE)', report.isBalanced ? 'SEIMBANG (OK)' : 'SELISIH', report.discrepancy]);

  rows.push([]);
  rows.push(['Lembar Pengesahan Laporan Keuangan BUMDes Bogem:']);
  rows.push(['Mengetahui,', 'Disetujui Oleh,', '', 'Dibuat Oleh,']);
  rows.push(['Kepala Desa Bogem', 'Direktur / Ketua BUMDes', '', 'Bendahara BUMDes']);
  rows.push(['', '', '', '']);
  rows.push(['( ................................... )', '( ................................... )', '', '( ................................... )']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 15 }, { wch: 38 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Neraca');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

