'use client';

import React from 'react';
import { CheckCircle2, ArrowRight, PlusCircle, ArrowLeft, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export interface TransactionSummaryDetail {
  type: 'PEMASUKAN' | 'PENGELUARAN';
  amount: number;
  accountName?: string;
  accountCode?: string;
  date?: string;
  description?: string;
}

interface SuccessFeedbackProps {
  title?: string;
  message?: string;
  details?: TransactionSummaryDetail;
  primaryActionText?: string;
  primaryActionHref?: string;
  secondaryActionText?: string;
  secondaryActionHref?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
}

export function SuccessFeedback({
  title = 'Transaksi Berhasil Disimpan',
  message = 'Catatan keuangan telah tercatat di sistem pembukuan dan disinkronkan ke Google Sheets.',
  details,
  primaryActionText = 'Catat Transaksi Lagi',
  primaryActionHref,
  secondaryActionText = 'Buka Buku Kas',
  secondaryActionHref = '/transaksi',
  onPrimaryClick,
  onSecondaryClick,
}: SuccessFeedbackProps) {
  const isIncome = details?.type === 'PEMASUKAN';

  const formattedDate = details?.date
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(details.date))
    : null;

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200/80 shadow-subtle p-5 sm:p-6 text-left space-y-4 animate-in fade-in duration-200">
      {/* Header Status */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      {/* Rincian Transaksi yang Baru Saja Disimpan */}
      {details && (
        <div className="bg-slate-50/80 rounded-xl border border-slate-200/70 p-3.5 space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Nominal Transaksi</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  isIncome
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {isIncome ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                <span>{isIncome ? 'Uang Masuk' : 'Uang Keluar'}</span>
              </span>
              <span
                className={`text-sm font-bold tabular-nums ${
                  isIncome ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isIncome ? '+' : '-'} Rp {details.amount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px] sm:text-xs">
            {details.accountName && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 font-medium">Pos Akun:</span>
                <span className="text-slate-900 font-semibold text-right">
                  {details.accountCode ? `[${details.accountCode}] ` : ''}
                  {details.accountName}
                </span>
              </div>
            )}

            {formattedDate && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">Tanggal:</span>
                <span className="text-slate-700 font-medium">{formattedDate}</span>
              </div>
            )}

            {details.description && (
              <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                <span className="text-slate-500 font-medium">Rincian:</span>
                <span className="text-slate-700 font-normal text-right line-clamp-2 max-w-[220px]">
                  {details.description}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tombol Aksi Bersih & Minimalis */}
      <div className="pt-2 space-y-2">
        {/* Tombol Tambah Lagi (Primary) */}
        {onSecondaryClick ? (
          <button
            type="button"
            onClick={onSecondaryClick}
            className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-subtle"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{primaryActionText}</span>
          </button>
        ) : secondaryActionHref ? (
          <Link href={secondaryActionHref} className="w-full block">
            <button
              type="button"
              className="w-full h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-subtle"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{primaryActionText}</span>
            </button>
          </Link>
        ) : null}

        {/* Tombol Lihat Daftar / Buku Kas (Secondary) */}
        {primaryActionHref ? (
          <Link href={primaryActionHref} className="w-full block">
            <button
              type="button"
              className="w-full h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <span>{secondaryActionText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        ) : onPrimaryClick ? (
          <button
            type="button"
            onClick={onPrimaryClick}
            className="w-full h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <span>{secondaryActionText}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Link href="/transaksi" className="w-full block">
            <button
              type="button"
              className="w-full h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              <span>Buka Buku Kas & Transaksi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        )}

        {/* Link Kembali ke Beranda */}
        <div className="text-center pt-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Kembali ke Beranda Utama</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

