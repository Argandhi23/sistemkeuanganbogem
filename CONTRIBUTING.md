# 🤝 Panduan Kontribusi (Contributing Guidelines)

Terima kasih atas minat Anda untuk berkontribusi pada **Sistem Pembukuan & Manajemen Keuangan BUMDes Catering Desa Bogem**!

Dokumen ini berisi panduan untuk membantu Anda memulai kontribusi dengan lancar dan menjaga standar kualitas kode di seluruh repositori.

---

## 📋 Daftar Isi
1. [Alur Pengembangan (Workflow)](#1-alur-pengembangan-workflow)
2. [Konvensi Penamaan Branch](#2-konvensi-penamaan-branch)
3. [Standar Pesan Commit (Conventional Commits)](#3-standar-pesan-commit-conventional-commits)
4. [Standar Penulisan Kode](#4-standar-penulisan-kode)
5. [Prosedur Pengajuan Pull Request (PR)](#5-prosedur-pengajuan-pull-request-pr)
6. [Pelaporan Bug & Permintaan Fitur](#6-pelaporan-bug--permintaan-fitur)

---

## 1. Alur Pengembangan (Workflow)

1. **Fork** repositori ini ke akun GitHub Anda.
2. **Clone** hasil *fork* ke komputer lokal Anda:
   ```bash
   git clone https://github.com/[username]/pembukuandesabogem.git
   cd pembukuandesabogem
   ```
3. Tambahkan repositori utama sebagai *remote upstream*:
   ```bash
   git remote add upstream https://github.com/[original-owner]/pembukuandesabogem.git
   ```
4. Buat branch baru dari `master` / `main` untuk pekerjaan Anda:
   ```bash
   git checkout -b feature/nama-fitur-baru
   ```
5. Lakukan perubahan kode, pastikan pengujian lokal berjalan tanpa error.
6. Commit perubahan dengan format yang benar.
7. Push ke remote fork Anda dan buat **Pull Request**.

---

## 2. Konvensi Penamaan Branch

Gunakan format penamaan branch yang deskriptif dan terstruktur:

| Tipe Branch | Format | Contoh |
| :--- | :--- | :--- |
| **Fitur Baru** | `feature/[nama-fitur]` | `feature/export-pdf-laporan` |
| **Perbaikan Bug** | `fix/[nama-bug]` | `fix/google-sheets-sync-retry` |
| **Dokumentasi** | `docs/[topik-dokumentasi]` | `docs/update-architecture-guide` |
| **Refactoring** | `refactor/[modul]` | `refactor/accounting-calculator` |
| **Optimasi UI** | `ui/[nama-komponen]` | `ui/responsive-table-pesanan` |

---

## 3. Standar Pesan Commit (Conventional Commits)

Kami mengikuti spesifikasi [Conventional Commits](https://www.conventionalcommits.org/). Setiap pesan commit harus diawali dengan tipe perubahan:

- `feat:` Menambahkan fitur baru ke aplikasi
- `fix:` Memperbaiki bug atau kesalahan sistem
- `docs:` Perubahan atau penambahan dokumentasi
- `style:` Perubahan gaya tampilan UI atau formatting tanpa mengubah logika bisnis
- `refactor:` Perubahan struktur kode tanpa menambah fitur atau memperbaiki bug
- `perf:` Peningkatan performa kode atau query database
- `test:` Penambahan atau perbaikan unit test / integration test
- `chore:` Pemeliharaan dependensi, konfigurasi build, atau tooling

**Contoh Pesan Commit yang Baik:**
```bash
git commit -m "feat: tambahkan fitur filter rentang tanggal pada buku besar"
git commit -m "fix: tangani error rate limit saat sinkronisasi Google Sheets"
git commit -m "docs: perbarui panduan setup service account Google Cloud"
```

---

## 4. Standar Penulisan Kode

Untuk menjaga konsistensi codebase, harap perhatikan hal-hal berikut:

1. **TypeScript**:
   - Selalu berikan tipe data yang jelas (*type safety*), hindari penggunaan tipe `any`.
   - Manfaatkan interface atau type yang sudah tersedia di `@prisma/client` atau `src/types/`.

2. **Next.js & React**:
   - Gunakan Server Components secara default, tambahkan `'use client'` hanya pada komponen yang memerlukan interaktivitas, state lokal, atau browser hooks.
   - Pisahkan logika kalkulasi bisnis ke dalam `src/lib/` dan komponen UI ke `src/components/`.

3. **Styling (Tailwind CSS)**:
   - Gunakan kelas utilitas Tailwind secara konsisten.
   - Pastikan desain ramah terhadap layar ponsel (*mobile responsive*).

4. **Linting**:
   - Sebelum melakukan commit atau membuat PR, jalankan perintah berikut untuk memastikan tidak ada lint error:
     ```bash
     npm run lint
     ```

---

## 5. Prosedur Pengajuan Pull Request (PR)

1. Pastikan branch Anda selalu *up-to-date* dengan branch utama:
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```
2. Pastikan `npm run build` dan `npm run lint` berhasil tanpa kesalahan.
3. Buka Pull Request ke branch `master` pada repositori utama.
4. Isi deskripsi PR dengan jelas menggunakan template yang telah disediakan:
   - Jelaskan latar belakang dan tujuan perubahan.
   - Cantumkan tangkapan layar (*screenshot*) jika terdapat perubahan antarmuka UI.
   - Sertakan nomor *Issue* yang relevan jika ada (contoh: `Fixes #12`).
5. Tunggu proses review dan diskusikan masukan dari tim pengembang jika ada.

---

## 6. Pelaporan Bug & Permintaan Fitur

- **Melaporkan Bug**: Buka *Issue* baru menggunakan template **Bug Report**. Sertakan langkah-langkah mereproduksi error, tangkapan layar, dan informasi lingkungan peramban/OS.
- **Mengajukan Fitur**: Buka *Issue* baru menggunakan template **Feature Request**. Jelaskan alasan mengapa fitur tersebut dibutuhkan dan usulan alur kerjanya.

---

Terima kasih atas kontribusi Anda dalam memajukan tata kelola digital BUMDes Desa Bogem! 🎉
