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
  'Laporan Bulanan',
  'Laporan Laba Rugi',
  'Neraca Keuangan',
  'Laporan Arus Kas',
  'Laporan Perubahan Modal',
  'Buku Besar Kas',
];

/**
 * Standard Sign-off Block (Tanda Tangan Pengesahan Desa)
 */
function getSignatureBlock(): (string | number)[][] {
  return [
    ['', '', '', ''],
    ['Lembar Pengesahan Laporan Keuangan Desa Bogem:', '', '', ''],
    ['Mengetahui,', 'Disetujui Oleh,', '', 'Dibuat Oleh,'],
    ['Kepala Desa Bogem', 'Ketua BUMDes Bogem', '', 'Bendahara Catering'],
    ['', '', '', ''],
    ['', '', '', ''],
    ['( ......................................... )', '( ......................................... )', '', '( ......................................... )'],
  ];
}

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

    lastHeadersEnsured = now;
    return { success: true };
  } catch (error) {
    console.error('Error ensureSheetHeaders:', error);
    return { success: false, error };
  }
}

/**
 * Helper Canggih: Menerapkan Styling Premium (Navy Theme, Borders, Number Formatting, Auto Merging)
 */
async function applyPremiumFormatting(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
  options: {
    maxCols: number;
    colWidths: number[];
    titleRowsCount: number;
    headerRowIndex?: number;
    sectionBannerRows?: number[];
    currencyCols?: number[];
    centerCols?: number[];
    numberCols?: number[];
    highlightRows?: { rowIndex: number; type: 'green' | 'blue' | 'gray' }[];
    totalRows?: number[];
    totalRowCount: number;
  }
) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetTitle);
    if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) return;
    const sheetId = sheet.properties.sheetId;

    const requests: sheets_v4.Schema$Request[] = [];

    // 1. Reset Lebar Kolom
    options.colWidths.forEach((pixelSize, index) => {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: index,
            endIndex: index + 1,
          },
          properties: { pixelSize },
          fields: 'pixelSize',
        },
      });
    });

    // 2. Clear default format & unmerge range awal
    requests.push({
      unmergeCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: options.totalRowCount + 10,
          startColumnIndex: 0,
          endColumnIndex: options.maxCols + 2,
        },
      },
    });

    // 3. Format Title Header (Navy Dark #0F172A, White Text, Centered, Merged)
    for (let r = 0; r < options.titleRowsCount; r++) {
      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: r,
            endRowIndex: r + 1,
            startColumnIndex: 0,
            endColumnIndex: options.maxCols,
          },
          mergeType: 'MERGE_ALL',
        },
      });

      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: r,
            endRowIndex: r + 1,
            startColumnIndex: 0,
            endColumnIndex: options.maxCols,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 }, // #0F172A
              horizontalAlignment: 'CENTER',
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: r === 0 ? 12 : r === 1 ? 10 : 9,
                bold: r === 0 || r === 2,
                italic: r === 1 || r === 3,
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
    }

    // 4. Format Column Header Row
    if (options.headerRowIndex !== undefined) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: options.headerRowIndex,
            endRowIndex: options.headerRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: options.maxCols,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 30 / 255, green: 41 / 255, blue: 59 / 255 }, // #1E293B
              horizontalAlignment: 'CENTER',
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 10,
                bold: true,
              },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      });
    }

    // 5. Format Section Banners (misal: "I. LAPORAN LABA RUGI")
    if (options.sectionBannerRows) {
      options.sectionBannerRows.forEach((r) => {
        requests.push({
          mergeCells: {
            range: {
              sheetId,
              startRowIndex: r,
              endRowIndex: r + 1,
              startColumnIndex: 0,
              endColumnIndex: options.maxCols,
            },
            mergeType: 'MERGE_ALL',
          },
        });
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: r,
              endRowIndex: r + 1,
              startColumnIndex: 0,
              endColumnIndex: options.maxCols,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 15 / 255, green: 23 / 255, blue: 42 / 255 }, // #0F172A
                horizontalAlignment: 'LEFT',
                textFormat: {
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                  fontSize: 10,
                  bold: true,
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        });
      });
    }

    // 6. Format Numbering Integer Columns (agar No: 1, 2, 3 tidak jadi 31/12/1899)
    if (options.numberCols) {
      options.numberCols.forEach((colIdx) => {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: (options.headerRowIndex ?? 0) + 1,
              endRowIndex: options.totalRowCount,
              startColumnIndex: colIdx,
              endColumnIndex: colIdx + 1,
            },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                numberFormat: {
                  type: 'NUMBER',
                  pattern: '0',
                },
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment,numberFormat)',
          },
        });
      });
    }

    // 7. Format Center Columns (misal Tanggal, Kode Akun, Petugas)
    if (options.centerCols) {
      options.centerCols.forEach((colIdx) => {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: (options.headerRowIndex ?? 0) + 1,
              endRowIndex: options.totalRowCount,
              startColumnIndex: colIdx,
              endColumnIndex: colIdx + 1,
            },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment)',
          },
        });
      });
    }

    // 8. Format Currency Columns (Rp Rupiah)
    if (options.currencyCols) {
      options.currencyCols.forEach((colIdx) => {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: (options.headerRowIndex ?? 0) + 1,
              endRowIndex: options.totalRowCount,
              startColumnIndex: colIdx,
              endColumnIndex: colIdx + 1,
            },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'RIGHT',
                numberFormat: {
                  type: 'CURRENCY',
                  pattern: '"Rp"#,##0;("Rp"#,##0);"-"',
                },
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment,numberFormat)',
          },
        });
      });
    }

    // 9. Format Highlight Rows (Green untuk Laba Bersih & Seimbang)
    if (options.highlightRows) {
      options.highlightRows.forEach(({ rowIndex, type }) => {
        const isGreen = type === 'green';
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 0,
              endColumnIndex: options.maxCols,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: isGreen
                  ? { red: 236 / 255, green: 253 / 255, blue: 245 / 255 } // #ECFDF5
                  : { red: 241 / 255, green: 245 / 255, blue: 249 / 255 },
                textFormat: {
                  foregroundColor: isGreen
                    ? { red: 4 / 255, green: 120 / 255, blue: 87 / 255 } // #047857
                    : { red: 15 / 255, green: 23 / 255, blue: 42 / 255 },
                  bold: true,
                },
                borders: {
                  top: { style: 'SOLID', color: { red: 0.7, green: 0.7, blue: 0.7 } },
                  bottom: { style: 'SOLID', color: { red: 0.7, green: 0.7, blue: 0.7 } },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,borders)',
          },
        });
      });
    }

    // 10. Format Total Rows (Subtotals & Grand Totals)
    if (options.totalRows) {
      options.totalRows.forEach((r) => {
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: r,
              endRowIndex: r + 1,
              startColumnIndex: 0,
              endColumnIndex: options.maxCols,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                borders: {
                  top: { style: 'SOLID', color: { red: 0.6, green: 0.6, blue: 0.6 } },
                  bottom: { style: 'DOUBLE', color: { red: 0.2, green: 0.2, blue: 0.2 } },
                },
              },
            },
            fields: 'userEnteredFormat(textFormat,borders)',
          },
        });
      });
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }
  } catch (err) {
    console.warn(`Gagal menerapkan premium format pada sheet "${sheetTitle}":`, err);
  }
}

// ==========================================
// TRANSAKSI KAS (PEMBUKUAN) - BUKU KAS UMUM
// ==========================================

export async function appendTransactionRow(
  trx: {
    id: string;
    type: 'PEMASUKAN' | 'PENGELUARAN';
    category: string;
    description: string;
    amount: number;
    date: Date | string;
    accountCode?: string;
    accountName?: string;
  },
  userName: string
) {
  const client = getGoogleAuthClient();
  if (!client) {
    return { success: false, reason: 'Credentials not configured' };
  }

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const isIncome = trx.type === 'PEMASUKAN';
    const debit = isIncome ? trx.amount : 0;
    const credit = !isIncome ? trx.amount : 0;

    const rowData = [
      formatDateIndo(trx.date),
      isIncome ? 'Uang Masuk (Penerimaan)' : 'Uang Keluar (Pengeluaran)',
      trx.accountCode || (isIncome ? '4001' : '5001'),
      trx.accountName || trx.category,
      trx.description,
      debit,
      credit,
      userName,
      trx.id,
    ];

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId: client.spreadsheetId,
      range: 'Pembukuan!B:J',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    const sheetRowId = extractRowNumberFromRange(res.data.updates?.updatedRange);

    // Auto update laporan keuangan di latar belakang untuk tahun transaksi bersangkutan
    const trxYear = new Date(trx.date).getFullYear();
    triggerDebouncedReportSync(trxYear);

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
    accountCode?: string;
    accountName?: string;
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
        range: 'Pembukuan!A:K',
      });
      const rows = allRows.data.values || [];
      const index = rows.findIndex((r) => r && (r[10] === trx.id || r[9] === trx.id || r[8] === trx.id || r[6] === trx.id));
      if (index !== -1) {
        targetRow = index + 1;
      }
    }

    if (!targetRow) {
      return appendTransactionRow(trx, userName);
    }

    const isIncome = trx.type === 'PEMASUKAN';
    const debit = isIncome ? trx.amount : 0;
    const credit = !isIncome ? trx.amount : 0;

    const rowData = [
      formatDateIndo(trx.date),
      isIncome ? 'Uang Masuk (Penerimaan)' : 'Uang Keluar (Pengeluaran)',
      trx.accountCode || (isIncome ? '4001' : '5001'),
      trx.accountName || trx.category,
      trx.description,
      debit,
      credit,
      userName,
      trx.id,
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: `Pembukuan!B${targetRow}:J${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    const trxYear = new Date(trx.date).getFullYear();
    triggerDebouncedReportSync(trxYear);

    return { success: true, sheetRowId: targetRow };
  } catch (error) {
    console.error('Error updating transaction in Google Sheets:', error);
    return { success: false, error };
  }
}

/**
 * Menghapus baris transaksi secara fisik dari Google Sheets (deleteDimension)
 */
export async function clearTransactionRow(sheetRowId?: number | null, trxId?: string) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: client.spreadsheetId,
    });
    const pembukuanSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === 'Pembukuan'
    );
    const sheetId = pembukuanSheet?.properties?.sheetId ?? 0;

    let targetRow = sheetRowId;

    if (!targetRow && trxId) {
      const colId = await sheets.spreadsheets.values.get({
        spreadsheetId: client.spreadsheetId,
        range: 'Pembukuan!A:K',
      });
      const rows = colId.data.values || [];
      const index = rows.findIndex((r) => r && r.some((c) => String(c).trim() === trxId.trim()));
      if (index !== -1) {
        targetRow = index + 1; // 1-indexed
      }
    }

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

    triggerDebouncedReportSync();

    return { success: true };
  } catch (error) {
    console.error('Error deleting transaction row from Google Sheets:', error);
    return { success: false, error };
  }
}

/**
 * Membersihkan seluruh tab Pembukuan dan mengisi ulang secara kronologis
 * dengan format nomor integer (No), Saldo Kas Berjalan, dan Navy Header rapi
 */
export async function compactPembukuanSheet() {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders(true);

    const activeTransactions = await prisma.transaction.findMany({
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      include: {
        account: { select: { code: true, name: true } },
        createdBy: { select: { name: true } },
      },
    });

    const nowFormatted = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());

    const titleBlock = [
      ['PEMERINTAH DESA BOGEM — BADAN USAHA MILIK DESA (BUMDES) BOGEM', '', '', '', '', '', '', '', '', '', ''],
      ['UNIT USAHA CATERING & PELAYANAN KONSUMSI', '', '', '', '', '', '', '', '', '', ''],
      ['BUKU KAS UMUM (CATATAN TRANSAKSI MUTASI KAS KRONOLOGIS)', '', '', '', '', '', '', '', '', '', ''],
      [`Data Mencakup Tahun 2025 s/d Sekarang • Waktu Sinkronisasi: ${nowFormatted}`, '', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', ''],
    ];

    const header = [
      'No',
      'Tanggal',
      'Jenis Mutasi',
      'Kode Akun',
      'Pos Akun Keuangan (SAK EMKM)',
      'Keterangan / Rincian Transaksi',
      'Uang Masuk / Debit (Rp)',
      'Uang Keluar / Kredit (Rp)',
      'Saldo Kas Berjalan (Rp)',
      'Diinput Oleh',
      'ID Transaksi',
    ];

    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    const rows = activeTransactions.map((trx, index) => {
      const isIncome = trx.type === 'PEMASUKAN';
      const amt = Number(trx.amount);
      const debit = isIncome ? amt : 0;
      const credit = !isIncome ? amt : 0;

      if (isIncome) {
        runningBalance += amt;
        totalDebit += amt;
      } else {
        runningBalance -= amt;
        totalCredit += amt;
      }

      return [
        index + 1,
        formatDateIndo(trx.date),
        isIncome ? 'Uang Masuk (Penerimaan)' : 'Uang Keluar (Pengeluaran)',
        trx.account?.code || (isIncome ? '4001' : '5001'),
        trx.account?.name || trx.category,
        trx.description,
        debit,
        credit,
        runningBalance,
        trx.createdBy?.name || 'Petugas',
        trx.id,
      ];
    });

    const summaryRow = [
      '',
      'TOTAL MUTASI & SALDO KAS AKHIR',
      '',
      '',
      '',
      `${activeTransactions.length} Transaksi Tercatat`,
      totalDebit,
      totalCredit,
      runningBalance,
      '',
      '',
    ];

    const allValues = [
      ...titleBlock,
      header,
      ...rows,
      summaryRow,
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '', '', '', '', '', '', '', ''],
      ...getSignatureBlock(),
    ];

    // Bersihkan seluruh tab Pembukuan
    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Pembukuan!A1:Z10000',
    }).catch(() => {});

    // Tulis data baru yang bersih
    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Pembukuan!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: allValues,
      },
    });

    // Tandai semua transaksi di database sebagai tersinkron
    await prisma.transaction.updateMany({
      data: { syncedToSheet: true },
    });

    // Terapkan Premium Formatting
    const totalRowIndex = titleBlock.length + 1 + rows.length;
    await applyPremiumFormatting(sheets, client.spreadsheetId, 'Pembukuan', {
      maxCols: 11,
      colWidths: [45, 105, 130, 85, 220, 280, 150, 150, 160, 130, 150],
      titleRowsCount: 4,
      headerRowIndex: 5,
      numberCols: [0], // Column A is purely integer 0
      centerCols: [1, 2, 3, 9, 10], // Tanggal, Jenis, Kode, Petugas, ID
      currencyCols: [6, 7, 8], // Debit, Kredit, Saldo
      totalRows: [totalRowIndex],
      highlightRows: [{ rowIndex: totalRowIndex, type: 'gray' }],
      totalRowCount: allValues.length,
    });

    return { success: true, count: rows.length };
  } catch (error) {
    console.error('Error compacting Pembukuan sheet:', error);
    return { success: false, error };
  }
}

let debounceReportSyncTimer: NodeJS.Timeout | null = null;

export function triggerDebouncedReportSync(targetYear?: number) {
  if (debounceReportSyncTimer) {
    clearTimeout(debounceReportSyncTimer);
  }
  debounceReportSyncTimer = setTimeout(() => {
    syncAllFinancialReportsToSheet({ year: targetYear }).catch(() => {});
  }, 4000);
}

// ==========================================
// TAB: LAPORAN BULANAN (REKAP KEUANGAN BULANAN)
// ==========================================

export async function syncMonthlyFinancialReportToSheet(targetYear?: number, targetMonth?: number) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const now = new Date();
    const year = targetYear || now.getFullYear();
    const month = targetMonth !== undefined ? targetMonth : now.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [incomeStatement, cashFlow, balanceSheet] = await Promise.all([
      getIncomeStatement(startDate, endDate),
      getCashFlowSummary(startDate, endDate),
      getBalanceSheet(endDate),
    ]);

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const periodTitle = `${monthNames[month]} ${year}`;
    const nowFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date());

    const rawValues: (string | number)[][] = [
      ['LAPORAN KEUANGAN KAS BULANAN — BUMDES BOGEM', '', '', ''],
      [`Unit Usaha Catering Desa Bogem • Periode: ${periodTitle}`, '', '', ''],
      [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['I. LAPORAN LABA RUGI (INCOME STATEMENT)', '', '', ''],
      ['Kode Akun', 'Nama Akun / Pos Keuangan', 'Jumlah (Rp)', 'Keterangan'],
      ['A. PENDAPATAN USAHA CATERING', '', '', ''],
    ];

    if (incomeStatement.revenue.accounts.length === 0) {
      rawValues.push(['', 'Tidak ada pendapatan pada periode ini', 0, 'Belum ada transaksi']);
    } else {
      for (const acc of incomeStatement.revenue.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    const totalRevRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL PENDAPATAN (A)', incomeStatement.revenue.total, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. BEBAN OPERASIONAL', '', '', '']);
    if (incomeStatement.operatingExpenses.accounts.length === 0) {
      rawValues.push(['', 'Tidak ada beban operasional pada periode ini', 0, 'Belum ada transaksi']);
    } else {
      for (const acc of incomeStatement.operatingExpenses.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    const totalExpRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL BEBAN OPERASIONAL (B)', incomeStatement.operatingExpenses.total, '']);
    rawValues.push(['', 'LABA OPERASIONAL / KOTOR (A dikurangi B)', incomeStatement.grossOperatingProfit, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['C. BEBAN NON-OPERASIONAL', '', '', '']);
    if (incomeStatement.nonOperatingExpenses.accounts.length === 0) {
      rawValues.push(['', 'Tidak ada beban non-operasional pada periode ini', 0, 'Belum ada transaksi']);
    } else {
      for (const acc of incomeStatement.nonOperatingExpenses.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    rawValues.push(['', 'TOTAL BEBAN NON-OPERASIONAL (C)', incomeStatement.nonOperatingExpenses.total, '']);
    
    const netIncomeRowIdx = rawValues.length;
    rawValues.push([
      '',
      'LABA / (RUGI) BERSIH PERIODE BERJALAN',
      incomeStatement.netIncome,
      incomeStatement.netIncome >= 0 ? 'Surplus Laba' : 'Defisit Rugi',
    ]);
    rawValues.push(['', '', '', '']);

    // Section II: Arus Kas
    const section2RowIdx = rawValues.length;
    rawValues.push(['II. REKAPITULASI ARUS KAS (CASH FLOW)', '', '', '']);
    rawValues.push(['No', 'Pos Aliran Kas', 'Jumlah (Rp)', 'Keterangan / Status Kas']);
    rawValues.push(['1', 'Saldo Kas Awal Periode', cashFlow.openingCashBalance, 'Kas awal periode']);
    rawValues.push(['2', 'Total Penerimaan Kas Operasi', cashFlow.operatingActivities.totalInflow, 'Penerimaan operasional']);
    rawValues.push(['3', 'Total Pengeluaran Kas Operasi', cashFlow.operatingActivities.totalOutflow, 'Pengeluaran operasional']);
    rawValues.push(['4', 'Arus Kas Bersih Operasional', cashFlow.operatingActivities.netAmount, '']);
    rawValues.push(['5', 'Arus Kas Bersih Investasi & Modal', cashFlow.investingActivities.netAmount + cashFlow.financingActivities.netAmount, '']);
    
    const endingCashRowIdx = rawValues.length;
    rawValues.push(['', 'SALDO KAS AKHIR PERIODE (REKONSILIASI KAS NERACA)', cashFlow.closingCashBalance, 'Kas Riil BUMDes']);
    rawValues.push(['', '', '', '']);

    // Section III: Neraca Ringkas
    const section3RowIdx = rawValues.length;
    rawValues.push(['III. RINGKASAN POSISI KEUANGAN (NERACA KAS)', '', '', '']);
    rawValues.push(['Pos Neraca', 'Uraian Akuntansi', 'Jumlah (Rp)', 'Status Keseimbangan']);
    rawValues.push(['Total Aset / Aktiva', 'Seluruh Kekayaan Kas & Aset Usaha', balanceSheet.assets.totalAssets, 'Aktiva']);
    rawValues.push(['Total Kewajiban & Modal', 'Kewajiban Ditambah Ekuitas Akhir', balanceSheet.totalLiabilitiesAndEquity, 'Pasiva']);
    
    const balanceRowIdx = rawValues.length;
    rawValues.push([
      'Keseimbangan Neraca',
      balanceSheet.isBalanced ? 'Neraca Seimbang (Aktiva = Pasiva)' : 'Perlu Penyesuaian',
      balanceSheet.discrepancy,
      balanceSheet.isBalanced ? 'SEIMBANG (BALANCED)' : 'BELUM SEIMBANG',
    ]);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '']);
    rawValues.push(...getSignatureBlock());

    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Bulanan!A1:Z500',
    }).catch(() => {});

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Bulanan!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rawValues },
    });

    await applyPremiumFormatting(sheets, client.spreadsheetId, 'Laporan Bulanan', {
      maxCols: 4,
      colWidths: [110, 340, 180, 220],
      titleRowsCount: 3,
      sectionBannerRows: [4, section2RowIdx, section3RowIdx],
      centerCols: [0, 3],
      currencyCols: [2],
      totalRows: [totalRevRowIdx, totalExpRowIdx, endingCashRowIdx],
      highlightRows: [
        { rowIndex: netIncomeRowIdx, type: 'green' },
        { rowIndex: balanceRowIdx, type: 'green' },
      ],
      totalRowCount: rawValues.length,
    });

    return { success: true, message: `Laporan Bulanan (${periodTitle}) berhasil disinkronkan ke Google Sheets` };
  } catch (error) {
    console.error('Error syncMonthlyFinancialReportToSheet:', error);
    return { success: false, error };
  }
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
      ['PEMERINTAH DESA BOGEM — BADAN USAHA MILIK DESA (BUMDES) BOGEM', '', '', ''],
      ['UNIT USAHA CATERING & PELAYANAN KONSUMSI', '', '', ''],
      ['LAPORAN LABA RUGI (STANDAR AKUNTANSI KEUANGAN SAK EMKM)', '', '', ''],
      [`Periode: ${periodFormatted} • Sinkronisasi: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['Kode Akun', 'Pos Akuntansi / Pos Keuangan', 'Jumlah (Rp)', 'Rincian Transaksi'],
      ['A. PENDAPATAN USAHA CATERING', '', '', ''],
    ];

    if (incomeStatement.revenue.accounts.length === 0) {
      rawValues.push(['', 'Tidak ada pendapatan pada periode ini', 0, 'Belum ada transaksi']);
    } else {
      for (const acc of incomeStatement.revenue.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    const revTotalRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL PENDAPATAN USAHA (A)', incomeStatement.revenue.total, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. BEBAN OPERASIONAL', '', '', '']);
    if (incomeStatement.operatingExpenses.accounts.length === 0) {
      rawValues.push(['', 'Tidak ada beban operasional pada periode ini', 0, 'Belum ada transaksi']);
    } else {
      for (const acc of incomeStatement.operatingExpenses.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    const expTotalRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL BEBAN OPERASIONAL (B)', incomeStatement.operatingExpenses.total, '']);
    rawValues.push(['', 'LABA OPERASIONAL / KOTOR (A dikurangi B)', incomeStatement.grossOperatingProfit, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['C. BEBAN NON-OPERASIONAL', '', '', '']);
    if (incomeStatement.nonOperatingExpenses.accounts.length === 0) {
      rawValues.push(['', 'Tidak ada beban non-operasional pada periode ini', 0, 'Belum ada transaksi']);
    } else {
      for (const acc of incomeStatement.nonOperatingExpenses.accounts) {
        rawValues.push([acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`]);
      }
    }
    rawValues.push(['', 'TOTAL BEBAN NON-OPERASIONAL (C)', incomeStatement.nonOperatingExpenses.total, '']);
    
    const netIncomeRowIdx = rawValues.length;
    rawValues.push([
      '',
      'LABA / (RUGI) BERSIH PERIODE BERJALAN',
      incomeStatement.netIncome,
      incomeStatement.netIncome >= 0 ? 'Surplus Laba' : 'Defisit Rugi',
    ]);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Laporan Laba Rugi ini disusun sesuai Standar Akuntansi Keuangan SAK EMKM.', '', '', '']);
    rawValues.push(...getSignatureBlock());

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

    await applyPremiumFormatting(sheets, client.spreadsheetId, 'Laporan Laba Rugi', {
      maxCols: 4,
      colWidths: [110, 340, 180, 220],
      titleRowsCount: 4,
      headerRowIndex: 5,
      centerCols: [0, 3],
      currencyCols: [2],
      totalRows: [revTotalRowIdx, expTotalRowIdx],
      highlightRows: [{ rowIndex: netIncomeRowIdx, type: 'green' }],
      totalRowCount: rawValues.length,
    });

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
      ['PEMERINTAH DESA BOGEM — BADAN USAHA MILIK DESA (BUMDES) BOGEM', '', '', ''],
      ['UNIT USAHA CATERING & PELAYANAN KONSUMSI', '', '', ''],
      ['LAPORAN POSISI KEUANGAN (NERACA STANDAR SAK EMKM)', '', '', ''],
      [`Posisi Keuangan Per: ${dateFormatted} • Sinkronisasi: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['I. ASET (AKTIVA)', '', '', ''],
      ['Kode Akun', 'Pos Akun Keuangan', 'Jumlah (Rp)', 'Kategori SAK EMKM'],
      ['A. ASET LANCAR (CURRENT ASSETS)', '', '', ''],
    ];

    for (const item of balanceSheet.assets.currentAssets.items) {
      rawValues.push([item.code, item.name, item.amount, 'Aset Lancar']);
    }
    const totCurrentAssetRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL ASET LANCAR (A)', balanceSheet.assets.currentAssets.total, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. ASET TETAP & INVENTARIS', '', '', '']);
    if (balanceSheet.assets.fixedAssets.items.length === 0) {
      rawValues.push(['', 'Tidak ada aset tetap tercatat', 0, 'Aset Tetap']);
    } else {
      for (const item of balanceSheet.assets.fixedAssets.items) {
        rawValues.push([item.code, item.name, item.amount, item.amount < 0 ? 'Penyusutan' : 'Aset Tetap']);
      }
    }
    const totFixedAssetRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL ASET TETAP (B)', balanceSheet.assets.fixedAssets.total, '']);
    
    const totAssetRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL ASET / AKTIVA (A ditambah B)', balanceSheet.assets.totalAssets, 'Total Kekayaan Usaha']);
    rawValues.push(['', '', '', '']);

    const sec2RowIdx = rawValues.length;
    rawValues.push(['II. KEWAJIBAN & EKUITAS (PASIVA)', '', '', '']);
    rawValues.push(['Kode Akun', 'Pos Akun Keuangan', 'Jumlah (Rp)', 'Kategori SAK EMKM']);
    rawValues.push(['A. KEWAJIBAN / UTANG (LIABILITIES)', '', '', '']);

    const allLiabItems = [
      ...balanceSheet.liabilities.currentLiabilities.items,
      ...balanceSheet.liabilities.longTermLiabilities.items,
    ];

    if (allLiabItems.length === 0) {
      rawValues.push(['', 'Tidak ada kewajiban / utang tercatat', 0, 'Kewajiban Usaha']);
    } else {
      for (const item of allLiabItems) {
        rawValues.push([item.code, item.name, item.amount, 'Kewajiban Usaha']);
      }
    }
    const totLiabRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL KEWAJIBAN / UTANG (A)', balanceSheet.liabilities.totalLiabilities, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. EKUITAS & MODAL (EQUITY)', '', '', '']);
    for (const item of balanceSheet.equity.capital.items) {
      rawValues.push([item.code, item.name, item.amount, 'Modal Disetor BUMDes']);
    }
    rawValues.push([
      '3301',
      'Laba / Rugi Bersih Periode Berjalan',
      balanceSheet.equity.currentPeriodProfit,
      balanceSheet.equity.currentPeriodProfit >= 0 ? 'Surplus Berjalan' : 'Defisit Berjalan',
    ]);
    const totEquityRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL EKUITAS / MODAL (B)', balanceSheet.equity.totalEquity, '']);
    
    const totPasivaRowIdx = rawValues.length;
    rawValues.push([
      '',
      'TOTAL KEWAJIBAN & EKUITAS / PASIVA (A ditambah B)',
      balanceSheet.totalLiabilitiesAndEquity,
      'Total Kewajiban + Modal',
    ]);
    
    const balanceCheckRowIdx = rawValues.length;
    rawValues.push([
      '',
      'STATUS KESEIMBANGAN NERACA (AKTIVA dikurangi PASIVA)',
      balanceSheet.discrepancy,
      balanceSheet.isBalanced ? 'SEIMBANG (BALANCED)' : 'BELUM SEIMBANG',
    ]);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Laporan Neraca ini disusun sesuai Standar Akuntansi Keuangan SAK EMKM.', '', '', '']);
    rawValues.push(...getSignatureBlock());

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

    await applyPremiumFormatting(sheets, client.spreadsheetId, 'Neraca Keuangan', {
      maxCols: 4,
      colWidths: [110, 340, 180, 220],
      titleRowsCount: 4,
      sectionBannerRows: [5, sec2RowIdx],
      centerCols: [0, 3],
      currencyCols: [2],
      totalRows: [totCurrentAssetRowIdx, totFixedAssetRowIdx, totAssetRowIdx, totLiabRowIdx, totEquityRowIdx, totPasivaRowIdx],
      highlightRows: [
        { rowIndex: totAssetRowIdx, type: 'gray' },
        { rowIndex: balanceCheckRowIdx, type: 'green' },
      ],
      totalRowCount: rawValues.length,
    });

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
      ['PEMERINTAH DESA BOGEM — BADAN USAHA MILIK DESA (BUMDES) BOGEM', '', '', ''],
      ['UNIT USAHA CATERING & PELAYANAN KONSUMSI', '', '', ''],
      ['LAPORAN ARUS KAS (CASH FLOW STATEMENT — METODE LANGSUNG)', '', '', ''],
      [`Periode: ${periodFormatted} • Sinkronisasi: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['Kode / No', 'Pos Aktivitas Arus Kas (SAK EMKM)', 'Jumlah (Rp)', 'Kategori Kas'],
      ['1', 'Saldo Kas & Bank Awal Periode', cashFlow.openingCashBalance, 'Kas Awal'],
      ['', '', '', ''],
      ['A. ARUS KAS DARI AKTIVITAS OPERASI', '', '', ''],
    ];

    if (cashFlow.operatingActivities.inflows.length === 0) {
      rawValues.push(['', 'Tidak ada penerimaan operasi', 0, 'Penerimaan Kas']);
    } else {
      for (const item of cashFlow.operatingActivities.inflows) {
        rawValues.push([item.code, `Penerimaan dari ${item.name}`, item.amount, 'Penerimaan Kas']);
      }
    }

    if (cashFlow.operatingActivities.outflows.length === 0) {
      rawValues.push(['', 'Tidak ada pengeluaran operasi', 0, 'Pengeluaran Kas']);
    } else {
      for (const item of cashFlow.operatingActivities.outflows) {
        rawValues.push([item.code, `Pembayaran untuk ${item.name}`, -item.amount, 'Pengeluaran Kas']);
      }
    }
    const totOpCashRowIdx = rawValues.length;
    rawValues.push(['', 'Arus Kas Bersih Aktivitas Operasi (A)', cashFlow.operatingActivities.netAmount, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['B. ARUS KAS DARI AKTIVITAS INVESTASI', '', '', '']);
    if (cashFlow.investingActivities.outflows.length === 0) {
      rawValues.push(['', 'Tidak ada transaksi investasi', 0, 'Pengeluaran Investasi']);
    } else {
      for (const item of cashFlow.investingActivities.outflows) {
        rawValues.push([item.code, `Pembelian ${item.name}`, -item.amount, 'Pengeluaran Investasi']);
      }
    }
    const totInvCashRowIdx = rawValues.length;
    rawValues.push(['', 'Arus Kas Bersih Aktivitas Investasi (B)', cashFlow.investingActivities.netAmount, '']);
    rawValues.push(['', '', '', '']);

    rawValues.push(['C. ARUS KAS DARI AKTIVITAS PENDANAAN', '', '', '']);
    if (cashFlow.financingActivities.inflows.length > 0) {
      for (const item of cashFlow.financingActivities.inflows) {
        rawValues.push([item.code, `Penerimaan Modal: ${item.name}`, item.amount, 'Penerimaan Modal']);
      }
    }
    if (cashFlow.financingActivities.outflows.length > 0) {
      for (const item of cashFlow.financingActivities.outflows) {
        rawValues.push([item.code, `Bagi Hasil PADes: ${item.name}`, -item.amount, 'Pengeluaran Modal']);
      }
    }
    if (!cashFlow.financingActivities.inflows.length && !cashFlow.financingActivities.outflows.length) {
      rawValues.push(['', 'Tidak ada transaksi pendanaan', 0, 'Pendanaan Modal']);
    }
    const totFinCashRowIdx = rawValues.length;
    rawValues.push(['', 'Arus Kas Bersih Aktivitas Pendanaan (C)', cashFlow.financingActivities.netAmount, '']);
    rawValues.push(['', '', '', '']);

    const netCashFlowRowIdx = rawValues.length;
    rawValues.push(['', 'KENAIKAN / (PENURUNAN) KAS BERSIH (A + B + C)', cashFlow.netCashFlow, cashFlow.netCashFlow >= 0 ? 'Surplus Kas' : 'Defisit Kas']);
    
    const endCashRowIdx = rawValues.length;
    rawValues.push(['', 'SALDO KAS & BANK AKHIR PERIODE (REKONSILIASI KAS NERACA)', cashFlow.closingCashBalance, 'Kas Riil BUMDes']);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '']);
    rawValues.push(...getSignatureBlock());

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

    await applyPremiumFormatting(sheets, client.spreadsheetId, 'Laporan Arus Kas', {
      maxCols: 4,
      colWidths: [110, 360, 180, 220],
      titleRowsCount: 4,
      headerRowIndex: 5,
      centerCols: [0, 3],
      currencyCols: [2],
      totalRows: [totOpCashRowIdx, totInvCashRowIdx, totFinCashRowIdx, netCashFlowRowIdx, endCashRowIdx],
      highlightRows: [{ rowIndex: endCashRowIdx, type: 'green' }],
      totalRowCount: rawValues.length,
    });

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
      ['PEMERINTAH DESA BOGEM — BADAN USAHA MILIK DESA (BUMDES) BOGEM', '', '', ''],
      ['UNIT USAHA CATERING & PELAYANAN KONSUMSI', '', '', ''],
      ['LAPORAN PERUBAHAN MODAL / EKUITAS (STATEMENT OF CHANGES IN EQUITY)', '', '', ''],
      [`Periode: ${periodFormatted} • Sinkronisasi: ${nowFormatted}`, '', '', ''],
      ['', '', '', ''],
      ['No', 'Uraian / Pos Perubahan Ekuitas', 'Jumlah (Rp)', 'Keterangan'],
      ['1', `Modal Awal Periode (Per ${formatDateIndo(startDate)})`, equityStatement.beginningCapital, 'Modal Awal Disetor'],
      ['', `Laba / (Rugi) Bersih Periode Berjalan`, equityStatement.netIncome, equityStatement.netIncome >= 0 ? 'Surplus Laba' : 'Defisit Rugi'],
      ['', `Penambahan Modal / Investasi Baru BUMDes`, equityStatement.additionalCapital, 'Setoran Modal Baru'],
      ['', `Bagi Hasil PADes Desa Bogem`, -equityStatement.withdrawals, 'Prive / Bagi Hasil Desa'],
      ['2', `Kenaikan / (Penurunan) Modal Bersih`, equityStatement.netChange, equityStatement.netChange >= 0 ? 'Kenaikan Modal' : 'Penurunan Modal'],
    ];

    const endCapitalRowIdx = rawValues.length;
    rawValues.push(['3', `MODAL AKHIR PERIODE (TOTAL EKUITAS NERACA)`, equityStatement.endingCapital, 'Total Ekuitas Akhir']);
    rawValues.push(['', '', '', '']);
    rawValues.push(['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '']);
    rawValues.push(...getSignatureBlock());

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

    await applyPremiumFormatting(sheets, client.spreadsheetId, 'Laporan Perubahan Modal', {
      maxCols: 4,
      colWidths: [60, 380, 180, 220],
      titleRowsCount: 4,
      headerRowIndex: 5,
      numberCols: [0],
      centerCols: [3],
      currencyCols: [2],
      highlightRows: [{ rowIndex: endCapitalRowIdx, type: 'green' }],
      totalRowCount: rawValues.length,
    });

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

    const kasAccount = (await prisma.account.findFirst({
      where: { code: '1001' },
    })) || (await prisma.account.findFirst());

    if (!kasAccount) return { success: false, reason: 'Akun kas tidak ditemukan' };

    const gl = await getGeneralLedger(kasAccount.id, startDate, endDate);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'medium' }).format(new Date());
    const periodFormatted = `${formatDateIndo(startDate)} s/d ${formatDateIndo(endDate)}`;

    const rawValues: (string | number)[][] = [
      ['PEMERINTAH DESA BOGEM — BADAN USAHA MILIK DESA (BUMDES) BOGEM', '', '', '', '', ''],
      ['UNIT USAHA CATERING & PELAYANAN KONSUMSI', '', '', '', '', ''],
      [`BUKU BESAR [${gl.account.code}] ${gl.account.name.toUpperCase()}`, '', '', '', '', ''],
      [`Periode: ${periodFormatted} • Sinkronisasi: ${nowFormatted}`, '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['Tanggal', 'Keterangan Mutasi Kas', 'Petugas', 'Debit (Rp)', 'Kredit (Rp)', 'Saldo Kas (Rp)'],
      [formatDateIndo(startDate), 'SALDO AWAL KAS', 'Sistem', 0, 0, gl.openingBalance],
    ];

    if (gl.entries.length === 0) {
      rawValues.push(['', 'Tidak ada mutasi kas pada periode ini', 'Sistem', 0, 0, gl.openingBalance]);
    } else {
      for (const item of gl.entries) {
        rawValues.push([
          formatDateIndo(item.date),
          item.description,
          item.creatorName,
          item.debit,
          item.credit,
          item.runningBalance,
        ]);
      }
    }

    const totalGLRowIdx = rawValues.length;
    rawValues.push(['', 'TOTAL MUTASI & SALDO AKHIR', '', gl.totalDebit, gl.totalCredit, gl.closingBalance]);
    rawValues.push(['', '', '', '', '', '']);
    rawValues.push(['* Catatan: Data disinkronkan secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', '', '', '']);
    rawValues.push(...getSignatureBlock());

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

    await applyPremiumFormatting(sheets, client.spreadsheetId, 'Buku Besar Kas', {
      maxCols: 6,
      colWidths: [110, 320, 130, 150, 150, 160],
      titleRowsCount: 4,
      headerRowIndex: 5,
      centerCols: [0, 2],
      currencyCols: [3, 4, 5],
      totalRows: [totalGLRowIdx],
      highlightRows: [{ rowIndex: totalGLRowIdx, type: 'gray' }],
      totalRowCount: rawValues.length,
    });

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

    // SMART AUTO-DETECTION: Jika tahun tidak ditentukan, ambil tahun dari transaksi terbaru atau 2025/2026
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
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    } else if (periodType === 'year') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    } else {
      startDate = new Date(year, month, 1);
      endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
    }

    // Jalankan sinkronisasi seluruh lembar laporan secara berurutan
    const [monthRes, incRes, balRes, cfRes, eqRes, glRes] = [
      await syncMonthlyFinancialReportToSheet(year, month),
      await syncIncomeStatementToSheet(startDate, endDate),
      await syncBalanceSheetToSheet(endDate),
      await syncCashFlowToSheet(startDate, endDate),
      await syncEquityStatementToSheet(startDate, endDate),
      await syncGeneralLedgerToSheet(startDate, endDate),
    ];

    const allSuccess =
      monthRes.success && incRes.success && balRes.success && cfRes.success && eqRes.success && glRes.success;

    return {
      success: allSuccess,
      year,
      month,
      periodType,
      message: `Seluruh laporan keuangan (Tahun ${year}) berhasil disinkronkan ke Google Sheets`,
      details: { monthRes, incRes, balRes, cfRes, eqRes, glRes },
    };
  } catch (error) {
    console.error('Error in syncAllFinancialReportsToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// RETRY SYNC UNTUK DATA PENDING & COMPACT
// ==========================================

export async function retryPendingSync(targetYear?: number) {
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
    const reportResult = await syncAllFinancialReportsToSheet({ year: targetYear });

    return {
      success: compactResult.success && reportResult.success,
      message: `Berhasil merapikan ${compactResult.count ?? 0} transaksi serta memperbarui seluruh lembar laporan ke Google Sheets.`,
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

