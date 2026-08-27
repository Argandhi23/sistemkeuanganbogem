import { google, sheets_v4 } from 'googleapis';
import prisma from './prisma';
import {
  getIncomeStatement,
  getCashFlowSummary,
  getBalanceSheet,
  getEquityStatement,
  getGeneralLedger,
} from './accounting';

// Helper untuk format tanggal Indonesia
export function formatDateIndo(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatRupiahNumber(val: number | string): number {
  return Number(val) || 0;
}

// Inisialisasi Auth Google Service Account
function getGoogleAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!email || !privateKey || !spreadsheetId) {
    return null;
  }

  // Bersihkan newline jika ada escaped \n di env variable
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return { auth, spreadsheetId };
  } catch (error) {
    console.error('Gagal inisialisasi Google Auth Client:', error);
    return null;
  }
}

// Helper untuk extract row number dari updatedRange (contoh: "Pembukuan!A14:G14" -> 14)
function extractRowNumberFromRange(rangeStr?: string | null): number | null {
  if (!rangeStr) return null;
  const match = rangeStr.match(/![A-Z]+(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

// Helper untuk mengatur lebar kolom (Pixel Width) pada sheet tertentu
export async function setSheetColumnWidths(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  widths: number[]
) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) return;
    const sheetId = sheet.properties.sheetId;

    const requests = widths.map((pixelSize, index) => ({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: index,
          endIndex: index + 1,
        },
        properties: {
          pixelSize,
        },
        fields: 'pixelSize',
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  } catch (err) {
    console.warn(`Gagal mengatur lebar kolom untuk sheet "${sheetTitle}":`, err);
  }
}

// Cache status header agar tidak berulang kali memanggil Google Sheets API metadata
let lastHeadersEnsured = 0;
const HEADERS_CACHE_TTL = 30 * 60 * 1000; // 30 menit

const REQUIRED_SHEET_TABS = [
  'Pembukuan',
  'Laporan Laba Rugi',
  'Neraca Keuangan',
  'Laporan Arus Kas',
  'Laporan Perubahan Modal',
  'Buku Besar Kas',
];

/**
 * Memastikan Tab dan Header ada di spreadsheet jika baru dibuat
 */
export async function ensureSheetHeaders(force = false) {
  const now = Date.now();
  if (!force && now - lastHeadersEnsured < HEADERS_CACHE_TTL) {
    return { success: true };
  }

  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    const ssMeta = await sheets.spreadsheets.get({
      spreadsheetId: client.spreadsheetId,
    });
    const sheetTitles = ssMeta.data.sheets?.map((s) => s.properties?.title || '') || [];

    const addSheetRequests = REQUIRED_SHEET_TABS
      .filter((title) => !sheetTitles.includes(title))
      .map((title) => ({
        addSheet: { properties: { title } },
      }));

    if (addSheetRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: client.spreadsheetId,
        requestBody: { requests: addSheetRequests },
      });
    }

    // Cek Header Pembukuan
    const resPembukuan = await sheets.spreadsheets.values.get({
      spreadsheetId: client.spreadsheetId,
      range: 'Pembukuan!A1:G1',
    }).catch(() => null);

    if (!resPembukuan?.data.values || resPembukuan.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: client.spreadsheetId,
        range: 'Pembukuan!A1:G1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [
            ['Tanggal', 'Tipe Transaksi', 'Kategori Pos', 'Deskripsi', 'Jumlah (Rp)', 'Diinput Oleh', 'ID Transaksi'],
          ],
        },
      });
    }

    // Atur lebar kolom untuk sheet Pembukuan
    await setSheetColumnWidths(sheets, client.spreadsheetId, 'Pembukuan', [120, 130, 240, 320, 160, 180, 220]);

    lastHeadersEnsured = now;
    return { success: true };
  } catch (error) {
    console.error('Error ensureSheetHeaders:', error);
    return { success: false, error };
  }
}

// ==========================================
// TRANSAKSI KAS (PEMBUKUAN)
// ==========================================

export async function appendTransactionRow(
  trx: {
    id: string;
    type: 'PEMASUKAN' | 'PENGELUARAN';
    category: string;
    description: string;
    amount: number;
    date: Date | string;
  },
  userName: string
) {
  const client = getGoogleAuthClient();
  if (!client) {
    return { success: false, reason: 'Credentials not configured' };
  }

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    const rowData = [
      formatDateIndo(trx.date),
      trx.type === 'PEMASUKAN' ? 'Uang Masuk' : 'Uang Keluar',
      trx.category,
      trx.description,
      trx.amount,
      userName,
      trx.id,
    ];

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: client.spreadsheetId,
      range: 'Pembukuan!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    const sheetRowId = extractRowNumberFromRange(res.data.updates?.updatedRange);

    // Auto update seluruh tab laporan di Google Sheets di latar belakang
    triggerDebouncedReportSync();

    return { success: true, sheetRowId };
  } catch (error) {
    console.error('Error appending transaction to Google Sheets:', error);
    return { success: false, error };
  }
}

export async function updateTransactionRow(
  sheetRowId: number | null | undefined,
  trx: {
    id: string;
    type: 'PEMASUKAN' | 'PENGELUARAN';
    category: string;
    description: string;
    amount: number;
    date: Date | string;
  },
  userName: string
) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    let targetRow = sheetRowId;

    if (!targetRow) {
      const allRows = await sheets.spreadsheets.values.get({
        spreadsheetId: client.spreadsheetId,
        range: 'Pembukuan!A:G',
      });
      const rows = allRows.data.values || [];
      const index = rows.findIndex((r) => r[6] === trx.id);
      if (index !== -1) {
        targetRow = index + 1;
      }
    }

    if (!targetRow) {
      return appendTransactionRow(trx, userName);
    }

    const rowData = [
      formatDateIndo(trx.date),
      trx.type === 'PEMASUKAN' ? 'Uang Masuk' : 'Uang Keluar',
      trx.category,
      trx.description,
      trx.amount,
      userName,
      trx.id,
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: `Pembukuan!A${targetRow}:G${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    triggerDebouncedReportSync();

    return { success: true, sheetRowId: targetRow };
  } catch (error) {
    console.error('Error updating transaction in Google Sheets:', error);
    return { success: false, error };
  }
}

/**
 * Menghapus baris transaksi secara fisik dari Google Sheets (deleteDimension)
 * sehingga tidak meninggalkan tulisan [DIHAPUS DARI SISTEM]
 */
export async function clearTransactionRow(sheetRowId?: number | null, trxId?: string) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    // 1. Dapatkan SheetId tab "Pembukuan"
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: client.spreadsheetId,
    });
    const pembukuanSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === 'Pembukuan'
    );
    const sheetId = pembukuanSheet?.properties?.sheetId ?? 0;

    let targetRow = sheetRowId;

    // 2. Cari baris berdasarkan ID Transaksi di Kolom G jika sheetRowId belum diketahui
    if (!targetRow && trxId) {
      const colG = await sheets.spreadsheets.values.get({
        spreadsheetId: client.spreadsheetId,
        range: 'Pembukuan!G:G',
      });
      const rows = colG.data.values || [];
      const index = rows.findIndex((r) => r[0] && String(r[0]).trim() === trxId.trim());
      if (index !== -1) {
        targetRow = index + 1; // 1-indexed
      }
    }

    // 3. Hapus baris secara fisik jika ditemukan
    if (targetRow && targetRow > 1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: client.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: targetRow - 1, // 0-indexed inclusive
                  endIndex: targetRow,       // 0-indexed exclusive
                },
              },
            },
          ],
        },
      });
    }

    // Perbarui laporan di Google Sheets secara otomatis
    triggerDebouncedReportSync();

    return { success: true };
  } catch (error) {
    console.error('Error deleting transaction row from Google Sheets:', error);
    return { success: false, error };
  }
}

/**
 * Membersihkan seluruh tab Pembukuan dan mengisi ulang hanya dengan transaksi aktif
 * (Menghapus seluruh baris lama [DIHAPUS DARI SISTEM] secara instan)
 */
export async function compactPembukuanSheet() {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders(true);

    const activeTransactions = await prisma.transaction.findMany({
      orderBy: { date: 'asc' },
      include: { createdBy: { select: { name: true } } },
    });

    const header = [
      'Tanggal',
      'Tipe Transaksi',
      'Kategori Pos',
      'Deskripsi',
      'Jumlah (Rp)',
      'Diinput Oleh',
      'ID Transaksi',
    ];

    const rows = activeTransactions.map((trx) => [
      formatDateIndo(trx.date),
      trx.type === 'PEMASUKAN' ? 'Uang Masuk' : 'Uang Keluar',
      trx.category,
      trx.description,
      Number(trx.amount),
      trx.createdBy?.name || 'Petugas',
      trx.id,
    ]);

    // Bersihkan seluruh tab Pembukuan
    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Pembukuan!A1:Z5000',
    }).catch(() => {});

    // Tulis data baru yang bersih
    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Pembukuan!A1:G' + (rows.length + 1),
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [header, ...rows],
      },
    });

    // Tandai semua transaksi di database sebagai tersinkron
    await prisma.transaction.updateMany({
      data: { syncedToSheet: true },
    });

    // Atur ulang lebar kolom
    await setSheetColumnWidths(sheets, client.spreadsheetId, 'Pembukuan', [120, 130, 240, 320, 160, 180, 220]);

    return { success: true, count: rows.length };
  } catch (error) {
    console.error('Error compacting Pembukuan sheet:', error);
    return { success: false, error };
  }
}

let debounceReportSyncTimer: NodeJS.Timeout | null = null;

export function triggerDebouncedReportSync() {
  if (debounceReportSyncTimer) {
    clearTimeout(debounceReportSyncTimer);
  }
  debounceReportSyncTimer = setTimeout(() => {
    syncAllFinancialReportsToSheet().catch(() => {});
  }, 4000);
}

// ==========================================
// TAB 1: LAPORAN LABA RUGI (INCOME STATEMENT)
// ==========================================

export async function syncIncomeStatementToSheet(
  startDateInput?: Date | string,
  endDateInput?: Date | string
) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const now = new Date();
    const startDate = startDateInput ? new Date(startDateInput) : new Date(now.getFullYear(), 0, 1);
    const endDate = endDateInput ? new Date(endDateInput) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const incomeStatement = await getIncomeStatement(startDate, endDate);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const periodFormatted = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;

    const rawValues: (string | number)[][] = [
      ['LAPORAN LABA RUGI — BUMDES BOGEM', '', '', ''],
      [`Unit Usaha Catering Desa Bogem • Periode: ${periodFormatted}`, '', '', ''],
      [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['Kode Akun', 'Pos Akuntansi / Keterangan', 'Jumlah (Rp)', 'Rincian Transaksi'],
      ['A. PENDAPATAN USAHA CATERING', '', '', ''],
    ];

    if (incomeStatement.revenue.accounts.length === 0) {
      rawValues.push(['-', 'Tidak ada pendapatan pada periode ini', 0, '-']);
    } else {
      for (const acc of incomeStatement.revenue.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    rawValues.push(['', 'TOTAL PENDAPATAN USAHA (A)', incomeStatement.revenue.total, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. BEBAN OPERASIONAL', '', '', '']);
    if (incomeStatement.operatingExpenses.accounts.length === 0) {
      rawValues.push(['-', 'Tidak ada beban operasional pada periode ini', 0, '-']);
    } else {
      for (const acc of incomeStatement.operatingExpenses.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    rawValues.push(['', 'TOTAL BEBAN OPERASIONAL (B)', incomeStatement.operatingExpenses.total, '']);
    rawValues.push(['', 'LABA OPERASIONAL / KOTOR (A − B)', incomeStatement.grossOperatingProfit, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['C. BEBAN NON-OPERASIONAL', '', '', '']);
    if (incomeStatement.nonOperatingExpenses.accounts.length === 0) {
      rawValues.push(['-', 'Tidak ada beban non-operasional pada periode ini', 0, '-']);
    } else {
      for (const acc of incomeStatement.nonOperatingExpenses.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    rawValues.push(['', 'TOTAL BEBAN NON-OPERASIONAL (C)', incomeStatement.nonOperatingExpenses.total, '']);
    rawValues.push([
      '',
      'LABA / (RUGI) BERSIH PERIODE BERJALAN',
      incomeStatement.netIncome,
      incomeStatement.netIncome >= 0 ? 'Surplus Laba' : 'Defisit Rugi',
    ]);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '']);

    // Clear & Update
    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Laba Rugi!A1:Z500',
    }).catch(() => {});

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Laba Rugi!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rawValues },
    });

    // Atur lebar kolom proporsional
    await setSheetColumnWidths(sheets, client.spreadsheetId, 'Laporan Laba Rugi', [120, 320, 180, 220]);

    return { success: true, message: 'Laporan Laba Rugi berhasil disinkronkan ke Google Sheets' };
  } catch (error) {
    console.error('Error syncIncomeStatementToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// TAB 2: NERACA KEUANGAN (BALANCE SHEET)
// ==========================================

export async function syncBalanceSheetToSheet(asOfDateInput?: Date | string) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const asOfDate = asOfDateInput ? new Date(asOfDateInput) : new Date();
    const balanceSheet = await getBalanceSheet(asOfDate);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const dateFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(asOfDate);

    const rawValues: (string | number)[][] = [
      ['LAPORAN POSISI KEUANGAN (NERACA) — BUMDES BOGEM', '', '', ''],
      [`Unit Usaha Catering Desa Bogem • Posisi Per: ${dateFormatted}`, '', '', ''],
      [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['I. ASET (AKTIVA)', '', '', ''],
      ['Kode Akun', 'Pos Akun Keuangan', 'Jumlah (Rp)', 'Kategori SAK EMKM'],
      ['A. ASET LANCAR (CURRENT ASSETS)', '', '', ''],
    ];

    for (const item of balanceSheet.assets.currentAssets.items) {
      rawValues.push([item.code, item.name, item.amount, 'Aset Lancar']);
    }
    rawValues.push(['', 'TOTAL ASET LANCAR (A)', balanceSheet.assets.currentAssets.total, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. ASET TETAP & INVENTARIS', '', '', '']);
    if (balanceSheet.assets.fixedAssets.items.length === 0) {
      rawValues.push(['-', 'Tidak ada aset tetap tercatat', 0, '-']);
    } else {
      for (const item of balanceSheet.assets.fixedAssets.items) {
        rawValues.push([item.code, item.name, item.amount, item.amount < 0 ? 'Penyusutan' : 'Aset Tetap']);
      }
    }
    rawValues.push(['', 'TOTAL ASET TETAP (B)', balanceSheet.assets.fixedAssets.total, '']);
    rawValues.push(['', 'TOTAL ASET / AKTIVA (A + B)', balanceSheet.assets.totalAssets, 'Total Seluruh Kekayaan Usaha']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['II. KEWAJIBAN & EKUITAS (PASIVA)', '', '', '']);
    rawValues.push(['Kode Akun', 'Pos Akun Keuangan', 'Jumlah (Rp)', 'Kategori SAK EMKM']);
    rawValues.push(['A. KEWAJIBAN / UTANG (LIABILITIES)', '', '', '']);

    const allLiabItems = [
      ...balanceSheet.liabilities.currentLiabilities.items,
      ...balanceSheet.liabilities.longTermLiabilities.items,
    ];

    if (allLiabItems.length === 0) {
      rawValues.push(['-', 'Tidak ada kewajiban / utang', 0, '-']);
    } else {
      for (const item of allLiabItems) {
        rawValues.push([item.code, item.name, item.amount, 'Kewajiban Usaha']);
      }
    }
    rawValues.push(['', 'TOTAL KEWAJIBAN / UTANG (A)', balanceSheet.liabilities.totalLiabilities, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. EKUITAS & MODAL (EQUITY)', '', '', '']);
    for (const item of balanceSheet.equity.capital.items) {
      rawValues.push([item.code, item.name, item.amount, 'Modal Disetor']);
    }
    rawValues.push([
      '3301',
      'Laba / Rugi Bersih Periode Berjalan',
      balanceSheet.equity.currentPeriodProfit,
      balanceSheet.equity.currentPeriodProfit >= 0 ? 'Surplus Berjalan' : 'Defisit Berjalan',
    ]);
    rawValues.push(['', 'TOTAL EKUITAS / MODAL (B)', balanceSheet.equity.totalEquity, '']);
    rawValues.push([
      '',
      'TOTAL KEWAJIBAN & EKUITAS / PASIVA (A + B)',
      balanceSheet.totalLiabilitiesAndEquity,
      'Total Kewajiban + Modal',
    ]);
    rawValues.push([
      '',
      'KESEIMBANGAN NERACA (AKTIVA − PASIVA)',
      balanceSheet.discrepancy,
      balanceSheet.isBalanced ? 'SEIMBANG (BALANCED)' : 'BELUM SEIMBANG',
    ]);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Laporan Neraca ini disusun sesuai Standar Akuntansi Keuangan SAK EMKM.', '', '', '']);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Neraca Keuangan!A1:Z500',
    }).catch(() => {});

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Neraca Keuangan!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rawValues },
    });

    // Atur lebar kolom proporsional
    await setSheetColumnWidths(sheets, client.spreadsheetId, 'Neraca Keuangan', [120, 320, 180, 220]);

    return { success: true, message: `Neraca Keuangan per ${dateFormatted} berhasil disinkronkan ke Google Sheets` };
  } catch (error) {
    console.error('Error syncBalanceSheetToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// TAB 3: LAPORAN ARUS KAS (CASH FLOW)
// ==========================================

export async function syncCashFlowToSheet(
  startDateInput?: Date | string,
  endDateInput?: Date | string
) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const now = new Date();
    const startDate = startDateInput ? new Date(startDateInput) : new Date(now.getFullYear(), 0, 1);
    const endDate = endDateInput ? new Date(endDateInput) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const cashFlow = await getCashFlowSummary(startDate, endDate);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const periodFormatted = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;

    const rawValues: (string | number)[][] = [
      ['LAPORAN ARUS KAS (CASH FLOW) — BUMDES BOGEM', '', '', ''],
      [`Unit Usaha Catering Desa Bogem • Periode: ${periodFormatted}`, '', '', ''],
      [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['Kode / No', 'Pos Aktivitas Arus Kas (SAK EMKM)', 'Jumlah (Rp)', 'Kategori'],
      ['1', 'Saldo Kas & Bank Awal Periode', cashFlow.openingCashBalance, 'Kas Awal'],
      ['', '', '', ''],
      ['A. ARUS KAS DARI AKTIVITAS OPERASI', '', '', ''],
    ];

    if (cashFlow.operatingActivities.inflows.length === 0) {
      rawValues.push(['-', 'Tidak ada penerimaan operasi', 0, '-']);
    } else {
      for (const item of cashFlow.operatingActivities.inflows) {
        rawValues.push([item.code, `+ Penerimaan dari ${item.name}`, item.amount, 'Penerimaan Kas']);
      }
    }

    if (cashFlow.operatingActivities.outflows.length === 0) {
      rawValues.push(['-', 'Tidak ada pengeluaran operasi', 0, '-']);
    } else {
      for (const item of cashFlow.operatingActivities.outflows) {
        rawValues.push([item.code, `- Pembayaran untuk ${item.name}`, -item.amount, 'Pengeluaran Kas']);
      }
    }
    rawValues.push(['', 'Arus Kas Bersih Aktivitas Operasi (A)', cashFlow.operatingActivities.netAmount, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. ARUS KAS DARI AKTIVITAS INVESTASI', '', '', '']);
    if (cashFlow.investingActivities.outflows.length === 0) {
      rawValues.push(['-', 'Tidak ada transaksi investasi', 0, '-']);
    } else {
      for (const item of cashFlow.investingActivities.outflows) {
        rawValues.push([item.code, `- Pembelian ${item.name}`, -item.amount, 'Pengeluaran Investasi']);
      }
    }
    rawValues.push(['', 'Arus Kas Bersih Aktivitas Investasi (B)', cashFlow.investingActivities.netAmount, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['C. ARUS KAS DARI AKTIVITAS PENDANAAN', '', '', '']);
    if (cashFlow.financingActivities.inflows.length > 0) {
      for (const item of cashFlow.financingActivities.inflows) {
        rawValues.push([item.code, `+ Penerimaan ${item.name}`, item.amount, 'Penerimaan Modal']);
      }
    }
    if (cashFlow.financingActivities.outflows.length > 0) {
      for (const item of cashFlow.financingActivities.outflows) {
        rawValues.push([item.code, `- Penarikan / Bagi Hasil ${item.name}`, -item.amount, 'Pengeluaran Modal']);
      }
    }
    if (!cashFlow.financingActivities.inflows.length && !cashFlow.financingActivities.outflows.length) {
      rawValues.push(['-', 'Tidak ada transaksi pendanaan', 0, '-']);
    }
    rawValues.push(['', 'Arus Kas Bersih Aktivitas Pendanaan (C)', cashFlow.financingActivities.netAmount, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['', 'KENAIKAN / (PENURUNAN) KAS BERSIH (A + B + C)', cashFlow.netCashFlow, cashFlow.netCashFlow >= 0 ? 'Surplus Kas' : 'Defisit Kas']);
    rawValues.push(['', 'SALDO KAS & BANK AKHIR PERIODE', cashFlow.closingCashBalance, 'Kas Riil BUMDes']);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '']);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Arus Kas!A1:Z500',
    }).catch(() => {});

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Arus Kas!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rawValues },
    });

    // Atur lebar kolom proporsional
    await setSheetColumnWidths(sheets, client.spreadsheetId, 'Laporan Arus Kas', [120, 340, 180, 220]);

    return { success: true, message: 'Laporan Arus Kas berhasil disinkronkan ke Google Sheets' };
  } catch (error) {
    console.error('Error syncCashFlowToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// TAB 4: LAPORAN PERUBAHAN MODAL
// ==========================================

export async function syncEquityStatementToSheet(
  startDateInput?: Date | string,
  endDateInput?: Date | string
) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const now = new Date();
    const startDate = startDateInput ? new Date(startDateInput) : new Date(now.getFullYear(), 0, 1);
    const endDate = endDateInput ? new Date(endDateInput) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const equityStatement = await getEquityStatement(startDate, endDate);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const periodFormatted = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;

    const rawValues: (string | number)[][] = [
      ['LAPORAN PERUBAHAN MODAL (EKUITAS) — BUMDES BOGEM', '', '', ''],
      [`Unit Usaha Catering Desa Bogem • Periode: ${periodFormatted}`, '', '', ''],
      [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['No', 'Uraian / Pos Perubahan Ekuitas', 'Jumlah (Rp)', 'Keterangan'],
      ['1', `Modal Awal Periode (Per ${formatDateIndo(startDate)})`, equityStatement.beginningCapital, 'Modal Awal'],
      ['•', `Laba / (Rugi) Bersih Periode Berjalan`, equityStatement.netIncome, equityStatement.netIncome >= 0 ? 'Surplus Laba' : 'Defisit Rugi'],
      ['•', `Penambahan Modal / Investasi Baru BUMDes`, equityStatement.additionalCapital, 'Setoran Modal'],
      ['•', `Penarikan Modal / Bagi Hasil PADes Desa Bogem`, -equityStatement.withdrawals, 'Prive / Bagi Hasil'],
      ['2', `Kenaikan / (Penurunan) Modal Bersih`, equityStatement.netChange, equityStatement.netChange >= 0 ? 'Kenaikan Modal' : 'Penurunan Modal'],
      ['3', `MODAL AKHIR PERIODE (TOTAL EKUITAS NERACA)`, equityStatement.endingCapital, 'Total Ekuitas Akhir'],
      ['', '', '', ''],
      ['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', ''],
    ];

    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Perubahan Modal!A1:Z500',
    }).catch(() => {});

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Perubahan Modal!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rawValues },
    });

    // Atur lebar kolom proporsional
    await setSheetColumnWidths(sheets, client.spreadsheetId, 'Laporan Perubahan Modal', [80, 360, 180, 220]);

    return { success: true, message: 'Laporan Perubahan Modal berhasil disinkronkan ke Google Sheets' };
  } catch (error) {
    console.error('Error syncEquityStatementToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// TAB 5: BUKU BESAR KAS (GENERAL CASH LEDGER)
// ==========================================

export async function syncGeneralLedgerToSheet(
  startDateInput?: Date | string,
  endDateInput?: Date | string
) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const now = new Date();
    const startDate = startDateInput ? new Date(startDateInput) : new Date(now.getFullYear(), 0, 1);
    const endDate = endDateInput ? new Date(endDateInput) : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const kasAccount = await prisma.account.findFirst({
      where: { code: '1001' },
    }) || await prisma.account.findFirst();

    if (!kasAccount) return { success: false, reason: 'Akun kas tidak ditemukan' };

    const gl = await getGeneralLedger(kasAccount.id, startDate, endDate);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const periodFormatted = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;

    const rawValues: (string | number)[][] = [
      ['BUKU BESAR KAS (BUKU KAS UMUM) — BUMDES BOGEM', '', '', '', '', ''],
      [`Unit Usaha Catering Desa Bogem • Periode: ${periodFormatted}`, '', '', '', '', ''],
      [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Tanggal', 'Keterangan Mutasi', 'Petugas', 'Debit (Rp)', 'Kredit (Rp)', 'Saldo Kas (Rp)'],
      [formatDateIndo(startDate), 'SALDO AWAL KAS', 'Sistem', '-', '-', gl.openingBalance],
    ];

    if (gl.entries.length === 0) {
      rawValues.push(['-', 'Tidak ada mutasi kas pada periode ini', '-', 0, 0, gl.openingBalance]);
    } else {
      for (const item of gl.entries) {
        rawValues.push([
          formatDateIndo(item.date),
          item.description,
          item.creatorName,
          item.debit > 0 ? item.debit : '-',
          item.credit > 0 ? item.credit : '-',
          item.runningBalance,
        ]);
      }
    }

    rawValues.push(['', 'TOTAL MUTASI & SALDO AKHIR', '', gl.totalDebit, gl.totalCredit, gl.closingBalance]);
    rawValues.push(['', '', '', '', '', '']);
    rawValues.push(['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '', '', '']);

    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Buku Besar Kas!A1:Z5000',
    }).catch(() => {});

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Buku Besar Kas!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rawValues },
    });

    // Atur lebar kolom proporsional
    await setSheetColumnWidths(sheets, client.spreadsheetId, 'Buku Besar Kas', [110, 320, 140, 150, 150, 160]);

    return { success: true, message: 'Buku Besar Kas berhasil disinkronkan ke Google Sheets' };
  } catch (error) {
    console.error('Error syncGeneralLedgerToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// SINKRONISASI SELURUH LAPORAN KE GOOGLE SHEETS
// ==========================================

export async function syncAllFinancialReportsToSheet(options?: {
  year?: number;
  month?: number;
  periodType?: 'month' | 'year' | 'all';
}) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  try {
    let year = options?.year;
    let month = options?.month;
    const periodType = options?.periodType || 'year';

    // SMART AUTO-DETECTION: Jika tahun tidak ditentukan, ambil tahun dari transaksi aktif terbaru
    if (year === undefined || year === null) {
      const latestTrx = await prisma.transaction.findFirst({
        orderBy: { date: 'desc' },
        select: { date: true },
      });

      if (latestTrx) {
        year = latestTrx.date.getFullYear();
        month = latestTrx.date.getMonth();
      } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth();
      }
    }

    if (month === undefined || month === null) {
      month = 0; // Default awal tahun
    }

    let startDate: Date;
    let endDate: Date;

    if (periodType === 'all') {
      startDate = new Date(2020, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    } else if (periodType === 'year') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59);
    } else {
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0, 23, 59, 59);
    }

    // Jalankan secara sekuensial agar aman dan tidak membebani koneksi
    const incRes = await syncIncomeStatementToSheet(startDate, endDate);
    const balRes = await syncBalanceSheetToSheet(endDate);
    const cfRes = await syncCashFlowToSheet(startDate, endDate);
    const eqRes = await syncEquityStatementToSheet(startDate, endDate);
    const glRes = await syncGeneralLedgerToSheet(startDate, endDate);

    const allSuccess = incRes.success && balRes.success && cfRes.success && eqRes.success && glRes.success;

    return {
      success: allSuccess,
      year,
      month,
      periodType,
      message: `Seluruh laporan keuangan (Tahun ${year}) berhasil disinkronkan ke Google Sheets`,
      details: { incRes, balRes, cfRes, eqRes, glRes },
    };
  } catch (error) {
    console.error('Error in syncAllFinancialReportsToSheet:', error);
    return { success: false, error };
  }
}

// Backward compatibility alias
export async function syncMonthlyFinancialReportToSheet(targetYear?: number, targetMonth?: number) {
  return syncAllFinancialReportsToSheet({ year: targetYear, month: targetMonth });
}

// ==========================================
// RETRY SYNC UNTUK DATA PENDING & COMPACT
// ==========================================

export async function retryPendingSync() {
  const client = getGoogleAuthClient();
  if (!client) {
    return {
      success: false,
      message: 'Kredensial Google Sheets API belum dikonfigurasi.',
      syncedCount: 0,
      failedCount: 0,
    };
  }

  try {
    // 1. Lakukan pembersihan dan kompaksi sheet Pembukuan secara menyeluruh
    const compactResult = await compactPembukuanSheet();

    // 2. Perbarui seluruh Tab Laporan
    const reportResult = await syncAllFinancialReportsToSheet();

    return {
      success: compactResult.success && reportResult.success,
      message: `Berhasil menyinkronkan ${compactResult.count ?? 0} transaksi serta memperbarui seluruh lembar laporan ke Google Sheets.`,
      syncedCount: compactResult.count ?? 0,
      failedCount: 0,
    };
  } catch (error) {
    console.error('Error in retryPendingSync:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan saat memproses sinkronisasi ke Google Sheets',
      syncedCount: 0,
      failedCount: 0,
    };
  }
}

// Backward compatibility helpers
export async function appendOrderRow(order: unknown, userName: string) {
  void order;
  void userName;
  return { success: true, sheetRowId: null };
}

export async function updateOrderRow(sheetRowId: number | null | undefined, order: unknown, userName: string) {
  void order;
  void userName;
  return { success: true, sheetRowId };
}

export async function clearOrderRow(sheetRowId?: number | null, orderId?: string) {
  void sheetRowId;
  void orderId;
  return { success: true };
}

