'use client';

import React from 'react';
import { CheckCircle2, ArrowLeft, PlusCircle, Home } from 'lucide-react';
import Link from 'next/link';
import { BigButton } from './BigButton';

interface SuccessFeedbackProps {
  title?: string;
  message?: string;
  primaryActionText?: string;
  primaryActionHref?: string;
  secondaryActionText?: string;
  secondaryActionHref?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
}

export function SuccessFeedback({
  title = 'Data Berhasil Disimpan!',
  message = 'Data pembukuan telah tercatat di sistem dan disinkronkan ke Google Sheets.',
  primaryActionText = 'Kembali ke Daftar',
  primaryActionHref,
  secondaryActionText = 'Tambah Data Lagi',
  secondaryActionHref,
  onPrimaryClick,
  onSecondaryClick,
}: SuccessFeedbackProps) {
  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-3xl border-2 border-emerald-500 shadow-xl p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200">
      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
        <CheckCircle2 className="w-12 h-12" />
      </div>

      <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
        {title}
      </h2>

      <p className="mt-3 text-base sm:text-lg text-slate-600 leading-relaxed max-w-md mx-auto">
        {message}
      </p>

      <div className="mt-8 flex flex-col gap-3.5">
        {primaryActionHref ? (
          <Link href={primaryActionHref} className="w-full">
            <BigButton
              variant="primary"
              size="large"
              className="w-full"
              icon={<ArrowLeft className="w-6 h-6" />}
            >
              {primaryActionText}
            </BigButton>
          </Link>
        ) : (
          <BigButton
            variant="primary"
            size="large"
            className="w-full"
            onClick={onPrimaryClick}
            icon={<ArrowLeft className="w-6 h-6" />}
          >
            {primaryActionText}
          </BigButton>
        )}

        {secondaryActionHref ? (
          <Link href={secondaryActionHref} className="w-full">
            <BigButton
              variant="secondary"
              size="large"
              className="w-full"
              icon={<PlusCircle className="w-6 h-6" />}
            >
              {secondaryActionText}
            </BigButton>
          </Link>
        ) : (
          onSecondaryClick && (
            <BigButton
              variant="secondary"
              size="large"
              className="w-full"
              onClick={onSecondaryClick}
              icon={<PlusCircle className="w-6 h-6" />}
            >
              {secondaryActionText}
            </BigButton>
          )
        )}

        <Link href="/" className="w-full mt-2">
          <button className="w-full py-2.5 text-base font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-2">
            <Home className="w-5 h-5" />
            <span>Kembali ke Beranda Utama</span>
          </button>
        </Link>
      </div>
    </div>
  );
}
