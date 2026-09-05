'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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

export default function BantuanPage() {
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [openGuideId, setOpenGuideId] = useState<string | null>('guide-1');

  const toggleGuide = (id: string) => {
    setOpenGuideId((prev) => (prev === id ? null : id));
  };

  const guides: GuideItem[] = [
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
      title: 'Cara Membuka & Memantau Buku Kas Khusus Unit Usaha',
      category: 'Buku Kas Unit',
      icon: <Building2 className="w-4 h-4 text-blue-600" />,
      summary: 'Pantau arus kas, laba bersih, dan seluruh mutasi keuangan khusus untuk masing-masing unit usaha.',
      steps: [
        'Buka menu unit yang diinginkan di bilah navigasi samping (Catering Desa, Penyewaan Molen, WiFi Balai Desa, PPOB Loket, atau Ketahanan Pangan).',
        'Di bagian atas, periksa 3 Kartu Ringkasan: Total Uang Masuk, Total Uang Keluar, dan Laba Bersih Unit.',
        'Di tabel bawah, Anda dapat melihat seluruh transaksi kas unit secara kronologis dari yang terbaru.',
        'Gunakan kolom pencarian untuk mencari keterangan transaksi tertentu.',
        'Gunakan filter Bulan dan Tahun untuk melihat rekapitulasi kas periode tertentu.',
        'Klik tombol "Export Excel" untuk mengunduh buku kas unit tersebut ke format spreadsheet (.xlsx).',
      ],
      tips: 'Tombol "+ Kas Masuk" dan "+ Kas Keluar" yang ada di halaman unit akan otomatis memilih unit tersebut di formulir.',
      actionLink: {
        label: 'Buka Buku Kas Catering',
        href: '/units/catering',
      },
    },
    {
      id: 'guide-4',
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
      id: 'guide-5',
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
      id: 'guide-6',
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* Header Halaman */}
      <PageHeader
        title="Pusat Panduan & Bantuan Pembukuan"
        description="Petunjuk operasional alur 1 pintu kas, buku kas 5 unit usaha, neraca keuangan, dan export Excel BUMDes Bogem"
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

      {/* 3 Highlight Cards Utama */}
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

      {/* Accordion / Daftar Panduan Operasional */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Daftar Petunjuk Langkah Demi Langkah
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
                        <span><strong>Saran Pengurus:</strong> {g.tips}</span>
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
              Pusat Dukungan Teknis & Konsultasi Pembukuan
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Jika terdapat pertanyaan mengenai penambahan kode akun baru, perbaikan data historis, atau kendala akses akun pengguna, hubungi tim pengurus BUMDes Desa Bogem.
            </p>
          </div>
        </div>

        <Link
          href="/transaksi"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl whitespace-nowrap shadow-xs transition-colors"
        >
          <span>Buka Buku Kas</span>
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
