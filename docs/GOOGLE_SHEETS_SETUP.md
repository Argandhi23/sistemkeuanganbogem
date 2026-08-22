# 📑 Panduan Konfigurasi Integrasi Google Sheets API v4

Dokumen ini menjelaskan langkah-demi-langkah cara mengonfigurasi **Google Cloud Service Account** dan **Google Sheets API v4** agar aplikasi dapat melakukan pencatatan transaksi dan pelaporan keuangan secara otomatis ke Google Spreadsheet.

---

## 🎯 Mengapa Menggunakan Google Sheets?

Aplikasi Pembukuan BUMDes Catering Desa Bogem menggunakan Google Sheets sebagai sistem *mirroring* & pencadangan data transparan:
1. **Aksesibilitas Aparatur Desa**: Pengurus BUMDes dan aparat desa dapat meninjau laporan keuangan secara *real-time* langsung dari Google Drive/Sheets tanpa harus selalu masuk ke dalam aplikasi web.
2. **Backup Otomatis & Transparan**: Setiap transaksi yang disimpan dalam basis data PostgreSQL akan otomatis tercatat ke tab spreadsheet yang sesuai.
3. **Format Standar Akuntansi**: Sistem otomatis membuat dan memformat tab **Pembukuan**, **Laporan Bulanan** (Laba Rugi & Arus Kas), dan **Neraca Keuangan**.

---

## 🚀 Langkah 1: Buat Proyek di Google Cloud Console

1. Kunjungi [Google Cloud Console](https://console.cloud.google.com/).
2. Masuk menggunakan akun Google Anda.
3. Klik menu *dropdown* proyek di bagian atas, lalu pilih **New Project** (*Proyek Baru*).
4. Beri nama proyek, misalnya: `BUMDes-Bogem-Pembukuan`.
5. Klik **Create**.

---

## 🔑 Langkah 2: Aktifkan Google Sheets API

1. Pastikan Anda berada di proyek yang baru saja dibuat.
2. Di kolom pencarian atas, ketik **Google Sheets API** dan pilih layanan tersebut.
3. Klik tombol **Enable** (*Aktifkan*).
4. *(Opsional)* Aktifkan juga **Google Drive API** jika ingin mendukung manipulasi folder/file di kemudian hari.

---

## 👤 Langkah 3: Buat Service Account

1. Buka menu navigasi kiri: **IAM & Admin** > **Service Accounts** (*Akun Layanan*).
2. Klik tombol **+ Create Service Account** di bagian atas.
3. Isi informasi Service Account:
   - **Service account name**: `sheets-sync-bumdes`
   - **Service account ID**: akan terisi otomatis (misal `sheets-sync-bumdes@bumdes-bogem-pembukuan.iam.gserviceaccount.com`)
   - **Description**: `Akun sinkronisasi data pembukuan katering BUMDes ke Google Sheets`
4. Klik **Create and Continue**.
5. Pada tahap pemilihan peran (*Role*), Anda dapat memilih peran **Editor** atau lewati (*opsional*) karena hak akses akan diatur langsung di Google Spreadsheet.
6. Klik **Done**.

---

## 📥 Langkah 4: Buat dan Unduh Private Key (JSON)

1. Pada daftar Service Accounts, klik email Service Account yang baru saja dibuat.
2. Pilih tab **Keys** (*Kunci*) di bagian atas.
3. Klik **Add Key** > **Create new key**.
4. Pilih format **JSON**, lalu klik **Create**.
5. File `.json` akan otomatis terunduh ke komputer Anda. Simpan file ini dengan aman!

Buka file JSON tersebut menggunakan text editor (VS Code/Notepad). Di dalamnya terdapat field penting:
```json
{
  "client_email": "sheets-sync-bumdes@bumdes-bogem-pembukuan.iam.gserviceaccount.com",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
}
```

---

## 📄 Langkah 5: Buat Google Spreadsheet & Beri Hak Akses

1. Buka [Google Sheets](https://sheets.google.com/) dan buat Spreadsheet baru (*Blank spreadsheet*).
2. Beri judul spreadsheet, misalnya: **Pembukuan Catering BUMDes Desa Bogem 2026**.
3. Salin **Spreadsheet ID** dari URL browser Anda:
   ```text
   https://docs.google.com/spreadsheets/d/1A2B3C4D5E6F7G8H9I0J_kLMnOpQrStUvWxYz/edit#gid=0
                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                                   (Ini SPREADSHEET_ID)
   ```
4. Klik tombol **Share** (*Bagikan*) di pojok kanan atas spreadsheet.
5. Tempelkan email Service Account (`client_email` dari langkah 4) ke dalam kolom penerima.
6. Berikan peran **Editor**, hilangkan centang *Notify people*, lalu klik **Share**.

> [!IMPORTANT]
> Spreadsheet **wajib** dibagikan ke email Service Account dengan hak akses **Editor**, jika tidak, sistem akan menghasilkan error `403 Forbidden` (Permission Denied).

---

## ⚙️ Langkah 6: Masukkan Konfigurasi ke File `.env`

Buka file `.env` di proyek lokal Anda dan sesuaikan 3 variabel berikut:

```env
# Email Service Account dari Google Cloud Console
GOOGLE_SERVICE_ACCOUNT_EMAIL="sheets-sync-bumdes@bumdes-bogem-pembukuan.iam.gserviceaccount.com"

# Private Key dari file JSON (pastikan diapit tanda kutip ganda "")
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# ID Spreadsheet yang diambil dari URL
SPREADSHEET_ID="1A2B3C4D5E6F7G8H9I0J_kLMnOpQrStUvWxYz"
```

> [!TIP]
> Jika Anda menyalin nilai `private_key` dari file JSON, karakter `\n` sudah berformat escaped. Pertahankan tanda kutip ganda `""` di file `.env` agar string di-parse dengan benar oleh Node.js.

---

## 📊 Struktur Tab yang Otomatis Dibuat Sistem

Saat transaksi pertama kali disimpan atau saat tombol **Sync Laporan** ditekan, sistem aplikasi secara otomatis akan membuat tab dan header berikut jika belum tersedia:

### 1. Tab `Pembukuan`
Mencatat riwayat mutasi kas harian:
- Kolom: `No`, `Tanggal`, `Jenis`, `Kategori`, `Keterangan`, `Pemasukan (Rp)`, `Pengeluaran (Rp)`, `Saldo (Rp)`, `Petugas`.

### 2. Tab `Laporan Bulanan`
Menyusun laporan komparasi kinerja usaha bulanan:
- **Laporan Laba Rugi**: Rekap Pendapatan, Beban Operasional, Laba Operasional, Beban Non-Operasional, dan Laba Bersih.
- **Laporan Arus Kas**: Saldo Awal Kas, Arus Kas Masuk, Arus Kas Keluar, dan Saldo Akhir Kas.

### 3. Tab `Neraca Keuangan`
Menyusun posisi keuangan per tanggal tertentu:
- **Aset / Aktiva**: Aset Lancar (Kas & Bank) + Aset Tetap (Peralatan).
- **Kewajiban & Ekuitas / Pasiva**: Utang Usaha + Modal Usaha + Laba Berjalan.
- **Indikator Balance**: Mengecek apakah `Total Aset == Total Kewajiban + Ekuitas`.

---

## 🛠 Panduan Troubleshooting Umum

| Gejala Masalah | Penyebab Utama | Solusi |
| :--- | :--- | :--- |
| `Error 403: The caller does not have permission` | Spreadsheet belum di-share ke email Service Account | Buka Google Sheets > Klik **Share** > Tambahkan email Service Account dengan akses **Editor**. |
| `Error 404: Requested entity was not found` | `SPREADSHEET_ID` salah atau spreadsheet telah dihapus | Periksa kembali ID spreadsheet di URL browser dan cocokkan dengan nilai `SPREADSHEET_ID` di `.env`. |
| `Error: PEM routines:get_name:no start line` | Format `GOOGLE_PRIVATE_KEY` rusak atau tanda kutip hilang | Pastikan private key diawali `-----BEGIN PRIVATE KEY-----` dan diakhiri `-----END PRIVATE KEY-----` serta diapit tanda kutip ganda di `.env`. |
| Sinkronisasi lambat saat input transaksi | Koneksi internet lokal ke Google API terhambat | Sistem menggunakan eksekusi asinkronus (background) sehingga proses input di aplikasi web tetap cepat tanpa memblokir antarmuka pengguna. |
