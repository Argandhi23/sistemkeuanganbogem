import { google } from 'googleapis';
import prisma from './prisma';
import { getIncomeStatement, getCashFlowSummary, getBalanceSheet } from './accounting';

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

// Cache status header agar tidak berulang kali memanggil Google Sheets API metadata
let lastHeadersEnsured = 0;
const HEADERS_CACHE_TTL = 30 * 60 * 1000; // 30 menit

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
    // Dapatkan list sheet yang ada
    const ssMeta = await sheets.spreadsheets.get({
      spreadsheetId: client.spreadsheetId,
    });
    const sheetTitles = ssMeta.data.sheets?.map((s) => s.properties?.title || '') || [];

    // Buat sheet jika belum ada (termasuk Tab Neraca Keuangan)
    const requiredSheets = ['Pembukuan', 'Laporan Bulanan', 'Neraca Keuangan'];
    const addSheetRequests = requiredSheets
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

    // 1. Cek Header Pembukuan
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
            ['Tanggal', 'Tipe Transaksi', 'Kategori', 'Deskripsi', 'Jumlah (Rp)', 'Diinput Oleh', 'ID Transaksi'],
          ],
        },
      });
    }

    lastHeadersEnsured = now;
    return { success: true };
  } catch (error) {
    console.error('Error ensureSheetHeaders:', error);
    return { success: false, error };
  }
}

// ==========================================
// TRANSAKSI (PEMBUKUAN)
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

    // Auto update tab Laporan Bulanan & Neraca secara debounced di latar belakang
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

export async function clearTransactionRow(sheetRowId: number | null | undefined, trxId: string) {
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
      const index = rows.findIndex((r) => r[6] === trxId);
      if (index !== -1) {
        targetRow = index + 1;
      }
    }

    if (!targetRow) return { success: true };

    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: `Pembukuan!A${targetRow}:G${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [['[DIHAPUS DARI SISTEM]', '-', '-', '-', 0, '-', trxId]],
      },
    });

    triggerDebouncedReportSync();

    return { success: true };
  } catch (error) {
    console.error('Error clearing transaction in Google Sheets:', error);
    return { success: false, error };
  }
}

let debounceReportSyncTimer: NodeJS.Timeout | null = null;

export function triggerDebouncedReportSync() {
  if (debounceReportSyncTimer) {
    clearTimeout(debounceReportSyncTimer);
  }
  debounceReportSyncTimer = setTimeout(() => {
    syncMonthlyFinancialReportToSheet().catch(() => {});
    syncBalanceSheetToSheet().catch(() => {});
  }, 8000);
}

// ==========================================
// TAB 1: LAPORAN BULANAN (LABA RUGI & ARUS KAS)
// ==========================================

export async function syncMonthlyFinancialReportToSheet(targetYear?: number, targetMonth?: number) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const ssMeta = await sheets.spreadsheets.get({
      spreadsheetId: client.spreadsheetId,
    });
    const sheetObj = ssMeta.data.sheets?.find((s) => s.properties?.title === 'Laporan Bulanan');
    const sheetId = sheetObj?.properties?.sheetId ?? 0;

    const now = new Date();
    const year = targetYear !== undefined ? targetYear : now.getFullYear();
    const month = targetMonth !== undefined ? targetMonth : now.getMonth();

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const [incomeStatement, cashFlow] = await Promise.all([
      getIncomeStatement(startOfMonth, endOfMonth),
      getCashFlowSummary(startOfMonth, endOfMonth),
    ]);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());

    interface RowSpec {
      values: (string | number)[];
      type:
        | 'MAIN_TITLE'
        | 'SUBTITLE'
        | 'TIMESTAMP'
        | 'EMPTY'
        | 'SECTION_HEADER'
        | 'TABLE_HEADER'
        | 'CATEGORY_HEADER'
        | 'DATA_ROW'
        | 'SUBTOTAL_ROW'
        | 'NET_INCOME_ROW'
        | 'CASH_FINAL_ROW'
        | 'NOTE';
      isPositive?: boolean;
    }

    const rowSpecs: RowSpec[] = [
      {
        values: ['LAPORAN KEUANGAN KAS BULANAN — BUMDES BOGEM', '', '', ''],
        type: 'MAIN_TITLE',
      },
      {
        values: [`Unit Usaha Catering Desa Bogem • Periode: ${monthNames[month]} ${year}`, '', '', ''],
        type: 'SUBTITLE',
      },
      {
        values: [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', ''],
        type: 'TIMESTAMP',
      },
      { values: ['', '', '', ''], type: 'EMPTY' },

      // I. Laba Rugi
      {
        values: ['I. LAPORAN LABA RUGI (INCOME STATEMENT)', '', '', ''],
        type: 'SECTION_HEADER',
      },
      {
        values: ['Kode Akun', 'Nama Akun / Pos Keuangan', 'Jumlah (Rp)', 'Keterangan'],
        type: 'TABLE_HEADER',
      },
      {
        values: ['A. PENDAPATAN USAHA CATERING', '', '', ''],
        type: 'CATEGORY_HEADER',
      },
    ];

    // Data Pendapatan
    if (incomeStatement.revenue.accounts.length === 0) {
      rowSpecs.push({
        values: ['-', 'Tidak ada pendapatan pada periode ini', 0, '-'],
        type: 'DATA_ROW',
      });
    } else {
      for (const acc of incomeStatement.revenue.accounts) {
        rowSpecs.push({
          values: [acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`],
          type: 'DATA_ROW',
        });
      }
    }
    rowSpecs.push({
      values: ['', 'TOTAL PENDAPATAN (A)', incomeStatement.revenue.total, ''],
      type: 'SUBTOTAL_ROW',
    });
    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });

    // Data Beban Operasional
    rowSpecs.push({
      values: ['B. BEBAN OPERASIONAL', '', '', ''],
      type: 'CATEGORY_HEADER',
    });
    if (incomeStatement.operatingExpenses.accounts.length === 0) {
      rowSpecs.push({
        values: ['-', 'Tidak ada beban operasional pada periode ini', 0, '-'],
        type: 'DATA_ROW',
      });
    } else {
      for (const acc of incomeStatement.operatingExpenses.accounts) {
        rowSpecs.push({
          values: [acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`],
          type: 'DATA_ROW',
        });
      }
    }
    rowSpecs.push({
      values: ['', 'TOTAL BEBAN OPERASIONAL (B)', incomeStatement.operatingExpenses.total, ''],
      type: 'SUBTOTAL_ROW',
    });
    rowSpecs.push({
      values: ['', 'LABA OPERASIONAL / KOTOR (A − B)', incomeStatement.grossOperatingProfit, ''],
      type: 'SUBTOTAL_ROW',
    });
    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });

    // Data Beban Non-Operasional
    rowSpecs.push({
      values: ['C. BEBAN NON-OPERASIONAL', '', '', ''],
      type: 'CATEGORY_HEADER',
    });
    if (incomeStatement.nonOperatingExpenses.accounts.length === 0) {
      rowSpecs.push({
        values: ['-', 'Tidak ada beban non-operasional pada periode ini', 0, '-'],
        type: 'DATA_ROW',
      });
    } else {
      for (const acc of incomeStatement.nonOperatingExpenses.accounts) {
        rowSpecs.push({
          values: [acc.code, acc.name, acc.total, `${acc.transactionCount} transaksi`],
          type: 'DATA_ROW',
        });
      }
    }
    rowSpecs.push({
      values: ['', 'TOTAL BEBAN NON-OPERASIONAL (C)', incomeStatement.nonOperatingExpenses.total, ''],
      type: 'SUBTOTAL_ROW',
    });
    rowSpecs.push({
      values: [
        '',
        'LABA / RUGI BERSIH PERIODE BERJALAN',
        incomeStatement.netIncome,
        incomeStatement.netIncome >= 0 ? 'Surplus Laba' : 'Defisit Rugi',
      ],
      type: 'NET_INCOME_ROW',
      isPositive: incomeStatement.netIncome >= 0,
    });
    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });

    // II. Rekapitulasi Arus Kas (Perbaikan tata letak agar teks Col B tidak terpotong)
    rowSpecs.push({
      values: ['II. REKAPITULASI ARUS KAS (CASH FLOW)', '', '', ''],
      type: 'SECTION_HEADER',
    });
    rowSpecs.push({
      values: ['No', 'Pos Aliran Kas', 'Jumlah (Rp)', 'Keterangan / Status Kas'],
      type: 'TABLE_HEADER',
    });
    rowSpecs.push({
      values: ['1', 'Saldo Kas Awal Periode', cashFlow.openingCashBalance, 'Kas awal periode'],
      type: 'DATA_ROW',
    });

    rowSpecs.push({
      values: ['2. ARUS KAS MASUK (PENERIMAAN)', '', '', ''],
      type: 'CATEGORY_HEADER',
    });
    if (cashFlow.inflowBreakdown.length === 0) {
      rowSpecs.push({
        values: ['-', 'Tidak ada kas masuk pada periode ini', 0, '-'],
        type: 'DATA_ROW',
      });
    } else {
      for (const item of cashFlow.inflowBreakdown) {
        rowSpecs.push({
          values: ['•', item.name, item.amount, 'Penerimaan Kas'],
          type: 'DATA_ROW',
        });
      }
    }
    rowSpecs.push({
      values: ['', 'Subtotal Kas Masuk', cashFlow.totalCashInflow, 'Total penerimaan kas'],
      type: 'SUBTOTAL_ROW',
    });

    rowSpecs.push({
      values: ['3. ARUS KAS KELUAR (PENGELUARAN)', '', '', ''],
      type: 'CATEGORY_HEADER',
    });
    if (cashFlow.outflowBreakdown.length === 0) {
      rowSpecs.push({
        values: ['-', 'Tidak ada kas keluar pada periode ini', 0, '-'],
        type: 'DATA_ROW',
      });
    } else {
      for (const item of cashFlow.outflowBreakdown) {
        rowSpecs.push({
          values: ['•', item.name, item.amount, 'Pengeluaran Kas'],
          type: 'DATA_ROW',
        });
      }
    }
    rowSpecs.push({
      values: ['', 'Subtotal Kas Keluar', cashFlow.totalCashOutflow, 'Total pengeluaran kas'],
      type: 'SUBTOTAL_ROW',
    });

    rowSpecs.push({
      values: [
        '',
        'Arus Kas Bersih (Net Flow)',
        cashFlow.netCashFlow,
        cashFlow.netCashFlow >= 0 ? 'Surplus Kas' : 'Defisit Kas',
      ],
      type: 'SUBTOTAL_ROW',
    });

    rowSpecs.push({
      values: [
        '',
        'SALDO KAS AKHIR PERIODE',
        cashFlow.closingCashBalance,
        'Kas riil BUMDes saat ini',
      ],
      type: 'CASH_FINAL_ROW',
      isPositive: cashFlow.closingCashBalance >= 0,
    });

    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });
    rowSpecs.push({
      values: ['* Catatan: Data laporan ini diperbarui secara otomatis dari Aplikasi Pembukuan BUMDes Bogem.', '', '', ''],
      type: 'NOTE',
    });

    // 1. Kosongkan isi range tab Laporan Bulanan
    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Bulanan!A1:Z500',
    }).catch(() => {});

    // 2. Tulis data nilai mentah (values)
    const rawValues = rowSpecs.map((r) => r.values);
    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Laporan Bulanan!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rawValues,
      },
    });

    // 3. Susun batchUpdate formatting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatRequests: any[] = [
      {
        unmergeCells: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 500,
            startColumnIndex: 0,
            endColumnIndex: 20,
          },
        },
      },
      // Reset base format
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: rowSpecs.length + 10,
            startColumnIndex: 0,
            endColumnIndex: 4,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 1, green: 1, blue: 1 },
              textFormat: {
                fontFamily: 'Arial',
                fontSize: 10,
                bold: false,
                foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
              },
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'CLIP',
            },
          },
          fields: 'userEnteredFormat',
        },
      },
      // Lebar Kolom Dioptimalkan Agar Tidak Terpotong
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 120 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 380 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 180 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 220 },
          fields: 'pixelSize',
        },
      },
    ];

    rowSpecs.forEach((spec, rowIndex) => {
      if (spec.type === 'MAIN_TITLE') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
                  textFormat: { fontFamily: 'Arial', fontSize: 13, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      } else if (spec.type === 'SUBTITLE') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 },
                  textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true, foregroundColor: { red: 0.89, green: 0.92, blue: 0.95 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      } else if (spec.type === 'TIMESTAMP') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.97, green: 0.98, blue: 0.99 },
                  textFormat: { fontFamily: 'Arial', fontSize: 9, italic: true, foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      } else if (spec.type === 'SECTION_HEADER') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 },
                  textFormat: { fontFamily: 'Arial', fontSize: 11, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                    bottom: { style: 'SOLID', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
            },
          }
        );
      } else if (spec.type === 'TABLE_HEADER') {
        formatRequests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
                textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  bottom: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  left: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  right: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,borders)',
          },
        });
      } else if (spec.type === 'CATEGORY_HEADER') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.97, green: 0.98, blue: 0.99 },
                  textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true, foregroundColor: { red: 0.2, green: 0.25, blue: 0.33 } },
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID', color: { red: 0.89, green: 0.91, blue: 0.94 } },
                    bottom: { style: 'SOLID', color: { red: 0.89, green: 0.91, blue: 0.94 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,borders)',
            },
          }
        );
      } else if (spec.type === 'DATA_ROW') {
        formatRequests.push(
          // Col A (Code/No)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 1 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  textFormat: { foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat,borders)',
            },
          },
          // Col B (Description)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat,borders)',
            },
          },
          // Col C (Currency Amount)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT',
                  numberFormat: { type: 'CURRENCY', pattern: '"Rp"#,##0;("Rp"#,##0);"-"' },
                  textFormat: { bold: true, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat,borders)',
            },
          },
          // Col D (Note/Status)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 3, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { fontSize: 9, foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat,borders)',
            },
          }
        );
      } else if (spec.type === 'SUBTOTAL_ROW') {
        formatRequests.push(
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
                  borders: {
                    top: { style: 'SOLID', color: { red: 0.2, green: 0.25, blue: 0.33 } },
                    bottom: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,borders)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT',
                  numberFormat: { type: 'CURRENCY', pattern: '"Rp"#,##0;("Rp"#,##0);"-"' },
                  textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat)',
            },
          }
        );
      } else if (spec.type === 'NET_INCOME_ROW' || spec.type === 'CASH_FINAL_ROW') {
        const bg =
          spec.isPositive !== false
            ? { red: 0.92, green: 0.99, blue: 0.96 }
            : { red: 1, green: 0.95, blue: 0.95 };

        const fg =
          spec.isPositive !== false
            ? { red: 0.02, green: 0.37, blue: 0.27 }
            : { red: 0.62, green: 0.07, blue: 0.22 };

        formatRequests.push(
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: bg,
                  borders: {
                    top: { style: 'SOLID_MEDIUM', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                    bottom: { style: 'DOUBLE', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,borders)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { bold: true, fontSize: 11, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT',
                  numberFormat: { type: 'CURRENCY', pattern: '"Rp"#,##0;("Rp"#,##0);"-"' },
                  textFormat: { bold: true, fontSize: 11, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 3, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { bold: true, fontSize: 10, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
            },
          }
        );
      } else if (spec.type === 'NOTE') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontFamily: 'Arial', fontSize: 9, italic: true, foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      }
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: client.spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    console.log(`Tab "Laporan Bulanan" berhasil disinkronkan (${monthNames[month]} ${year}).`);
    return { success: true, message: `Laporan ${monthNames[month]} ${year} berhasil disinkronkan ke Google Sheets` };
  } catch (error) {
    console.error('Error syncMonthlyFinancialReportToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// TAB 2: NERACA KEUANGAN (STANDAR SAK EMKM)
// ==========================================

export async function syncBalanceSheetToSheet(asOfDateInput?: Date | string) {
  const client = getGoogleAuthClient();
  if (!client) return { success: false, reason: 'Credentials not configured' };

  const sheets = google.sheets({ version: 'v4', auth: client.auth });

  try {
    await ensureSheetHeaders();

    const ssMeta = await sheets.spreadsheets.get({
      spreadsheetId: client.spreadsheetId,
    });
    const sheetObj = ssMeta.data.sheets?.find((s) => s.properties?.title === 'Neraca Keuangan');
    const sheetId = sheetObj?.properties?.sheetId ?? 0;

    const asOfDate = asOfDateInput ? new Date(asOfDateInput) : new Date();
    const balanceSheet = await getBalanceSheet(asOfDate);

    const nowFormatted = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(new Date());

    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
    }).format(asOfDate);

    interface RowSpec {
      values: (string | number)[];
      type:
        | 'MAIN_TITLE'
        | 'SUBTITLE'
        | 'TIMESTAMP'
        | 'EMPTY'
        | 'SECTION_HEADER'
        | 'TABLE_HEADER'
        | 'CATEGORY_HEADER'
        | 'DATA_ROW'
        | 'SUBTOTAL_ROW'
        | 'GRAND_TOTAL_ASSETS'
        | 'GRAND_TOTAL_LIAB'
        | 'BALANCE_CHECK_ROW'
        | 'NOTE';
      isBalanced?: boolean;
    }

    const rowSpecs: RowSpec[] = [
      {
        values: ['LAPORAN POSISI KEUANGAN (NERACA) — BUMDES BOGEM', '', '', ''],
        type: 'MAIN_TITLE',
      },
      {
        values: [`Unit Usaha Catering Desa Bogem • Posisi Per: ${dateFormatted}`, '', '', ''],
        type: 'SUBTITLE',
      },
      {
        values: [`Waktu Sinkronisasi Terakhir: ${nowFormatted}`, '', '', ''],
        type: 'TIMESTAMP',
      },
      { values: ['', '', '', ''], type: 'EMPTY' },

      // I. ASET (AKTIVA)
      {
        values: ['I. ASET (AKTIVA)', '', '', ''],
        type: 'SECTION_HEADER',
      },
      {
        values: ['Kode Akun', 'Pos Akun Keuangan', 'Jumlah (Rp)', 'Kategori SAK EMKM'],
        type: 'TABLE_HEADER',
      },
      {
        values: ['A. ASET LANCAR (CURRENT ASSETS)', '', '', ''],
        type: 'CATEGORY_HEADER',
      },
    ];

    // Data Aset Lancar
    for (const item of balanceSheet.assets.currentAssets.items) {
      rowSpecs.push({
        values: [item.code, item.name, item.amount, 'Aset Lancar'],
        type: 'DATA_ROW',
      });
    }
    rowSpecs.push({
      values: ['', 'TOTAL ASET LANCAR (A)', balanceSheet.assets.currentAssets.total, ''],
      type: 'SUBTOTAL_ROW',
    });
    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });

    // Data Aset Tetap
    rowSpecs.push({
      values: ['B. ASET TETAP & INVENTARIS (NON-CURRENT ASSETS)', '', '', ''],
      type: 'CATEGORY_HEADER',
    });
    if (balanceSheet.assets.fixedAssets.items.length === 0) {
      rowSpecs.push({
        values: ['-', 'Tidak ada aset tetap tercatat', 0, '-'],
        type: 'DATA_ROW',
      });
    } else {
      for (const item of balanceSheet.assets.fixedAssets.items) {
        rowSpecs.push({
          values: [item.code, item.name, item.amount, item.amount < 0 ? 'Penyusutan' : 'Aset Tetap'],
          type: 'DATA_ROW',
        });
      }
    }
    rowSpecs.push({
      values: ['', 'TOTAL ASET TETAP (B)', balanceSheet.assets.fixedAssets.total, ''],
      type: 'SUBTOTAL_ROW',
    });

    // Grand Total Aset
    rowSpecs.push({
      values: ['', 'TOTAL ASET / AKTIVA (A + B)', balanceSheet.assets.totalAssets, 'Total Seluruh Kekayaan Usaha'],
      type: 'GRAND_TOTAL_ASSETS',
    });
    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });

    // II. KEWAJIBAN & EKUITAS (PASIVA)
    rowSpecs.push({
      values: ['II. KEWAJIBAN & EKUITAS (PASIVA)', '', '', ''],
      type: 'SECTION_HEADER',
    });
    rowSpecs.push({
      values: ['Kode Akun', 'Pos Akun Keuangan', 'Jumlah (Rp)', 'Kategori SAK EMKM'],
      type: 'TABLE_HEADER',
    });
    rowSpecs.push({
      values: ['A. KEWAJIBAN / UTANG (LIABILITIES)', '', '', ''],
      type: 'CATEGORY_HEADER',
    });

    // Data Kewajiban
    const allLiabItems = [
      ...balanceSheet.liabilities.currentLiabilities.items,
      ...balanceSheet.liabilities.longTermLiabilities.items,
    ];

    if (allLiabItems.length === 0) {
      rowSpecs.push({
        values: ['-', 'Tidak ada kewajiban / utang pada posisi ini', 0, '-'],
        type: 'DATA_ROW',
      });
    } else {
      for (const item of allLiabItems) {
        rowSpecs.push({
          values: [item.code, item.name, item.amount, 'Kewajiban Usaha'],
          type: 'DATA_ROW',
        });
      }
    }
    rowSpecs.push({
      values: ['', 'TOTAL KEWAJIBAN / UTANG (A)', balanceSheet.liabilities.totalLiabilities, ''],
      type: 'SUBTOTAL_ROW',
    });
    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });

    // Data Ekuitas & Modal
    rowSpecs.push({
      values: ['B. EKUITAS & MODAL (EQUITY)', '', '', ''],
      type: 'CATEGORY_HEADER',
    });
    for (const item of balanceSheet.equity.capital.items) {
      rowSpecs.push({
        values: [item.code, item.name, item.amount, 'Modal Disetor'],
        type: 'DATA_ROW',
      });
    }
    rowSpecs.push({
      values: [
        '3301',
        'Laba / Rugi Bersih Periode Berjalan',
        balanceSheet.equity.currentPeriodProfit,
        balanceSheet.equity.currentPeriodProfit >= 0 ? 'Surplus Berjalan' : 'Defisit Berjalan',
      ],
      type: 'DATA_ROW',
    });
    rowSpecs.push({
      values: ['', 'TOTAL EKUITAS / MODAL (B)', balanceSheet.equity.totalEquity, ''],
      type: 'SUBTOTAL_ROW',
    });

    // Grand Total Pasiva
    rowSpecs.push({
      values: [
        '',
        'TOTAL KEWAJIBAN & EKUITAS / PASIVA (A + B)',
        balanceSheet.totalLiabilitiesAndEquity,
        'Total Kewajiban + Modal',
      ],
      type: 'GRAND_TOTAL_LIAB',
    });

    // Keseimbangan Neraca
    rowSpecs.push({
      values: [
        '',
        'KESEIMBANGAN NERACA (AKTIVA − PASIVA)',
        balanceSheet.discrepancy,
        balanceSheet.isBalanced ? 'SEIMBANG (BALANCED)' : 'BELUM SEIMBANG',
      ],
      type: 'BALANCE_CHECK_ROW',
      isBalanced: balanceSheet.isBalanced,
    });

    rowSpecs.push({ values: ['', '', '', ''], type: 'EMPTY' });
    rowSpecs.push({
      values: [
        '* Catatan: Laporan Neraca ini disusun sesuai Standar Akuntansi Keuangan Entitas Mikro, Kecil, dan Menengah (SAK EMKM).',
        '',
        '',
        '',
      ],
      type: 'NOTE',
    });

    // 1. Kosongkan range tab Neraca Keuangan
    await sheets.spreadsheets.values.clear({
      spreadsheetId: client.spreadsheetId,
      range: 'Neraca Keuangan!A1:Z500',
    }).catch(() => {});

    // 2. Tulis raw values
    const rawValues = rowSpecs.map((r) => r.values);
    await sheets.spreadsheets.values.update({
      spreadsheetId: client.spreadsheetId,
      range: 'Neraca Keuangan!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rawValues,
      },
    });

    // 3. BatchUpdate formatting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatRequests: any[] = [
      {
        unmergeCells: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 500,
            startColumnIndex: 0,
            endColumnIndex: 20,
          },
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: rowSpecs.length + 10,
            startColumnIndex: 0,
            endColumnIndex: 4,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 1, green: 1, blue: 1 },
              textFormat: {
                fontFamily: 'Arial',
                fontSize: 10,
                bold: false,
                foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
              },
              horizontalAlignment: 'LEFT',
              verticalAlignment: 'MIDDLE',
              wrapStrategy: 'CLIP',
            },
          },
          fields: 'userEnteredFormat',
        },
      },
      // Lebar Kolom Neraca
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 120 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 380 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 180 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 220 },
          fields: 'pixelSize',
        },
      },
    ];

    rowSpecs.forEach((spec, rowIndex) => {
      if (spec.type === 'MAIN_TITLE') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
                  textFormat: { fontFamily: 'Arial', fontSize: 13, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      } else if (spec.type === 'SUBTITLE') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 },
                  textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true, foregroundColor: { red: 0.89, green: 0.92, blue: 0.95 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      } else if (spec.type === 'TIMESTAMP') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.97, green: 0.98, blue: 0.99 },
                  textFormat: { fontFamily: 'Arial', fontSize: 9, italic: true, foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      } else if (spec.type === 'SECTION_HEADER') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 },
                  textFormat: { fontFamily: 'Arial', fontSize: 11, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                    bottom: { style: 'SOLID', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
            },
          }
        );
      } else if (spec.type === 'TABLE_HEADER') {
        formatRequests.push({
          repeatCell: {
            range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
                textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                verticalAlignment: 'MIDDLE',
                borders: {
                  top: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  bottom: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  left: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  right: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,borders)',
          },
        });
      } else if (spec.type === 'CATEGORY_HEADER') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.97, green: 0.98, blue: 0.99 },
                  textFormat: { fontFamily: 'Arial', fontSize: 10, bold: true, foregroundColor: { red: 0.2, green: 0.25, blue: 0.33 } },
                  verticalAlignment: 'MIDDLE',
                  borders: {
                    top: { style: 'SOLID', color: { red: 0.89, green: 0.91, blue: 0.94 } },
                    bottom: { style: 'SOLID', color: { red: 0.89, green: 0.91, blue: 0.94 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,borders)',
            },
          }
        );
      } else if (spec.type === 'DATA_ROW') {
        formatRequests.push(
          // Col A (Code)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 1 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'CENTER',
                  textFormat: { fontFamily: 'Courier New', foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat,borders)',
            },
          },
          // Col B (Description)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat,borders)',
            },
          },
          // Col C (Currency Amount)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT',
                  numberFormat: { type: 'CURRENCY', pattern: '"Rp"#,##0;("Rp"#,##0);"-"' },
                  textFormat: { bold: true, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat,borders)',
            },
          },
          // Col D (Category tag)
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 3, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { fontSize: 9, foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  borders: { bottom: { style: 'SOLID', color: { red: 0.93, green: 0.95, blue: 0.96 } } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat,borders)',
            },
          }
        );
      } else if (spec.type === 'SUBTOTAL_ROW') {
        formatRequests.push(
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
                  borders: {
                    top: { style: 'SOLID', color: { red: 0.2, green: 0.25, blue: 0.33 } },
                    bottom: { style: 'SOLID', color: { red: 0.8, green: 0.83, blue: 0.88 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,borders)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT',
                  numberFormat: { type: 'CURRENCY', pattern: '"Rp"#,##0;("Rp"#,##0);"-"' },
                  textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 0.06, green: 0.09, blue: 0.16 } },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat)',
            },
          }
        );
      } else if (spec.type === 'GRAND_TOTAL_ASSETS' || spec.type === 'GRAND_TOTAL_LIAB') {
        const bg =
          spec.type === 'GRAND_TOTAL_ASSETS'
            ? { red: 0.92, green: 0.99, blue: 0.96 } // emerald
            : { red: 0.93, green: 0.95, blue: 0.98 }; // slate

        const fg =
          spec.type === 'GRAND_TOTAL_ASSETS'
            ? { red: 0.02, green: 0.37, blue: 0.27 }
            : { red: 0.06, green: 0.09, blue: 0.16 };

        formatRequests.push(
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: bg,
                  borders: {
                    top: { style: 'SOLID_MEDIUM', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                    bottom: { style: 'DOUBLE', color: { red: 0.06, green: 0.09, blue: 0.16 } },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,borders)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { bold: true, fontSize: 11, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT',
                  numberFormat: { type: 'CURRENCY', pattern: '"Rp"#,##0;("Rp"#,##0);"-"' },
                  textFormat: { bold: true, fontSize: 11, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat)',
            },
          }
        );
      } else if (spec.type === 'BALANCE_CHECK_ROW') {
        const bg = spec.isBalanced
          ? { red: 0.85, green: 0.98, blue: 0.91 } // bright emerald
          : { red: 1, green: 0.9, blue: 0.9 }; // bright rose

        const fg = spec.isBalanced
          ? { red: 0.02, green: 0.37, blue: 0.27 }
          : { red: 0.62, green: 0.07, blue: 0.22 };

        formatRequests.push(
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: bg,
                  borders: {
                    top: { style: 'SOLID', color: fg },
                    bottom: { style: 'SOLID', color: fg },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,borders)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 1, endColumnIndex: 2 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { bold: true, fontSize: 11, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 2, endColumnIndex: 3 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'RIGHT',
                  numberFormat: { type: 'CURRENCY', pattern: '"Rp"#,##0;("Rp"#,##0);"-"' },
                  textFormat: { bold: true, fontSize: 11, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,numberFormat,textFormat)',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 3, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  horizontalAlignment: 'LEFT',
                  textFormat: { bold: true, fontSize: 10, foregroundColor: fg },
                },
              },
              fields: 'userEnteredFormat(horizontalAlignment,textFormat)',
            },
          }
        );
      } else if (spec.type === 'NOTE') {
        formatRequests.push(
          {
            mergeCells: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              mergeType: 'MERGE_ALL',
            },
          },
          {
            repeatCell: {
              range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 4 },
              cell: {
                userEnteredFormat: {
                  textFormat: { fontFamily: 'Arial', fontSize: 9, italic: true, foregroundColor: { red: 0.39, green: 0.45, blue: 0.55 } },
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)',
            },
          }
        );
      }
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: client.spreadsheetId,
      requestBody: { requests: formatRequests },
    });

    console.log(`Tab "Neraca Keuangan" berhasil disinkronkan (${dateFormatted}).`);
    return { success: true, message: `Neraca Keuangan per ${dateFormatted} berhasil disinkronkan ke Google Sheets` };
  } catch (error) {
    console.error('Error syncBalanceSheetToSheet:', error);
    return { success: false, error };
  }
}

// ==========================================
// RETRY SYNC UNTUK DATA PENDING
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

  const sheets = google.sheets({ version: 'v4', auth: client.auth });
  let syncedCount = 0;
  let failedCount = 0;

  try {
    await ensureSheetHeaders();

    // 1. Ambil transaksi belum tersinkron
    const pendingTransactions = await prisma.transaction.findMany({
      where: { syncedToSheet: false },
      include: { createdBy: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });

    if (pendingTransactions.length > 0) {
      const rows = pendingTransactions.map((trx) => [
        formatDateIndo(trx.date),
        trx.type === 'PEMASUKAN' ? 'Uang Masuk' : 'Uang Keluar',
        trx.category,
        trx.description,
        Number(trx.amount),
        trx.createdBy?.name || 'Petugas',
        trx.id,
      ]);

      const res = await sheets.spreadsheets.values.append({
        spreadsheetId: client.spreadsheetId,
        range: 'Pembukuan!A:G',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows,
        },
      });

      if (res.status === 200) {
        await prisma.transaction.updateMany({
          where: { id: { in: pendingTransactions.map((t) => t.id) } },
          data: { syncedToSheet: true },
        });
        syncedCount += pendingTransactions.length;
      } else {
        failedCount += pendingTransactions.length;
      }
    }

    // 2. Perbarui Tab Laporan Bulanan & Tab Neraca Keuangan secara paralel
    await Promise.all([
      syncMonthlyFinancialReportToSheet().catch(() => {}),
      syncBalanceSheetToSheet().catch(() => {}),
    ]);

    return {
      success: failedCount === 0,
      message: `Berhasil menyinkronkan ${syncedCount} transaksi serta memperbarui Laporan Bulanan & Neraca ke Google Sheets.${
        failedCount > 0 ? ` (${failedCount} gagal)` : ''
      }`,
      syncedCount,
      failedCount,
    };
  } catch (error) {
    console.error('Error in retryPendingSync:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan saat memproses sinkronisasi ke Google Sheets',
      syncedCount,
      failedCount,
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
