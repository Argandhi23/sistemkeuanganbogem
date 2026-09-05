'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, FileSpreadsheet, Sparkles, Check, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { BigButton } from '../ui/BigButton';

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function OnboardingModal({ forceOpen = false, onClose }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }
    const hasSeen = localStorage.getItem('bumdes_bogem_onboarding_done');
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleFinish = () => {
    localStorage.setItem('bumdes_bogem_onboarding_done', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  const steps = [
    {
      title: '1. Catat Uang Masuk & Keluar dengan Mudah',
      icon: <Wallet className="w-9 h-9 text-emerald-600" />,
      badge: 'Langkah 1 dari 3',
      description:
        'Cukup tekan tombol hijau "+ Catat Uang Masuk" atau tombol merah "- Catat Uang Keluar". Masukkan nominal rupiah, pilih pos akun, lalu klik "Simpan Data".',
      tip: '💡 Tip: Angka ribuan otomatis berformat dengan titik (contoh: 50.000).',
    },
    {
      title: '2. Laporan & Neraca Keuangan Standar',
      icon: <Sparkles className="w-9 h-9 text-amber-600" />,
      badge: 'Langkah 2 dari 3',
      description:
        'Pantau posisi keuangan unit catering BUMDes melalui Neraca Standar, Laba Rugi, Buku Besar, dan Arus Kas. Anda juga dapat langsung mencetak dokumen laporan resmi dengan kop dan tanda tangan desa.',
      tip: '💡 Tip: Neraca otomatis memeriksa keseimbangan (Aktiva = Pasiva).',
    },
    {
      title: '3. Export Laporan Excel (.xlsx) Praktis & Rapi',
      icon: <FileSpreadsheet className="w-9 h-9 text-emerald-600" />,
      badge: 'Langkah 3 dari 3',
      description:
        'Semua transaksi kas dan data operasional 5 unit usaha BUMDes Bogem dapat langsung diexport menjadi file Excel (.xlsx) berformat resmi, bersih, dan tertata rapi kapan saja tanpa perlu internet khusus!',
      tip: '💡 Tip: Tombol Export Excel tersedia di Buku Kas, Laporan Keuangan, dan setiap unit usaha.',
    },
  ];

  if (!isOpen) return null;

  const active = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-elevated border border-slate-200 flex flex-col justify-between"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-100">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-800 font-extrabold text-xs uppercase tracking-wider rounded-full border border-brand-200">
            {active.badge}
          </div>
          <button
            onClick={handleFinish}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
            title="Lewati Tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Isi Tutorial */}
        <div className="p-6 sm:p-7 text-center flex-1">
          <div className="w-16 h-16 bg-slate-100/80 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
            {active.icon}
          </div>

          <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
            {active.title}
          </h3>

          <p className="mt-2.5 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
            {active.description}
          </p>

          <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-left text-xs font-semibold text-amber-900">
            {active.tip}
          </div>

          {/* Indikator Titik Langkah */}
          <div className="flex items-center justify-center gap-2 mt-5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep ? 'w-6 bg-brand-600' : 'w-2 bg-slate-300'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigasi Langkah */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {currentStep > 0 ? (
            <BigButton
              variant="secondary"
              size="normal"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              icon={<ArrowLeft className="w-4 h-4" />}
            >
              Sebelumnya
            </BigButton>
          ) : (
            <button
              onClick={handleFinish}
              className="text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 py-2 px-3"
            >
              Lewati
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <BigButton
              variant="primary"
              size="normal"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Lanjut
            </BigButton>
          ) : (
            <BigButton
              variant="primary"
              size="normal"
              onClick={handleFinish}
              icon={<Check className="w-4 h-4" />}
            >
              Mulai Pakai Aplikasi
            </BigButton>
          )}
        </div>
      </div>
    </div>
  );
}
