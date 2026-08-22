# 📊 Sistem Pembukuan & Manajemen Keuangan BUMDes Catering Desa Bogem

[![Next.js](https://img.shields.io/badge/Next.js-14.2.15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Google Sheets API](https://img.shields.io/badge/Google_Sheets_API-v4-34A853?style=for-the-badge&logo=google-sheets)](https://developers.google.com/sheets/api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

Aplikasi web modern berbasis **Next.js 14 (App Router)** dan **Prisma ORM** yang dirancang khusus untuk mempermudah pencatatan transaksi kas masuk/keluar, pengelolaan pesanan katering, penyusunan laporan keuangan standar akuntansi, serta sinkronisasi otomatis dua arah ke **Google Sheets** untuk unit usaha katering **BUMDes Desa Bogem**.

---

## 📑 Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Struktur Proyek](#-struktur-proyek)
- [Prasyarat Sistem](#-prasyarat-sistem)
- [Panduan Instalasi & Menjalankan Lokal](#-panduan-instalasi--menjalankan-lokal)
- [Konfigurasi Environment Variables](#-konfigurasi-environment-variables)
- [Database Setup & Seeding](#-database-setup--seeding)
- [Akun Login Bawaan](#-akun-login-bawaan)
- [Integrasi Google Sheets](#-integrasi-google-sheets)
- [Daftar Perintah (NPM Scripts)](#-daftar-perintah-npm-scripts)
- [Panduan Deployment](#-panduan-deployment)
- [Dokumentasi Tambahan](#-dokumentasi-tambahan)
- [Kontribusi](#-kontribusi)
- [Lisensi](#-lisensi)

---

## ✨ Fitur Utama

### 1. 💰 Pencatatan Transaksi Kas Ramah Awam
- Input pemasukan dan pengeluaran kas dengan antarmuka yang intuitif dan mudah dipahami oleh petugas non-akuntan.
- Otomatisasi pemetaan kategori transaksi ke Bagan Akun Standar (*Chart of Accounts*).
- Validasi input nominal mata uang Rupiah secara *real-time*.

### 2. 🍱 Manajemen Pesanan Catering
- Pencatatan pesanan lengkap: nama pemesan, nomor WhatsApp, tanggal acara, rincian menu, jumlah porsi, total harga, dan catatan pengantaran.
- Manajemen siklus status pesanan (*Pending*, *Diproses*, *Selesai*, *Dibatalkan*).
- Integrasi status pemesanan dengan pencatatan pendapatan otomatis.

### 3. 📈 Laporan Keuangan Standar Akuntansi
- **Laporan Laba Rugi (*Income Statement*)**: Perhitungan total pendapatan usaha, beban operasional, laba kotor operasional, beban non-operasional, dan laba bersih.
- **Neraca Keuangan (*Balance Sheet*)**: Rincian Aset Lancar, Aset Tetap, Total Kewajiban/Utang, Modal/Ekuitas, serta verifikasi keseimbangan (*Balance Check*).
- **Laporan Arus Kas (*Cash Flow*)**: Saldo kas awal, rincian arus kas masuk & keluar, dan saldo kas akhir.
- **Buku Besar (*General Ledger*)**: Mutasi debit/kredit per akun dengan perhitungan saldo berjalan (*running balance*).
- Filter periode laporan (Bulan, Kuartal, Tahun, atau Kustom) dan fitur cetak/ekspor siap pakai.

### 4. 🔄 Sinkronisasi Real-time Google Sheets API v4
- Pencatatan transaksi dan pesanan otomatis dikirim ke Google Spreadsheet secara terstruktur.
- Pembuatan otomatis tab **Pembukuan**, **Laporan Bulanan**, dan **Neraca Keuangan** dengan format dan formula standar akuntansi.
- Mekanisme sinkronisasi ulang (*Retry Queue*) untuk transaksi yang belum tersinkron akibat kendala jaringan.

### 5. 🔐 Multi-Role Authentication & Security
- Autentikasi aman menggunakan **NextAuth.js** dengan enkripsi *password* menggunakan **Bcrypt**.
- Pembagian hak akses peran (*Role-Based Access Control*):
  - **ADMIN (Ketua BUMDes)**: Akses penuh ke seluruh fitur, laporan keuangan, manajemen pengguna, dan bagan akun.
  - **USER (Petugas Katering)**: Akses input dan edit transaksi harian serta pesanan katering.

### 6. 📝 Audit Trail / Activity Logs & Onboarding
- Riwayat aktivitas sistem (*Activity Logs*) untuk memantau aksi penambahan, perubahan, dan penghapusan data.
- Panduan bantuan interaktif (*Onboarding Modal* & halaman Pusat Bantuan) untuk memudahkan petugas baru.

### 7. 📱 Mobile-First & Responsif
- Tampilan optimal di perangkat smartphone, tablet, maupun layar desktop dengan *bottom navigation bar* khusus mobile.

---

## 🛠 Teknologi yang Digunakan

| Komponen | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Frontend Framework** | [Next.js 14](https://nextjs.org/) | React Framework dengan App Router, Server Components & Server Actions |
| **Bahasa Pemrograman** | [TypeScript](https://www.typescriptlang.org/) | Menjamin keamanan tipe data (*Type-Safety*) |
| **Styling UI** | [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework untuk desain modern dan responsif |
| **Komponen & Ikon** | [Lucide React](https://lucide.dev/) | Kumpulan ikon modern yang ringan |
| **Grafik & Visualisasi** | [Recharts](https://recharts.org/) | Diagram analitik keuangan di halaman dashboard & laporan |
| **Form & Validasi** | [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/) | Validasi form yang cepat, fleksibel, dan aman |
| **Database & ORM** | [Prisma ORM](https://www.prisma.io/) & [PostgreSQL](https://www.postgresql.org/) | ORM modern untuk migrasi, relasi, dan manipulasi data |
| **Autentikasi** | [NextAuth.js v4](https://next-auth.js.org/) | Autentikasi sesi berbasis JWT dan password hashing Bcrypt |
| **Integrasi Eksternal** | [Google APIs (googleapis)](https://www.npmjs.com/package/googleapis) | Komunikasi dengan Google Sheets API v4 via Service Account |

---

## 📂 Struktur Proyek

```text
pembukuandesabogem/
├── .github/                     # Template Issue & Pull Request GitHub
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/                        # Dokumentasi Teknis Lanjutan
│   ├── ARCHITECTURE.md          # Arsitektur sistem, database ERD & alur akuntansi
│   └── GOOGLE_SHEETS_SETUP.md   # Panduan konfigurasi Google Service Account & Sheets API
├── prisma/                      # Konfigurasi Prisma ORM
│   ├── schema.prisma            # Skema basis data & relasi model
│   └── seed.ts                  # Data awal (akun admin/petugas & Chart of Accounts)
├── public/                      # Aset statis (gambar, logo, favicon)
├── src/
│   ├── app/                     # Next.js App Router (Pages & API Routes)
│   │   ├── (auth)/login/        # Halaman Login
│   │   ├── (dashboard)/         # Halaman Dashboard & Modul Aplikasi
│   │   │   ├── accounts/        # Manajemen Bagan Akun (COA)
│   │   │   ├── bantuan/         # Pusat Bantuan & Panduan Penggunaan
│   │   │   ├── laporan/         # Laporan Keuangan (Laba Rugi, Neraca, dsb.)
│   │   │   ├── logs/            # Audit Trail / Riwayat Aktivitas
│   │   │   ├── pesanan/         # Modul Pesanan Catering
│   │   │   ├── transaksi/       # Modul Transaksi Kas
│   │   │   └── users/           # Manajemen Pengguna (Admin Only)
│   │   ├── api/                 # Endpoint REST API Backend
│   │   ├── globals.css          # Konfigurasi CSS Tailwind
│   │   └── layout.tsx           # Root Layout Aplikasi
│   ├── components/              # Komponen UI Reusable
│   │   ├── layout/              # Navbar, Sidebar, BottomNav
│   │   ├── onboarding/          # Panduan interaktif awal
│   │   └── ui/                  # Tombol, Modal Konfirmasi, Input Rupiah, dsb.
│   ├── lib/                     # Utilitas & Business Logic
│   │   ├── accounting.ts        # Kalkulasi Standar Akuntansi (Laba Rugi, Neraca, Arus Kas)
│   │   ├── activityLog.ts       # Utilitas logging audit trail
│   │   ├── auth.ts              # Konfigurasi NextAuth.js
│   │   ├── googleSheets.ts      # Integrasi & Formatting Google Sheets API v4
│   │   ├── prisma.ts            # Prisma Client Singleton Instance
│   │   └── validators/          # Skema validasi Zod
│   ├── middleware.ts            # Route protection & middleware otentikasi
│   └── types/                   # Definisi TypeScript kustom
├── .env.example                 # Template variabel lingkungan
├── .gitignore                   # Konfigurasi file yang diabaikan git
├── package.json                 # Konfigurasi dependensi dan skrip proyek
├── tailwind.config.ts           # Konfigurasi tema Tailwind CSS
└── tsconfig.json                # Konfigurasi TypeScript
```

---

## ⚙️ Prasyarat Sistem

Sebelum menjalankan proyek ini, pastikan perangkat Anda telah terpasang:
- **Node.js**: Versi `18.17.0` atau yang lebih baru (disarankan Node LTS 20+)
- **NPM** (bawaan Node.js), **Yarn**, atau **PNPM**
- **PostgreSQL**: Server PostgreSQL aktif (lokal atau cloud seperti [Neon](https://neon.tech), [Supabase](https://supabase.com))
- **Google Cloud Platform Account**: Untuk menggunakan fitur sinkronisasi Google Sheets (*opsional saat development awal*)

---

## 🚀 Panduan Instalasi & Menjalankan Lokal

Ikuti langkah-langkah berikut untuk menjalankan aplikasi di lingkungan pengembangan lokal:

### 1. Clone Repositori
```bash
git clone https://github.com/[username]/pembukuandesabogem.git
cd pembukuandesabogem
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Salin dan Sesuaikan Environment Variables
```bash
cp .env.example .env
```
Buka file `.env` dan sesuaikan koneksi database PostgreSQL Anda (lihat bagian [Konfigurasi Environment Variables](#-konfigurasi-environment-variables)).

### 4. Sinkronisasi Skema Basis Data & Seed Data Awal
Jalankan perintah Prisma untuk membuat tabel dan mengisi data awal (*Admin*, *Petugas*, dan *Chart of Accounts*):
```bash
npm run db:push
npm run db:seed
```

### 5. Jalankan Development Server
```bash
npm run dev
```

Buka peramban (*browser*) Anda dan akses:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Konfigurasi Environment Variables

File `.env` memerlukan variabel-variabel berikut:

```env
# ------------------------------------------------------------------------------
# 1. DATABASE (PostgreSQL)
# ------------------------------------------------------------------------------
DATABASE_URL="postgresql://postgres:password@localhost:5432/bumdes_bogem?schema=public"

# Opsional: Jika menggunakan connection pooling (Supabase / Neon)
# DIRECT_URL="postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres"

# ------------------------------------------------------------------------------
# 2. NEXTAUTH (Autentikasi Sesi)
# ------------------------------------------------------------------------------
NEXTAUTH_SECRET="bumdes-bogem-catering-secret-key-super-secure-2026"
NEXTAUTH_URL="http://localhost:3000"

# ------------------------------------------------------------------------------
# 3. GOOGLE SHEETS API (Service Account)
# ------------------------------------------------------------------------------
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@gcp-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
SPREADSHEET_ID="1A2B3C4D5E6F7G8H9I0J_kLMnOpQrStUvWxYz"
```

> [!TIP]
> Detail pembuatan Google Service Account dan cara mendapatkan Private Key dapat dibaca di **[docs/GOOGLE_SHEETS_SETUP.md](docs/GOOGLE_SHEETS_SETUP.md)**.

---

## 👥 Akun Login Bawaan

Setelah menjalankan `npm run db:seed`, Anda dapat langsung masuk dengan kredensial berikut:

| Peran (*Role*) | Email | Kata Sandi (*Default*) | Hak Akses |
| :--- | :--- | :--- | :--- |
| **Admin (Ketua BUMDes)** | `admin@bogem.desa.id` | `admin123` | Akses penuh (Dashboard, Transaksi, Pesanan, Laporan Lengkap, Akun COA, Manajemen User, Log) |
| **User (Petugas Katering)** | `petugas@bogem.desa.id` | `petugas123` | Akses operasional (Dashboard, Transaksi Kas, Pesanan Katering, Bantuan) |

> [!WARNING]
> Sangat disarankan untuk segera mengubah kata sandi default setelah aplikasi diterapkan di lingkungan produksi.

---

## 📊 Integrasi Google Sheets

Sistem ini terintegrasi secara *native* dengan Google Sheets API v4:
1. Setiap transaksi kas yang disimpan akan langsung di-append ke tab **`Pembukuan`**.
2. Setiap perubahan status laporan akan menyusun format resmi di tab **`Laporan Bulanan`** (Laba Rugi & Arus Kas).
3. Tab **`Neraca Keuangan`** akan merekap total aset, kewajiban, dan ekuitas modal secara terstruktur.
4. Tersedia tombol **Sync Ulang** di halaman laporan jika koneksi internet sempat terputus saat transaksi dibuat.

Panduan lengkap mengenai setup kredensial Google Cloud, izin akses spreadsheet, dan pemetaan tab tersedia di:
📖 **[Panduan Integrasi Google Sheets API (docs/GOOGLE_SHEETS_SETUP.md)](docs/GOOGLE_SHEETS_SETUP.md)**

---

## 📜 Daftar Perintah (NPM Scripts)

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan aplikasi dalam mode pengembangan (*hot-reload*) di port `3000` |
| `npm run build` | Melakukan kompilasi dan optimasi produksi Next.js |
| `npm run start` | Menjalankan server aplikasi Next.js dalam mode produksi |
| `npm run lint` | Menjalankan linter ESLint untuk memeriksa kualitas kode |
| `npm run db:push` | Menerapkan skema `schema.prisma` langsung ke database tanpa file migrasi lokal |
| `npm run db:seed` | Mengisi data awal (pengguna default, bagan akun COA, dan sampel transaksi) |
| `npm run db:studio` | Membuka antarmuka grafis web Prisma Studio untuk melihat/mengedit data database |

---

## 🌐 Panduan Deployment

Aplikasi ini siap di-deploy secara mudah ke platform cloud modern:

### Opsi 1: Vercel + Neon / Supabase PostgreSQL (Direkomendasikan)
1. Buat basis data PostgreSQL gratis di [Neon.tech](https://neon.tech) atau [Supabase](https://supabase.com).
2. Hubungkan repositori GitHub ini ke akun [Vercel](https://vercel.com).
3. Di dashboard pengaturan Vercel, tambahkan seluruh variabel lingkungan yang ada pada `.env.example`:
   - `DATABASE_URL` (Connection string PostgreSQL)
   - `DIRECT_URL` (Direct connection string jika menggunakan Supabase/Neon pooler)
   - `NEXTAUTH_SECRET` (String rahasia acak)
   - `NEXTAUTH_URL` (Domain publik Vercel, misal `https://bumdes-bogem.vercel.app`)
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `SPREADSHEET_ID`
4. Di *Build Settings*, pastikan build command menjalankan Prisma client generation:
   ```bash
   prisma generate && next build
   ```
5. Deploy! Vercel akan otomatis melakukan build dan aplikasi siap digunakan.

---

## 📚 Dokumentasi Tambahan

Untuk pemahaman teknis yang lebih mendalam, silakan baca dokumentasi pendukung berikut:
- 🏗 **[Arsitektur & Logika Akuntansi (docs/ARCHITECTURE.md)](docs/ARCHITECTURE.md)**: Rincian arsitektur teknis, Entity Relationship Diagram (ERD), perhitungan akuntansi ganda, dan alur otentikasi.
- 📑 **[Setup Google Sheets API (docs/GOOGLE_SHEETS_SETUP.md)](docs/GOOGLE_SHEETS_SETUP.md)**: Panduan membuat Service Account di Google Cloud Console dan konfigurasi Spreadsheet ID.
- 🤝 **[Panduan Kontribusi (CONTRIBUTING.md)](CONTRIBUTING.md)**: Aturan kontribusi kode, standar branching git, dan format commit.

---

## 🤝 Kontribusi

Kontribusi untuk perbaikan bug, peningkatan performa, atau penambahan fitur sangat diterima! Silakan baca panduan lengkap di [CONTRIBUTING.md](CONTRIBUTING.md) sebelum membuat *Pull Request*.

1. *Fork* repositori ini
2. Buat *branch* fitur baru (`git checkout -b feature/fitur-keren`)
3. *Commit* perubahan Anda (`git commit -m 'feat: menambahkan fitur keren'`)
4. *Push* ke *branch* tersebut (`git push origin feature/fitur-keren`)
5. Buat **Pull Request** baru di GitHub

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah lisensi **MIT** - lihat file [LICENSE](LICENSE) untuk informasi lebih lanjut.

---

<div align="center">
  <sub>Dikembangkan dengan ❤️ untuk kemajuan tata kelola unit usaha BUMDes Desa Bogem.</sub>
</div>
