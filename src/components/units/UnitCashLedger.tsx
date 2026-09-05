'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Download,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';

export interface TransactionItem {
  id: string;
  type: 'PEMASUKAN' | 'PENGELUARAN';
  category: string;
  businessUnit: string;
  paymentMethod?: string | null;
  accountId?: string | null;
  description: string;
  amount: number | string;
  date: string;
  account?: {
    code: string;
    name: string;
  } | null;
  createdBy?: {
    name: string;
  } | null;
}

interface UnitCashLedgerProps {
  unit: 'CATERING' | 'RENTAL_MOLEN' | 'WIFI_DESA' | 'PPOB' | 'KETAHANAN_PANGAN' | 'UMUM';
  title: string;
  subtitle: string;
  category: string;
  icon: React.ReactNode;
  badgeColor?: string;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const YEARS = [2024, 2025, 2026, 2027];

export default function UnitCashLedger({
  unit,
  title,
  subtitle,
  category,
  icon,
  badgeColor = 'bg-slate-100 text-slate-700 border-slate-200',
}: UnitCashLedgerProps) {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.set('businessUnit', unit);
      query.set('page', page.toString());
      query.set('limit', '25');

      if (search.trim()) query.set('search', search.trim());
      if (selectedYear) query.set('year', selectedYear);
      if (selectedMonth !== 'ALL') query.set('month', selectedMonth);

      const res = await fetch(`/api/transaksi?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotalCount(json.pagination.total || 0);
        }
        if (json.summary) {
          setSummary({
            totalIncome: Number(json.summary.totalIncome || 0),
            totalExpense: Number(json.summary.totalExpense || 0),
            balance: Number(json.summary.balance || 0),
          });
        }
      }
    } catch (err) {
      console.error('Failed to load unit transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [unit, page, search, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleDelete = async (id: string, desc: string) => {
    if (!confirm(`Hapus catatan transaksi kas "${desc}"? Tindakan ini akan memperbarui saldo dan buku besar.`)) {
      return;
    }

    const previousTx = [...transactions];
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setMessage({ type: 'success', text: 'Transaksi berhasil dihapus.' });

    try {
      const res = await fetch(`/api/transaksi/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setTransactions(previousTx);
        const resJson = await res.json();
        setMessage({ type: 'error', text: resJson.error || 'Gagal menghapus transaksi.' });
      } else {
        fetchTransactions();
      }
    } catch {
      setTransactions(previousTx);
      setMessage({ type: 'error', text: 'Gagal terhubung ke server.' });
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedYear('');
    setSelectedMonth('ALL');
    setPage(1);
  };

  const isProfit = summary.balance >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Halaman Buku Kas Unit */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200/80">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {title}
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeColor}`}>
                  {category}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Ringkas (No Redundant Links) */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/export/excel?type=transaksi&businessUnit=${unit}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-subtle transition-all"
            title={`Download Buku Kas ${title} format Excel`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </a>

          <Link
            href={`/transaksi/tambah?businessUnit=${unit}&type=PENGELUARAN`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shadow-subtle transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Kas Keluar</span>
          </Link>

          <Link
            href={`/transaksi/tambah?businessUnit=${unit}&type=PEMASUKAN`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-subtle transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Kas Masuk</span>
          </Link>
        </div>
      </div>

      {/* Feedback Alert */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 KPI Cards Ringkasan Finansial Unit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Pemasukan Unit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Uang Masuk (Omzet)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
              +{formatRupiah(summary.totalIncome)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Seluruh penerimaan kas unit {category.toLowerCase()}
            </p>
          </div>
        </div>

        {/* Card 2: Total Pengeluaran Unit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Uang Keluar (Beban)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-rose-700 tabular-nums">
              -{formatRupiah(summary.totalExpense)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Biaya operasional & belanja bahan unit
            </p>
          </div>
        </div>

        {/* Card 3: Laba Bersih Unit */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Laba Bersih / Sisa Kas Unit</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums ${
                isProfit ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {isProfit ? '+' : ''}{formatRupiah(summary.balance)}
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11px]">
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  isProfit
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {isProfit ? 'Surplus Kas' : 'Defisit Kas'}
              </span>
              <span className="text-slate-400">• Dari {totalCount} transaksi</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Pencarian Buku Kas Unit */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Input Pencarian */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari keterangan, akun, atau kategori..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900 transition-colors"
          />
        </div>

        {/* Filter Periode */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-900 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Semua Bulan</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={idx} value={idx.toString()}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:border-slate-900 focus:outline-none cursor-pointer"
          >
            <option value="">Semua Tahun</option>
            {YEARS.map((y) => (
              <option key={y} value={y.toString()}>
                {y}
              </option>
            ))}
          </select>

          {(search || selectedYear || selectedMonth !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
              title="Reset Filter"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabel Buku Kas Unit */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-subtle overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 font-medium">
            Memuat transaksi buku kas unit...
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-xs text-slate-500 font-medium">
              Belum ada transaksi kas tercatat untuk unit ini dengan filter yang dipilih.
            </p>
            <div className="flex justify-center gap-2">
              <Link
                href={`/transaksi/tambah?businessUnit=${unit}&type=PEMASUKAN`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Catat Uang Masuk Pertama</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-28">Tanggal</th>
                  <th className="py-3 px-4 w-48">Pos Akun / Kategori</th>
                  <th className="py-3 px-4">Keterangan Transaksi</th>
                  <th className="py-3 px-4 w-20 text-center">Metode</th>
                  <th className="py-3 px-4 w-32 text-right">Uang Masuk</th>
                  <th className="py-3 px-4 w-32 text-right">Uang Keluar</th>
                  <th className="py-3 px-4 w-20 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isIncome = tx.type === 'PEMASUKAN';
                  const dateFormatted = new Date(tx.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {dateFormatted}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {tx.category}
                        </div>
                        {tx.account && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            [{tx.account.code}] {tx.account.name}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-700 max-w-md break-words">
                        {tx.description}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {tx.paymentMethod || 'TUNAI'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap text-emerald-700">
                        {isIncome ? `+${formatRupiah(Number(tx.amount))}` : '-'}
                      </td>

                      <td className="py-3 px-4 text-right font-bold tabular-nums whitespace-nowrap text-rose-600">
                        {!isIncome ? `-${formatRupiah(Number(tx.amount))}` : '-'}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/transaksi/${tx.id}/edit`}
                            title="Edit Transaksi"
                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>

                          <button
                            onClick={() => handleDelete(tx.id, tx.description)}
                            title="Hapus Transaksi"
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Halaman {page} dari {totalPages} ({totalCount} total transaksi)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
