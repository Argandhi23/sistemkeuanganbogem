'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Wallet,
  Building2,
  Scale,
  Printer,
  FileSpreadsheet,
  HelpCircle,
  Play,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Utensils,
  Search,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

interface GuideItem {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  summary: string;
  steps: string[];
  tips?: string;
  actionLink?: {
    label: string;
    href: string;
  };
}

const CATERING_GUIDES: GuideItem[] = [
  {
    id: 'cat-1',
    title: 'Memahami Layar Kas Catering & 4 Kartu Ringkasan',
    category: 'Buku Kas Catering',
    icon: <Utensils className="w-4 h-4 text-amber-600" />,
    summary: 'Penjelasan fungsi kartu Total Uang Masuk, Biaya Dapur, Operasional Kantor, dan Laba Bersih.',
    steps: [
      'Buka halaman "Buku Kas Catering" di menu navigasi samping.',
      'Kartu Hijau (Total Uang Masuk): Akumulasi seluruh pendapatan pesanan nasi box, prasmanan acara, paket snack rapat, dan sewa perlengkapan.',
      'Kartu Merah (Biaya Pokok Dapur): Total pengeluaran bahan masak, beras, daging, bumbu pasar, kemasan dus box snack, elpiji dapur, dan upah kru masak.',
      'Kartu Kuning (Operasional Kantor): Pengeluaran operasional pendukung kantor catering seperti nota struk pesanan, pulsa WhatsApp pemesan, dan bensin kurir.',
      'Kartu Biru (Laba Bersih): Keuntungan riil usaha catering (Uang Masuk - Biaya Dapur - Biaya Kantor). Status "Surplus" menandakan usaha mengalami profit/untung.',
    ],
    tips: 'Periksa kartu Laba Bersih secara berkala setiap selesai pesanan besar agar margin keuntungan per acara terpantau jelas.',
    actionLink: {
      label: 'Buka Buku Kas Catering',
      href: '/units/catering',
    },
  },
  {
    id: 'cat-2',
    title: 'Cara Mencatat Uang Masuk (Pesanan Nasi Box / Prasmanan / DP / Pelunasan)',
    category: 'Pencatatan Kas',
    icon: <Wallet className="w-4 h-4 text-emerald-600" />,
    summary: 'Catat uang pembayaran dari pelanggan, baik uang muka (DP) maupun pelunasan pesanan.',
    steps: [
      'Klik tombol hijau "+ Uang Masuk" di pojok kanan atas Kas Catering atau menu samping "+ Catat Uang Masuk".',
      'Pilih Pos Akun: Gunakan [4001] Pendapatan Catering untuk penjualan makanan/snack, atau [4003] Sewa Peralatan jika ada sewa alat.',
      'Ketik nominal uang rupiah yang diterima pelanggan (misal: 1.500.000).',
      'Pilih metode pembayaran: Tunai (uang fisik) atau Transfer Bank.',
      'Tulis Keterangan Transaksi secara jelas. Contoh: "DP Pesanan 100 Box Nasi Ayam Bakar Acara Pengajian Ibu Siti RT 03".',
      'Klik tombol "Simpan Transaksi". Angka langsung otomatis menambah saldo kas catering dan terhitung di laporan.',
    ],
    tips: 'Tuliskan nama pemesan, nomor kontak, dan tanggal acara di kolom keterangan agar mudah ditelusuri jika pemesan datang kembali.',
    actionLink: {
      label: 'Buka Form Catat Uang Masuk',
      href: '/transaksi/tambah?businessUnit=CATERING&type=PEMASUKAN',
    },
  },
  {
    id: 'cat-3',
    title: 'Cara Mencatat Belanja Bahan Dapur (Biaya Pokok Dapur & Masak)',
    category: 'Pencatatan Kas',
    icon: <Wallet className="w-4 h-4 text-rose-600" />,
    summary: 'Catat belanja bahan makanan, sembako pasar, bumbu, kardus box, gas dapur, dan upah masak harian.',
    steps: [
      'Klik tombol merah "- Uang Keluar" di halaman Kas Catering.',
      'Pada pilihan Pos Akun, pilih kelompok Biaya Pokok Dapur & Masak:',
      '• [5001] Beban Bahan Baku Catering: Untuk beras, daging ayam/sapi, sayur, telur, minyak, dan bumbu dapur.',
      '• [5002] Beban Perlengkapan & Kemasan Box Snack: Untuk beli kardus box, cup puding, mika, sendok plastik.',
      '• [5003] Beban Upah Masak & Tenaga Kerja: Untuk upah harian kru juru masak catering.',
      '• [5004] Beban Gas Elpiji, Listrik & Air: Untuk isi ulang tabung gas elpiji dan kebutuhan air/listrik dapur.',
      'Ketik nominal belanja rupiah sesuai nota pembelian pasar / supplier.',
      'Tulis rincian belanja (contoh: "Belanja Daging Sapi 5kg & Bumbu Rawon di Pasar").',
      'Klik "Simpan Transaksi". Pengeluaran langsung terhitung mengurangi laba dan menambah akumulasi Biaya Pokok Dapur.',
    ],
    tips: 'Selalu kumpulkan struk nota pasar fisik dan simpan di binder arsip catering sesuai urutan tanggal pencatatan.',
    actionLink: {
      label: 'Buka Form Catat Uang Keluar',
      href: '/transaksi/tambah?businessUnit=CATERING&type=PENGELUARAN',
    },
  },
  {
    id: 'cat-4',
    title: 'Cara Mencatat Pengeluaran Operasional Kantor Catering',
    category: 'Pencatatan Kas',
    icon: <Building2 className="w-4 h-4 text-amber-600" />,
    summary: 'Catat pembelian nota kuitansi, kertas struk, pulsa/kuota chat WhatsApp pemesan, dan bensin kurir.',
    steps: [
      'Klik tombol merah "- Uang Keluar" di halaman Kas Catering.',
      'Pada pilihan Pos Akun, pilih kelompok Operasional Kantor Khusus Catering:',
      '• [5051] Beban Operasional Kantor Catering: Untuk pembelian buku nota kuitansi, pulsa/kuota WhatsApp pemesan, sabun cuci piring dapur, dan ATK.',
      '• [5052] Beban Logistik & Transportasi Kantor: Untuk bensin motor kurir pengantaran atau sewa mobil pick-up.',
      'Ketik nominal rupiah yang dibayarkan.',
      'Tulis rincian belanja di kolom Keterangan (contoh: "Beli Buku Kuitansi 5 Buku & Pulsa Kuota WA Admin Catering").',
      'Klik "Simpan Transaksi". Biaya ini otomatis masuk ke kartu Operasional Kantor dan dipisahkan dari biaya dapur.',
    ],
    tips: 'Pemisahan pos kantor dari biaya dapur sangat penting agar harga pokok produksi (HPP) menu makanan tetap akurat.',
    actionLink: {
      label: 'Catat Operasional Kantor',
      href: '/transaksi/tambah?businessUnit=CATERING&type=PENGELUARAN',
    },
  },
  {
    id: 'cat-5',
    title: 'Cara Mencari Transaksi & Memfilter Berdasarkan Bulan / Tahun',
    category: 'Pencarian & Rekap',
    icon: <Search className="w-4 h-4 text-blue-600" />,
    summary: 'Temukan riwayat transaksi pesanan tertentu atau periksa pembukuan bulan kemarin.',
    steps: [
      'Buka halaman Buku Kas Catering.',
      'Gunakan kolom pencarian di atas tabel untuk mengetik nama pemesan (misal: "Ibu Siti") atau jenis belanja (misal: "Beras").',
      'Gunakan dropdown "Semua Bulan" untuk menyaring transaksi pada bulan tertentu (misal: "Juni").',
      'Gunakan dropdown "Semua Tahun" untuk menyaring tahun pembukuan.',
      'Tabel dan 4 kartu metrik di atas otomatis terhitung ulang hanya untuk transaksi periode terpilih.',
      'Klik tombol "Reset" untuk mengembalikan tampilan ke seluruh data.',
    ],
  },
  {
    id: 'cat-6',
    title: 'Cara Mengunduh Rekap Kas ke File Excel (.xlsx)',
    category: 'Export & Laporan',
    icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" />,
    summary: 'Unduh seluruh pembukuan kas catering ke Excel untuk arsip komputer atau diserahkan ke Sekretaris Desa.',
    steps: [
      'Buka halaman Buku Kas Catering.',
      '(Opsional) Pasang filter bulan atau tahun jika hanya ingin mengunduh kas periode tertentu.',
      'Klik tombol "Export Excel" di pojok kanan atas.',
      'File Excel (.xlsx) akan otomatis terunduh dengan susunan kolom rapi: Tanggal, Pos Akun, Keterangan, Metode, Uang Masuk, dan Uang Keluar.',
      'File Excel ini dapat langsung dibuka di Microsoft Excel atau Google Sheets.',
    ],
    tips: 'Lakukan export Excel secara rutin setiap akhir bulan sebagai cadangan (backup) arsip mandiri pengurus catering.',
  },
  {
    id: 'cat-7',
    title: 'Cara Melihat & Mencetak Laporan Laba Rugi Resmi Catering',
    category: 'Laporan Keuangan',
    icon: <Printer className="w-4 h-4 text-indigo-600" />,
    summary: 'Cetak dokumen laporan keuangan catering ber-kop surat resmi Pemerintah Desa Bogem.',
    steps: [
      'Klik menu "Laporan Keuangan Catering" di bilah navigasi samping.',
      'Pilih tab "Laba Rugi" untuk melihat rincian pendapatan dan seluruh beban biaya.',
      'Tentukan periode pelaporan (Bulanan atau Tahunan).',
      'Klik tombol "Cetak PDF". Dokumen resmi akan terbuka lengkap dengan kop surat resmi BUMDes Berkah Lestari Bogem, tanggal, dan tempat tanda tangan pengurus.',
    ],
    actionLink: {
      label: 'Buka Laporan Catering',
      href: '/laporan',
    },
  },
  {
    id: 'cat-8',
    title: 'Butuh Pos Akun Baru atau Koreksi Data? Hubungi Sekretaris Desa',
    category: 'Bantuan & Dukungan',
    icon: <HelpCircle className="w-4 h-4 text-slate-800" />,
    summary: 'Alur koordinasi jika unit Catering memerlukan pos pengeluaran baru atau koreksi data.',
    steps: [
      'Jika catering memiliki jenis pengeluaran atau pendapatan baru yang belum ada di daftar pos akun, hubungi Sekretaris Desa / Super Admin (Bpk Sugeng).',
      'Sekretaris Desa dapat menambahkan kode akun baru kapan saja melalui menu Master Kode Akun.',
      'Setelah ditambahkan oleh Sekretaris Desa, pos akun tersebut akan langsung otomatis muncul di formulir kas pengurus catering tanpa perlu keluar aplikasi.',
      'Jika ada kesalahan input nominal transaksi di masa lalu, klik ikon Pensil (Edit) pada baris transaksi di buku kas untuk memperbaikinya.',
    ],
    tips: 'Semua perubahan data transaksi kas catering akan otomatis memperbarui saldo buku besar BUMDes secara real-time.',
  },
];

const GENERAL_GUIDES: GuideItem[] = [
  {
    id: 'guide-1',
    title: 'Cara Mencatat Kas Masuk (Penerimaan Omzet / Usaha)',
    category: 'Pencatatan Kas',
    icon: <Wallet className="w-4 h-4 text-emerald-600" />,
    summary: 'Catat semua uang masuk dari pesanan catering, sewa molen, iuran WiFi, fee PPOB, atau penjualan sapi.',
    steps: [
      'Klik tombol hijau "+ Catat Kas" di header Beranda atau tombol "+ Kas Masuk" di halaman Buku Kas Unit.',
      'Pilih Jenis Kas: "Kas Masuk (PEMASUKAN)".',
      'Pilih Unit Usaha terkait (contoh: Catering Desa, Sewa Molen, WiFi Balai Desa, PPOB, atau Peternakan Sapi).',
      'Pilih Pos Akun Keuangan (pilihan akun otomatis tersaring sesuai unit yang dipilih, misal: [4001] Pendapatan Catering atau [4010] Pendapatan Sewa Molen).',
      'Ketik nominal uang rupiah yang diterima (otomatis berformat titik ribuan, misal: 350.000).',
      'Pilih metode pembayaran (Tunai atau Transfer Bank).',
      'Tulis Keterangan Transaksi secara jelas dan lengkap (contoh: "DP Pesanan 100 Box Nasi Ayam Acara Pengajian Ibu Siti").',
      'Klik tombol "Simpan Transaksi". Angka langsung otomatis masuk ke Buku Kas Unit, Laba Rugi, dan Neraca.',
    ],
    tips: 'Tuliskan nama pemesan, nomor kontak, atau rincian kegiatan di kolom keterangan agar mudah ditelusuri di kemudian hari.',
    actionLink: {
      label: 'Buka Form Catat Kas Masuk',
      href: '/transaksi/tambah?type=PEMASUKAN',
    },
  },
  {
    id: 'guide-2',
    title: 'Cara Mencatat Kas Keluar (Belanja Bahan & Beban Operasional)',
    category: 'Pencatatan Kas',
    icon: <Wallet className="w-4 h-4 text-rose-600" />,
    summary: 'Catat belanja bahan baku, solar mesin molen, langganan internet ISP, pakan ternak, dan operasional lainnya.',
    steps: [
      'Klik tombol "+ Catat Kas" lalu ubah jenis ke "Kas Keluar (PENGELUARAN)", atau klik "+ Kas Keluar" di halaman unit.',
      'Pilih Unit Usaha yang mengeluarkan biaya.',
      'Pilih Pos Akun Beban yang sesuai (contoh: [5001] Bahan Masak Catering, [5011] Pemeliharaan/Oli Molen, [5021] Langganan Bandwidth ISP, atau [5041] Pakan Sapi).',
      'Ketik nominal rupiah yang dibayarkan.',
      'Pilih metode pembayaran (Kas Tunai atau Rekening Bank).',
      'Tulis rincian belanja di kolom Keterangan (contoh: "Beli Beras 50kg dan Minyak Goreng 10L untuk Dapur Catering").',
      'Klik "Simpan Transaksi". Pengeluaran langsung terhitung mengurangi saldo kas unit terkait.',
    ],
    tips: 'Setiap struk/nota belanja fisik sebaiknya disimpan dan diberi nomor sesuai tanggal pencatatan.',
    actionLink: {
      label: 'Buka Form Catat Kas Keluar',
      href: '/transaksi/tambah?type=PENGELUARAN',
    },
  },
  {
    id: 'guide-3',
    title: 'Super Admin: Cara Menambah & Mengatur Kode Akun Khusus Catering',
    category: 'Master Akun BUMDes',
    icon: <Utensils className="w-4 h-4 text-amber-600" />,
    summary: 'Panduan Sekretaris Desa dalam membuat pos akun baru untuk Catering dan pengelompokan dapur vs kantor.',
    steps: [
      'Buka menu "Master Kode Akun" di bilah navigasi samping.',
      'Pilih tab "Khusus Catering Desa" untuk melihat seluruh pos akun yang dialokasikan khusus untuk unit Catering.',
      'Klik tombol "+ Akun Khusus Catering". Modal formulir yang telah disederhanakan akan terbuka.',
      'Pilih jenis pos akun: (1) Biaya Pokok Dapur (500x), (2) Operasional Kantor (505x), (3) Pendapatan Catering (400x), atau (4) Aset Peralatan (120x).',
      'Nomor kode akun berikutnya akan otomatis terisi secara cerdas (misal: 5053).',
      'Ketik nama pos akun yang jelas (contoh: "Beban Cetak Brosur & Promosi Catering").',
      'Klik "Simpan Kode Akun". Pos akun ini langsung otomatis muncul di form pencatatan kas Pengurus Catering (Ibu Sri).',
    ],
    tips: 'Gunakan awalan 505x untuk pos operasional kantor agar otomatis terhitung ke kartu Operasional Kantor di kas Catering.',
    actionLink: {
      label: 'Buka Master Kode Akun',
      href: '/accounts',
    },
  },
  {
    id: 'guide-4',
    title: 'Cara Membuka & Memantau Buku Kas Khusus Unit Usaha',
    category: 'Buku Kas Unit',
    icon: <Building2 className="w-4 h-4 text-blue-600" />,
    summary: 'Pantau arus kas, laba bersih, dan seluruh mutasi keuangan khusus untuk masing-masing unit usaha.',
    steps: [
      'Buka menu unit yang diinginkan di bilah navigasi samping (Catering Desa, Penyewaan Molen, WiFi Balai Desa, PPOB Loket, atau Ketahanan Pangan).',
      'Di bagian atas, periksa Kartu Ringkasan: Total Uang Masuk, Total Uang Keluar, dan Laba Bersih Unit.',
      'Di tabel bawah, Anda dapat melihat seluruh transaksi kas unit secara kronologis dari yang terbaru.',
      'Gunakan kolom pencarian untuk mencari keterangan transaksi tertentu.',
      'Gunakan filter Bulan dan Tahun untuk melihat rekapitulasi kas periode tertentu.',
      'Klik tombol "Export Excel" untuk mengunduh buku kas unit tersebut ke format spreadsheet (.xlsx).',
    ],
    tips: 'Khusus unit Catering, pengeluaran telah dipisahkan antara Biaya Pokok Dapur dan Beban Operasional Kantor.',
    actionLink: {
      label: 'Buka Buku Kas Catering',
      href: '/units/catering',
    },
  },
  {
    id: 'guide-5',
    title: 'Cara Membaca & Memeriksa Laporan Keuangan (Neraca & Laba Rugi)',
    category: 'Laporan Keuangan',
    icon: <Scale className="w-4 h-4 text-slate-800" />,
    summary: 'Periksa keseimbangan posisi aset dan modal desa pada Neraca, serta keuntungan usaha pada Laba Rugi.',
    steps: [
      'Buka menu "Laporan Keuangan" di bilah navigasi.',
      'Pilih jenis laporan yang ingin diperiksa melalui tab atas: (1) Neraca, (2) Laba Rugi, (3) Arus Kas, (4) Perubahan Modal, atau (5) Buku Besar.',
      'Pilih lingkup Unit Usaha: "Semua Unit (Konsolidasi)" untuk seluruh BUMDes, atau pilih salah satu unit usaha saja.',
      'Tentukan periode pelaporan: Bulanan, 1 Tahun Penuh, atau Semua Periode.',
      'Pada Laporan Neraca, perhatikan status indikator di bagian bawah: harus berwarna hijau bertuliskan "SEIMBANG / BALANCED" dengan selisih Rp 0.',
      'Sisi Aset (Aktiva) merinci saldo Kas Tunai, Bank, Piutang, Persediaan, dan Peralatan.',
      'Sisi Kewajiban & Ekuitas (Pasiva) merinci Utang, Modal Awal Desa, dan Akumulasi Laba Berjalan secara otomatis.',
    ],
    tips: 'Jika memilih tab Buku Besar, Anda dapat memilih akun spesifik (misal: Kas Tunai 1001) untuk melihat jurnal debit dan kredit secara mendalam.',
    actionLink: {
      label: 'Buka Laporan Keuangan',
      href: '/laporan',
    },
  },
  {
    id: 'guide-6',
    title: 'Cara Mengekspor Data ke File Excel (.xlsx) & Cetak PDF Resmi',
    category: 'Export & Cetak',
    icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" />,
    summary: 'Unduh data kas ke file Excel untuk arsip komputer, atau cetak dokumen resmi ber-kop desa.',
    steps: [
      'Untuk Export Excel Kas: Buka menu Buku Kas Transaksi atau halaman Unit Usaha terkait, lalu klik tombol "Export Excel". File spreadsheet (.xlsx) berformat rapi langsung terunduh.',
      'Untuk Export Laporan Keuangan Excel: Di menu Laporan Keuangan, klik tombol "Export Excel (.xlsx)" untuk mengunduh laporan Neraca atau Laba Rugi periode terpilih.',
      'Untuk Cetak Dokumen PDF Resmi: Di menu Laporan Keuangan, klik tombol "Cetak PDF". Dokumen laporan akan tampil dengan format resmi lengkap dengan kop surat Pemerintah Desa Bogem, tanggal pelaporan, dan kolom tanda tangan pengurus BUMDes.',
    ],
    tips: 'Pada dialog cetak peramban (browser), pilih "Save as PDF" jika ingin menyimpan laporan resmi dalam format file PDF.',
  },
  {
    id: 'guide-7',
    title: 'Cara Mencatat Modal Awal BUMDes & Penyetoran Bagi Hasil PADes',
    category: 'Permodalan',
    icon: <Printer className="w-4 h-4 text-slate-800" />,
    summary: 'Pencatatan suntikan dana penyertaan modal dari desa dan bagi hasil keuntungan ke kas desa.',
    steps: [
      'Penyertaan Modal Tambahan Desa: Klik "+ Catat Kas", pilih Kas Masuk, unit usaha "Operasional Kantor / Umum", pos akun "[3001] Modal Usaha / Modal Awal BUMDes" atau "[3003] Penyertaan Modal Desa". Masukkan nominal dan tulis keterangan (misal: "Penyertaan Modal APBDes Tahun Anggaran 2026").',
      'Penyetoran Bagi Hasil PADes ke Kas Desa: Klik "+ Catat Kas", pilih Kas Keluar, unit usaha "Operasional Kantor / Umum", pos akun "[3004] Bagi Hasil PADes ke Kas Desa". Masukkan nominal setoran dan tulis keterangan (misal: "Penyetoran PADes Hasil Usaha BUMDes Tahun 2025 ke Rekening Kas Desa").',
      'Klik "Simpan Transaksi". Laporan Perubahan Modal dan Neraca akan otomatis mencatat mutasi ekuitas tersebut.',
    ],
    tips: 'Akun [3004] secara otomatis mengurangi ekuitas tanpa mempengaruhi laba rugi operasional berjalan.',
  },
];

export default function BantuanPage() {
  const { data: session } = useSession();
  const isCateringRole = session?.user?.role === 'CATERING';
  const isAdmin = session?.user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<'CATERING' | 'GENERAL'>(() =>
    isCateringRole ? 'CATERING' : 'GENERAL'
  );
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [openGuideId, setOpenGuideId] = useState<string | null>(() =>
    isCateringRole ? 'cat-1' : 'guide-1'
  );

  const toggleGuide = (id: string) => {
    setOpenGuideId((prev) => (prev === id ? null : id));
  };

  const currentTab = isCateringRole ? 'CATERING' : activeTab;
  const guides = currentTab === 'CATERING' ? CATERING_GUIDES : GENERAL_GUIDES;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Halaman */}
      <PageHeader
        title={
          currentTab === 'CATERING'
            ? 'Pusat Panduan & Bantuan Pengurus Catering'
            : 'Pusat Panduan & Bantuan Pembukuan BUMDes'
        }
        description={
          currentTab === 'CATERING'
            ? 'Petunjuk operasional praktis pencatatan pesanan, belanja bahan dapur, operasional kantor, dan cetak laporan keuangan Catering'
            : 'Petunjuk operasional alur 1 pintu kas, buku kas 5 unit usaha, neraca keuangan, dan export Excel BUMDes Bogem'
        }
        action={
          <BigButton
            variant="secondary"
            size="normal"
            onClick={() => setShowTutorialModal(true)}
            icon={<Play className="w-3.5 h-3.5 text-slate-700" />}
          >
            Tutorial Singkat
          </BigButton>
        }
      />

      {/* Tab Switcher untuk Super Admin */}
      {isAdmin && (
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveTab('GENERAL');
              setOpenGuideId('guide-1');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'GENERAL'
                ? 'bg-white text-slate-900 shadow-subtle'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🏢 Panduan Umum & 5 Unit Usaha
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('CATERING');
              setOpenGuideId('cat-1');
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'CATERING'
                ? 'bg-amber-600 text-white shadow-subtle'
                : 'text-amber-800 hover:text-amber-950'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>🍳 Panduan Khusus Pengurus Catering</span>
          </button>
        </div>
      )}

      {/* 3 Highlight Cards Utama */}
      {currentTab === 'CATERING' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-3.5">
                Pencatatan Uang Masuk
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Catat pesanan nasi box, prasmanan acara, snack rapat, uang muka (DP), dan pelunasan dari pelanggan.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-emerald-700">
              <span>Pos [4001] Pendapatan Catering</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
                <Utensils className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-3.5">
                Biaya Dapur vs Kantor
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pisahkan belanja bahan sembako (500x) dengan operasional kantor catering (505x) agar HPP makanan akurat.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-rose-700">
              <span>Beban Dapur & Operasional Kantor</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-3.5">
                Laba Bersih & Unduh Excel
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pantau keuntungan surplus riil usaha catering dan unduh rekap kas ke spreadsheet Excel setiap saat.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-bold text-blue-700">
              <span>Export File .xlsx & Cetak PDF</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-3.5">
                1 Pintu Pencatatan Kas
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Seluruh transaksi uang masuk & keluar dari 5 unit usaha dicatat terpusat melalui satu formulir kas yang terintegrasi.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-semibold text-emerald-700">
              <span>Satu Alur • Beban & Omzet Rapi</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-3.5">
                Buku Kas 5 Unit Usaha
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Catering, Sewa Molen, WiFi Desa, PPOB Loket, dan Peternakan Sapi memiliki rekapitulasi mutasi dan laba masing-masing.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-semibold text-blue-700">
              <span>Laba Rugi per Unit Terpisah</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
            <div>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                <Scale className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-3.5">
                Laporan Keuangan Otomatis
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Neraca, Laba Rugi, dan Buku Besar terhitung otomatis dengan validasi keseimbangan Aset = Pasiva.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-[11px] font-semibold text-indigo-700">
              <span>Standar Akuntansi • Neraca Seimbang</span>
            </div>
          </div>
        </div>
      )}

      {/* Accordion / Daftar Panduan Operasional */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {currentTab === 'CATERING'
              ? 'Panduan Langkah Demi Langkah Pengurus Catering'
              : 'Daftar Petunjuk Operasional BUMDes'}
          </h2>
          <span className="text-xs text-slate-400">Klik panduan untuk membuka rincian</span>
        </div>

        <div className="space-y-3">
          {guides.map((g) => {
            const isOpen = openGuideId === g.id;

            return (
              <div
                key={g.id}
                className={`bg-white rounded-2xl border transition-all shadow-subtle overflow-hidden ${
                  isOpen ? 'border-slate-300 ring-1 ring-slate-200' : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                {/* Header Panduan (Clickable) */}
                <button
                  type="button"
                  onClick={() => toggleGuide(g.id)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 transition-colors hover:bg-slate-50/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200/80">
                      {g.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {g.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">
                        {g.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {g.summary}
                      </p>
                    </div>
                  </div>

                  <div className="p-1 text-slate-400">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Isi Panduan Langkah */}
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
                    <div className="space-y-2.5 pt-3">
                      {g.steps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-3 text-xs text-slate-700 leading-relaxed">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {sIdx + 1}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>

                    {g.tips && (
                      <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span><strong>Petunjuk Pengurus:</strong> {g.tips}</span>
                      </div>
                    )}

                    {g.actionLink && (
                      <div className="pt-2 flex justify-end">
                        <Link
                          href={g.actionLink.href}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
                        >
                          <span>{g.actionLink.label}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kotak Kontak & Bantuan Operasional */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {currentTab === 'CATERING'
                ? 'Pusat Koordinasi & Bantuan Unit Catering'
                : 'Pusat Dukungan Teknis & Konsultasi Pembukuan'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {currentTab === 'CATERING'
                ? 'Jika butuh penambahan jenis pos belanja baru, perubahan data, atau konsultasi administrasi kas, silakan berkoordinasi langsung dengan Sekretaris Desa / Super Admin (Bapak Sugeng).'
                : 'Jika terdapat pertanyaan mengenai penambahan kode akun baru, perbaikan data historis, atau kendala akses akun pengguna, hubungi tim pengurus BUMDes Desa Bogem.'}
            </p>
          </div>
        </div>

        <Link
          href={currentTab === 'CATERING' ? '/units/catering' : '/transaksi'}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl whitespace-nowrap shadow-xs transition-colors"
        >
          <span>{currentTab === 'CATERING' ? 'Buka Kas Catering' : 'Buka Buku Kas'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Modal Onboarding Tutorial Singkat */}
      {showTutorialModal && (
        <OnboardingModal
          forceOpen={true}
          onClose={() => setShowTutorialModal(false)}
        />
      )}
    </div>
  );
}
