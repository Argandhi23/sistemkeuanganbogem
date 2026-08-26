'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Scale,
  Printer,
  FileSpreadsheet,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';

export default function BantuanPage() {
  const [showTutorialModal, setShowTutorialModal] = useState(false);

  const guides = [
    {
      title: '1. Cara Mencatat Uang Masuk atau Keluar',
      icon: <Wallet className="w-4 h-4 text-emerald-600" />,
      steps: [
        'Klik tombol "+ Catat Uang Masuk" atau "- Catat Uang Keluar" di Beranda atau menu Kas.',
        'Ketik nominal uang (angka otomatis berformat titik pemisah ribuan, contoh: 100.000).',
        'Pilih pos akun keuangan yang sesuai (misal: [4001] Pendapatan Catering atau [5001] Beban Bahan Baku Makanan).',
        'Tentukan tanggal transaksi dan tulis rincian keterangan transaksi.',
        'Klik "Simpan Transaksi". Data langsung tersimpan aman ke database dan disinkronkan.',
      ],
    },
    {
      title: '2. Cara Membaca & Memeriksa Neraca Standar Manajemen',
      icon: <Scale className="w-4 h-4 text-indigo-600" />,
      steps: [
        'Buka menu "Laporan Keuangan" lalu pilih tab "1. Neraca Keuangan".',
        'Pilih Bulan dan Tahun posisi neraca yang ingin ditinjau.',
        'Perhatikan indikator Status Neraca (harus "SEIMBANG / BALANCED" di mana Total Aset = Total Kewajiban + Ekuitas).',
        'Sisi Kiri (Aktiva) merinci Kas Tunai Bendahara, Bank, Piutang, dan Aset Tetap Peralatan.',
        'Sisi Kanan (Pasiva) merinci Utang Usaha, Modal Awal Desa, dan Laba/Rugi Bersih Berjalan secara otomatis.',
      ],
    },
    {
      title: '3. Cara Mencatat Penambahan Modal & Bagi Hasil PADes',
      icon: <Wallet className="w-4 h-4 text-purple-600" />,
      steps: [
        'Untuk Penambahan Modal / Investasi Baru: Klik "+ Catat Uang Masuk", masukkan nominal modal yang disuntikkan, dan pilih akun [3001] Modal Usaha / Modal Awal BUMDes.',
        'Tulis keterangan transaksi (contoh: "Penyertaan Modal Tambahan dari APBDes Desa Bogem 2026").',
        'Untuk Penarikan Bagi Hasil PADes: Klik "- Catat Uang Keluar", masukkan nominal, dan pilih akun [3001] Modal Usaha atau [3002] Laba Ditahan.',
        'Klik "Simpan Transaksi". Transaksi otomatis tercatat di Buku Kas, Laporan Perubahan Modal, dan Laporan Neraca.',
      ],
    },
    {
      title: '4. Cara Melihat & Mencetak Laporan Lengkap',
      icon: <Printer className="w-4 h-4 text-blue-600" />,
      steps: [
        'Buka menu "Laporan Keuangan" dari navigasi samping atau bawah.',
        'Pilih jenis laporan: (1) Neraca Keuangan, (2) Laba Rugi, (3) Perubahan Modal, (4) Buku Besar per Akun, atau (5) Arus Kas.',
        'Pilih periode pelaporan (bulan & tahun) yang diinginkan.',
        'Klik tombol "Sync Sheets" jika ingin menyinkronkan ringkasan laporan ke Google Spreadsheet BUMDes.',
        'Klik tombol "Cetak PDF" untuk mencetak dokumen resmi lengkap dengan kop Pemerintah Desa dan tanda tangan pengurus.',
      ],
    },
    {
      title: '5. Memahami Sinkronisasi Otomatis Google Sheets',
      icon: <FileSpreadsheet className="w-4 h-4 text-emerald-600" />,
      steps: [
        'Setiap kali Anda menekan Simpan, data otomatis disalin ke Google Sheets secara realtime.',
        'Jika internet sempat terputus, sistem menyimpan transaksi di antrean lokal.',
        'Bila muncul tanda "Pending Data", klik tombol "Sinkron Sheets" di navbar atas untuk mengirim ulang.',
      ],
    },
  ];

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-8">
      <PageHeader
        title="Panduan Sistem"
        description="Petunjuk penggunaan sistem pembukuan & laporan keuangan BUMDes Catering Bogem"
        action={
          <BigButton
            variant="secondary"
            size="normal"
            onClick={() => setShowTutorialModal(true)}
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-600" />}
          >
            Tutorial Singkat
          </BigButton>
        }
      />

      {/* Daftar Panduan */}
      <div className="space-y-3">
        {guides.map((g, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-3"
          >
            <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                {g.icon}
              </div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                {g.title}
              </h2>
            </div>

            <ol className="space-y-2 pl-1">
              {g.steps.map((step, sIdx) => (
                <li key={sIdx} className="flex items-start gap-2.5 text-xs text-slate-600 font-normal leading-relaxed">
                  <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 font-semibold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {sIdx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Kontak Bantuan */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-3">
        <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900">Butuh bantuan teknis?</span> Hubungi Pengurus IT BUMDes Desa Bogem atau Administrator Sistem untuk perubahan data atau kendala akun.
        </div>
      </div>

      {/* Modal Tutorial */}
      {showTutorialModal && (
        <OnboardingModal
          forceOpen={true}
          onClose={() => setShowTutorialModal(false)}
        />
      )}
    </div>
  );
}
