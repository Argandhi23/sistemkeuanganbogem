'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Calendar,
  FileSpreadsheet,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageHeader } from '@/components/ui/PageHeader';

interface TransactionItem {
  id: string;
  type: 'PEMASUKAN' | 'PENGELUARAN';
  category: string;
  description: string;
  amount: number | string;
  date: string;
  createdById: string;
  syncedToSheet: boolean;
  account?: {
    code: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SummaryMeta {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const YEAR_OPTIONS = ['ALL', '2024', '2025', '2026', '2027'];

export default function TransaksiPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const currentUserId = session?.user?.id;

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [summary, setSummary] = useState<SummaryMeta>({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'PEMASUKAN' | 'PENGELUARAN'>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<TransactionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const isSyncingRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Debounce search input agar tidak memicu query berlebih
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '25');

      if (filterType !== 'ALL') {
        params.append('type', filterType);
      }
      if (selectedYear !== 'ALL') {
        params.append('year', selectedYear);
      }
      if (selectedMonth !== 'ALL') {
        params.append('month', selectedMonth);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const res = await fetch(`/api/transaksi?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
        if (json.summary) {
          setSummary(json.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterType, selectedYear, selectedMonth, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleFilterTypeChange = (type: 'ALL' | 'PEMASUKAN' | 'PENGELUARAN') => {
    setFilterType(type);
    setCurrentPage(1);
  };

  const handleYearChange = (yr: string) => {
    setSelectedYear(yr);
    setCurrentPage(1);
  };

  const handleMonthChange = (mo: string) => {
    setSelectedMonth(mo);
    setCurrentPage(1);
  };

  const handleSyncCompactSheet = async () => {
    if (isSyncingRef.current || isSyncingSheet) return;
    try {
      isSyncingRef.current = true;
      setIsSyncingSheet(true);
      setToastMessage(null);
      const res = await fetch('/api/sync/retry', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setToastMessage(`✅ ${json.message || 'Google Sheets berhasil dirapikan & disinkronkan!'}`);
        fetchTransactions();
      } else {
        setToastMessage(`❌ ${json.message || 'Gagal sinkronisasi Google Sheets'}`);
      }
    } catch {
      setToastMessage('❌ Terjadi kesalahan saat sinkronisasi Google Sheets');
    } finally {
      setIsSyncingSheet(false);
      isSyncingRef.current = false;
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/transaksi/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setToastMessage('✅ Data transaksi berhasil dihapus');
        setDeleteTarget(null);
        fetchTransactions();
      } else {
        const err = await res.json();
        setToastMessage(`❌ ${err.error || 'Gagal menghapus data'}`);
      }
    } catch {
      setToastMessage('❌ Terjadi kesalahan');
    } finally {
      setIsDeleting(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header Halaman */}
      <PageHeader
        title="Buku Kas & Transaksi"
        description="Catatan seluruh uang masuk dan pengeluaran operasional catering BUMDes Bogem"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BigButton
              variant="secondary"
              size="normal"
              onClick={handleSyncCompactSheet}
              isLoading={isSyncingSheet}
              loadingText="Menyinkronkan..."
              icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            >
              Rapikan & Sync Sheets
            </BigButton>
            <Link href="/transaksi/tambah?type=PEMASUKAN">
              <BigButton
                variant="income"
                size="normal"
                icon={<ArrowDownLeft className="w-4 h-4" />}
              >
                + Uang Masuk
              </BigButton>
            </Link>
            <Link href="/transaksi/tambah?type=PENGELUARAN">
              <BigButton
                variant="expense"
                size="normal"
                icon={<ArrowUpRight className="w-4 h-4" />}
              >
                - Uang Keluar
              </BigButton>
            </Link>
          </div>
        }
      />

      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white font-medium rounded-xl text-center text-xs shadow-subtle animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Ringkasan Filter Bar Agregasi PostgreSQL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-subtle">
          <span className="text-xs font-medium text-slate-500">
            Total Uang Masuk {selectedYear !== 'ALL' ? `(${selectedYear})` : 'Terfilter'}
          </span>
          <div className="text-lg sm:text-xl font-bold text-emerald-700 mt-0.5 tabular-nums">
            + Rp {summary.totalIncome.toLocaleString('id-ID')}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-subtle">
          <span className="text-xs font-medium text-slate-500">
            Total Uang Keluar {selectedYear !== 'ALL' ? `(${selectedYear})` : 'Terfilter'}
          </span>
          <div className="text-lg sm:text-xl font-bold text-rose-700 mt-0.5 tabular-nums">
            - Rp {summary.totalExpense.toLocaleString('id-ID')}
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-subtle">
          <span className="text-xs font-medium text-slate-500">
            Selisih Kas {selectedYear !== 'ALL' ? `(${selectedYear})` : 'Terfilter'}
          </span>
          <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5 tabular-nums">
            Rp {summary.netBalance.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Filter Kategori, Tahun, Bulan & Pencarian */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-subtle space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Filter Tipe Transaksi */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg overflow-x-auto">
            <button
              onClick={() => handleFilterTypeChange('ALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap select-none ${
                filterType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({pagination.total})
            </button>
            <button
              onClick={() => handleFilterTypeChange('PEMASUKAN')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap select-none ${
                filterType === 'PEMASUKAN'
                  ? 'bg-emerald-600 text-white shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pemasukan
            </button>
            <button
              onClick={() => handleFilterTypeChange('PENGELUARAN')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap select-none ${
                filterType === 'PENGELUARAN'
                  ? 'bg-rose-600 text-white shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pengeluaran
            </button>
          </div>

          {/* Filter Periode Tahun & Bulan */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-600">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Tahun</option>
                {YEAR_OPTIONS.filter((y) => y !== 'ALL').map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-semibold text-slate-600">Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="text-xs font-medium text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Bulan</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={idx} value={idx.toString()}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Form Pencarian Cepat */}
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <input
                type="text"
                placeholder="Cari transaksi / kode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:outline-none transition-all"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              {isLoading && (
                <RefreshCw className="w-3 h-3 text-slate-400 absolute right-2.5 top-2.5 animate-spin" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Konten Daftar Transaksi */}
      {isLoading && transactions.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-slate-400 border border-slate-200 text-xs">
          Memuat data transaksi...
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-slate-300">
          <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">Belum Ada Transaksi</h3>
          <p className="mt-0.5 text-xs text-slate-500 max-w-sm mx-auto">
            {debouncedSearch
              ? 'Tidak ada transaksi yang cocok dengan pencarian Anda.'
              : selectedYear !== 'ALL'
              ? `Belum ada transaksi tercatat untuk Tahun ${selectedYear}.`
              : 'Mulai catat transaksi kas pertama unit catering Bogem.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tampilan Mobile: Kartu */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {transactions.map((trx) => {
              const isIncome = trx.type === 'PEMASUKAN';
              const canEdit = isAdmin || trx.createdById === currentUserId;
              const dateFormatted = new Intl.DateTimeFormat('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(new Date(trx.date));

              return (
                <div
                  key={trx.id}
                  className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-subtle space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-medium ${
                            isIncome
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isIncome ? 'Masuk' : 'Keluar'}
                        </span>
                        {trx.account?.code && (
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            [{trx.account.code}]
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {trx.account?.name || trx.category}
                      </h4>
                    </div>

                    <div
                      className={`text-sm font-bold tabular-nums ${
                        isIncome ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isIncome ? '+' : '-'} Rp {Number(trx.amount).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {trx.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>{dateFormatted} • {trx.createdBy?.name || 'Petugas'}</span>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Link href={`/transaksi/${trx.id}/edit`} className="text-slate-600 hover:text-slate-900 font-medium px-2 py-0.5 rounded hover:bg-slate-100">
                          Edit
                        </Link>
                      )}
                      {canEdit && (
                        <button onClick={() => setDeleteTarget(trx)} className="text-rose-600 hover:text-rose-700 font-medium px-2 py-0.5 rounded hover:bg-rose-50">
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tampilan Desktop: Tabel Bersih */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Jenis</th>
                    <th className="py-3 px-4">Kode & Pos Akun Keuangan</th>
                    <th className="py-3 px-4 text-right">Nominal (Rp)</th>
                    <th className="py-3 px-4">Petugas</th>
                    <th className="py-3 px-4 text-center">Sheets</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((trx) => {
                    const isIncome = trx.type === 'PEMASUKAN';
                    const canEdit = isAdmin || trx.createdById === currentUserId;
                    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(trx.date));

                    return (
                      <tr key={trx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-600 whitespace-nowrap">
                          {dateFormatted}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              isIncome
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isIncome ? 'Masuk' : 'Keluar'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {trx.account?.code && (
                              <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[11px]">
                                [{trx.account.code}]
                              </span>
                            )}
                            <span className="font-semibold text-slate-900">
                              {trx.account?.name || trx.category}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">
                            {trx.description}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span
                            className={`font-semibold tabular-nums ${
                              isIncome ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isIncome ? '+' : '-'} Rp {Number(trx.amount).toLocaleString('id-ID')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {trx.createdBy?.name || 'Petugas'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {trx.syncedToSheet ? (
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Tersinkron
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                              <Link href={`/transaksi/${trx.id}/edit`}>
                                <button
                                  title="Edit Transaksi"
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </Link>
                            )}

                            {canEdit && (
                              <button
                                onClick={() => setDeleteTarget(trx)}
                                title="Hapus Transaksi"
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Menampilkan {((pagination.page - 1) * pagination.limit) + 1} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} dari{' '}
                <span className="font-bold text-slate-900">{pagination.total}</span> data
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev || isLoading}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 font-semibold">
                  Halaman {pagination.page} dari {pagination.totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasNext || isLoading}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Hapus Transaksi Ini?"
        message={`Yakin ingin menghapus catatan transaksi "${deleteTarget?.category} - Rp ${Number(
          deleteTarget?.amount || 0
        ).toLocaleString('id-ID')}"?`}
        confirmText="Hapus"
        cancelText="Batal"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
