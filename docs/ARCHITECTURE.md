# 🏗 Dokumentasi Arsitektur Sistem & Logika Akuntansi

Dokumen ini menjelaskan rancangan arsitektur teknis, model basis data, alur autentikasi/otorisasi, serta logika kalkulasi akuntansi ganda yang diterapkan pada **Sistem Pembukuan & Manajemen Keuangan BUMDes Catering Desa Bogem**.

---

## 🏛 1. Diagram Arsitektur Tingkat Tinggi (High-Level Architecture)

```mermaid
graph TD
    Client["Client / Web Browser<br/>(Mobile & Desktop Responsive)"]
    
    subgraph NextApp["Next.js 14 Application (App Router)"]
        Middleware["Next.js Middleware<br/>(Auth & RBAC Route Protection)"]
        
        subgraph FrontendLayer["Presentation Layer (UI)"]
            Dashboard["Dashboard & Charts (Recharts)"]
            TransaksiUI["Input & Riwayat Transaksi"]
            PesananUI["Manajemen Pesanan Catering"]
            LaporanUI["Laporan Keuangan & Filter"]
            AdminUI["Manajemen Akun COA & Pengguna"]
        end
        
        subgraph BackendLayer["Server & Business Logic Layer"]
            NextAuth["NextAuth.js Session Handler"]
            AccountingEngine["Accounting Engine (src/lib/accounting.ts)<br/>Laba Rugi, Neraca, Arus Kas, Buku Besar"]
            ActivityLogger["Audit Trail Logger (src/lib/activityLog.ts)"]
            SheetsSync["Google Sheets Sync Service (src/lib/googleSheets.ts)"]
            APIRoutes["Next.js API Route Handlers (/api/*)"]
        end
    end
    
    subgraph DataStorage["Persistence & External Services"]
        PrismaClient["Prisma ORM Client"]
        PostgresDB[("PostgreSQL Database<br/>(Neon / Supabase / Local)")]
        GoogleSheetsAPI["Google Sheets API v4<br/>(Service Account Auth)"]
        GoogleDrive["Google Spreadsheet Online"]
    end
    
    Client -->|HTTP / HTTPS| Middleware
    Middleware --> FrontendLayer
    FrontendLayer -->|Server Actions / API Calls| BackendLayer
    APIRoutes --> BackendLayer
    BackendLayer --> PrismaClient
    PrismaClient --> PostgresDB
    SheetsSync -->|JWT Auth via Googleapis| GoogleSheetsAPI
    GoogleSheetsAPI --> GoogleDrive
```

---

## 🗄 2. Skema Basis Data & Entity Relationship Diagram (ERD)

Aplikasi menggunakan **PostgreSQL** yang dimodelkan dan dimigrasikan menggunakan **Prisma ORM**.

```mermaid
erDiagram
    USER ||--o{ TRANSACTION : "mencatat (createdBy)"
    USER ||--o{ CATERING_ORDER : "membuat (createdBy)"
    USER ||--o{ ACTIVITY_LOG : "melakukan (user)"
    ACCOUNT ||--o{ TRANSACTION : "diklasifikasikan ke"

    USER {
        string id PK "cuid()"
        string name "Nama Pengguna"
        string email UK "Email unik"
        string password "Hashed Bcrypt"
        enum role "ADMIN | USER"
        boolean isActive "Status aktif"
        datetime createdAt
        datetime updatedAt
    }

    ACCOUNT {
        string id PK "cuid()"
        string code UK "Kode akun (e.g. 4001, 5001)"
        string name "Nama Akun Standar"
        enum category "PENDAPATAN | BEBAN_OPERASIONAL | BEBAN_NON_OPERASIONAL | ASET | KEWAJIBAN | MODAL"
        boolean isActive "Status aktif"
        datetime createdAt
        datetime updatedAt
    }

    TRANSACTION {
        string id PK "cuid()"
        enum type "PEMASUKAN | PENGELUARAN"
        string category "Kategori ramah awam"
        string accountId FK "Relasi ke Account (Opsional)"
        string description "Keterangan transaksi"
        decimal amount "Nominal (Decimal 14,2)"
        datetime date "Tanggal transaksi"
        string createdById FK "Relasi ke User"
        boolean syncedToSheet "Status sinkronisasi spreadsheet"
        int sheetRowId "Nomor baris di Google Sheets"
        datetime createdAt
        datetime updatedAt
    }

    CATERING_ORDER {
        string id PK "cuid()"
        string customerName "Nama pemesan"
        string customerPhone "Nomor WhatsApp/Telepon"
        datetime eventDate "Tanggal acara catering"
        string menuDetail "Rincian menu makanan"
        int portion "Jumlah porsi"
        decimal totalPrice "Total harga (Decimal 14,2)"
        enum status "PENDING | DIPROSES | SELESAI | DIBATALKAN"
        string notes "Catatan pengantaran/khusus"
        string createdById FK "Relasi ke User"
        boolean syncedToSheet
        int sheetRowId
        datetime createdAt
        datetime updatedAt
    }

    ACTIVITY_LOG {
        string id PK "cuid()"
        string userId FK "Relasi ke User"
        string action "CREATE | UPDATE | DELETE | SYNC"
        string targetType "TRANSACTION | ORDER | ACCOUNT | USER"
        string targetId "ID objek terkait"
        string detail "Rincian perubahan log"
        datetime createdAt
    }
```

---

## 📊 3. Struktur Bagan Akun (Chart of Accounts / COA)

Sistem mengadopsi standar akuntansi yang disederhanakan agar mudah digunakan oleh pengurus BUMDes, namun tetap menghasilkan laporan akuntansi yang valid:

| Kode Akun | Nama Akun | Kategori Akun | Posisi Normal |
| :--- | :--- | :--- | :--- |
| **`1001`** | Kas Tunai & Rekening BUMDes Bogem | `ASET` (Aset Lancar) | Debit |
| **`3001`** | Modal Awal BUMDes Bogem | `MODAL` (Ekuitas) | Kredit |
| **`4001`** | Penjualan Catering Harian & Nasi Box | `PENDAPATAN` | Kredit |
| **`4002`** | Penjualan Pesanan Event & Prasmanan | `PENDAPATAN` | Kredit |
| **`4003`** | Pendapatan Sewa Peralatan Catering | `PENDAPATAN` | Kredit |
| **`4004`** | Pendapatan Usaha Lain-lain | `PENDAPATAN` | Kredit |
| **`5001`** | Beban Bahan Baku Makanan (Beras, Daging, Sayur) | `BEBAN_OPERASIONAL` | Debit |
| **`5002`** | Beban Kemasan, Box & Plastik | `BEBAN_OPERASIONAL` | Debit |
| **`5003`** | Beban Upah & Gaji Tenaga Masak | `BEBAN_OPERASIONAL` | Debit |
| **`5004`** | Beban Transportasi & Pengantaran | `BEBAN_OPERASIONAL` | Debit |
| **`5005`** | Beban Listrik, Gas Elpiji & Air | `BEBAN_OPERASIONAL` | Debit |
| **`5006`** | Beban Peralatan & Perlengkapan Dapur | `BEBAN_OPERASIONAL` | Debit |
| **`6001`** | Beban Administrasi Bank & Transfer | `BEBAN_NON_OPERASIONAL` | Debit |
| **`6002`** | Beban Non-Operasional Lain-lain | `BEBAN_NON_OPERASIONAL` | Debit |

---

## 🧮 4. Logika Kalkulasi Laporan Keuangan (`src/lib/accounting.ts`)

### A. Laporan Laba Rugi (*Income Statement*)
$$\text{Laba Kotor Operasional} = \sum \text{Pendapatan (4xxx)} - \sum \text{Beban Operasional (5xxx)}$$
$$\text{Laba Bersih Usaha} = \text{Laba Kotor Operasional} - \sum \text{Beban Non-Operasional (6xxx)}$$

### B. Neraca Keuangan (*Balance Sheet*)
1. **Total Aset / Aktiva**:
   $$\text{Total Aset} = \text{Aset Lancar (Kas/Bank)} + \text{Aset Tetap (Peralatan)}$$
   $$\text{Saldo Kas} = \text{Saldo Kas Awal} + \sum \text{Pemasukan Historis} - \sum \text{Pengeluaran Historis}$$
2. **Total Kewajiban & Ekuitas / Pasiva**:
   $$\text{Total Pasiva} = \text{Total Kewajiban (Utang)} + \text{Modal Awal} + \text{Laba Bersih Akumulasi}$$
3. **Keseimbangan (*Balance Check*)**:
   $$\text{Selisih} = |\text{Total Aset} - \text{Total Pasiva}|$$
   $$\text{Status} = \begin{cases} \text{SEIMBANG (BALANCED)}, & \text{jika Selisih} = 0 \\ \text{BELUM SEIMBANG}, & \text{jika Selisih} \neq 0 \end{cases}$$

### C. Laporan Arus Kas (*Cash Flow Statement*)
- **Saldo Awal Kas**: Saldo sebelum periode tanggal filter laporan.
- **Arus Kas Masuk**: Rekap seluruh pemasukan kas berdasarkan kategori selama periode.
- **Arus Kas Keluar**: Rekap seluruh pengeluaran kas berdasarkan kategori selama periode.
- **Saldo Akhir Kas**: $\text{Saldo Awal} + \text{Total Arus Kas Masuk} - \text{Total Arus Kas Keluar}$.

### D. Buku Besar (*General Ledger*)
- Mengagregasi mutasi debit/kredit pada satu akun tertentu dalam rentang tanggal.
- Menghitung **Saldo Berjalan (*Running Balance*)** baris-demi-baris dengan memperhitungkan saldo awal sebelum tanggal mulai.

---

## 🔄 5. Mekanisme Sinkronisasi Google Sheets & Toleransi Kesalahan

```mermaid
sequenceDiagram
    autonumber
    actor User as Petugas / Admin
    participant App as Next.js API Route
    participant DB as PostgreSQL (Prisma)
    participant Sync as GoogleSheets Service
    participant GS as Google Sheets API v4

    User->>App: Submit Transaksi Kas Baru
    App->>DB: Simpan Transaksi (syncedToSheet = false)
    DB-->>App: Transaksi tersimpan (ID generated)
    App->>User: Kirim respon sukses 201 Created

    Note over App,Sync: Eksekusi Background Asinkronus
    App-)Sync: Trigger appendTransactionToGoogleSheet(id)
    Sync->>GS: Append Row ke Tab "Pembukuan"
    alt Sinkronisasi Berhasil
        GS-->>Sync: 200 OK (Updated Range)
        Sync->>DB: Update syncedToSheet = true, sheetRowId
        Sync-)GS: Update Tab "Laporan Bulanan" & "Neraca Keuangan"
    else Koneksi Gagal / Offline
        GS-->>Sync: Error / Timeout
        Sync->>DB: Tetap syncedToSheet = false
        Note over Sync: Transaksi masuk antrean Retry
    end

    opt Manual Sync / Tombol Retry
        User->>App: Klik "Sinkronkan Ulang Transaksi Pending"
        App->>DB: Query transaksi where syncedToSheet = false
        App->>Sync: Proses batch sync
    end
```

---

## 🔐 6. Keamanan & Role-Based Access Control (RBAC)

1. **Hashing Password**: Menggunakan `bcryptjs` dengan *salt rounds* 10.
2. **Session Handling**: Menggunakan JSON Web Tokens (JWT) terenkripsi dengan masa berlaku sesi yang aman.
3. **Route Middleware (`src/middleware.ts`)**:
   - Memastikan pengguna yang belum login dialihkan ke `/login`.
   - Melindungi rute administratif (`/users`, `/accounts`, `/logs`) agar hanya dapat diakses oleh peran `ADMIN`.
   - Petugas dengan peran `USER` hanya dapat mengakses dashboard operasional, transaksi kas, dan pesanan catering.
4. **Audit Trail Logging**:
   - Setiap mutasi data sensitif (tambah, edit, hapus) otomatis dicatat ke tabel `ActivityLog` bersama identitas pengguna dan waktu kejadian.
