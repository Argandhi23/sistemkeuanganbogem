'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  TrendingUp,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Scale,
} from 'lucide-react';

const CashFlowChart = dynamic(() => import('@/components/dashboard/CashFlowChart'), {
  ssr: false,
  loading: () => (
    <div className="h-60 w-full flex items-center justify-center text-slate-400 text-xs font-medium animate-pulse bg-slate-50 rounded-xl">
      Memuat grafik arus kas...
    </div>
  ),
});

interface DashboardData {
  summary: {
    monthlyIncome: number;
    monthlyExpense: number;
    incomeGrowth?: number;
    expenseGrowth?: number;
    currentBalance: number;
    totalIncome: number;
    totalExpense: number;
  };
  sync: {
    unsyncedTotal: number;
    unsyncedTransactions: number;
    unsyncedOrders: number;
  };
  chartData: Array<{
    name: string;
    pemasukan: number;
    pengeluaran: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: 'PEMASUKAN' | 'PENGELUARAN';
    category: string;
    description: string;
    amount: number | string;
    date: string;
    account?: { name: string; code: string };
    createdBy?: { name: string };
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSyncRetry = async () => {
    try {
      setIsSyncing(true);
      setSyncMessage(null);
      const res = await fetch('/api/sync/retry', { method: 'POST' });
      const resJson = await res.json();
      if (res.ok) {
        setSyncMessage(resJson.message || 'Sinkronisasi berhasil');
        fetchStats();
      } else {
        setSyncMessage(resJson.message || 'Gagal sinkronisasi');
      }
    } catch {
      setSyncMessage('Terjadi kesalahan saat sinkronisasi');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const currentMonthName = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Sapaan Header Bersih */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 pb-1 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Ringkasan Keuangan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Unit Usaha Catering Desa Bogem • {currentMonthName}
          </p>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2">
          {data?.sync && data.sync.unsyncedTotal > 0 ? (
            <button
              onClick={handleSyncRetry}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium hover:bg-amber-100 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{data.sync.unsyncedTotal} pending sinkron</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tersinkron ke Sheets</span>
            </div>
          )}
        </div>
      </div>

      {syncMessage && (
        <div className="p-3 bg-slate-900 text-white font-medium rounded-xl text-center text-xs shadow-subtle animate-in fade-in">
          {syncMessage}
        </div>
      )}

      {/* Grid Ringkasan Keuangan Modern */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Saldo Kas */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-card flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Total Saldo Kas BUMDes</span>
              <Wallet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white tabular-nums">
                Rp {(data?.summary?.currentBalance ?? 0).toLocaleString('id-ID')}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Kas Riil (PostgreSQL)</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Laporan Lengkap</span>
            <Link
              href="/laporan"
              className="font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
            >
              <span>Buka</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Pemasukan Bulan Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Pemasukan ({currentMonthName.split(' ')[0]})</span>
              <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <ArrowDownLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-700 tabular-nums">
                + Rp {(data?.summary?.monthlyIncome ?? 0).toLocaleString('id-ID')}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                {typeof data?.summary?.incomeGrowth === 'number' && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-semibold ${
                      data.summary.incomeGrowth >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {data.summary.incomeGrowth >= 0 ? '+' : ''}{data.summary.incomeGrowth}%
                  </span>
                )}
                <span>vs bulan lalu</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Penjualan Catering</span>
            <Link href="/transaksi?type=PEMASUKAN" className="text-slate-900 font-medium hover:underline">
              Lihat Detail →
            </Link>
          </div>
        </div>

        {/* Card 3: Pengeluaran Bulan Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Pengeluaran ({currentMonthName.split(' ')[0]})</span>
              <div className="w-6 h-6 rounded-md bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-200">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-700 tabular-nums">
                - Rp {(data?.summary?.monthlyExpense ?? 0).toLocaleString('id-ID')}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                {typeof data?.summary?.expenseGrowth === 'number' && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-semibold ${
                      data.summary.expenseGrowth <= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {data.summary.expenseGrowth > 0 ? '+' : ''}{data.summary.expenseGrowth}%
                  </span>
                )}
                <span>vs bulan lalu</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Bahan Baku & Operasional</span>
            <Link href="/transaksi?type=PENGELUARAN" className="text-slate-900 font-medium hover:underline">
              Lihat Detail →
            </Link>
          </div>
        </div>
      </div>

      {/* Aksi Cepat Sederhana */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/transaksi/tambah?type=PEMASUKAN"
          className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-colors flex items-center gap-3 shadow-subtle group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0 border border-emerald-200">
            <ArrowDownLeft className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs text-slate-900 truncate">Uang Masuk</div>
            <div className="text-[11px] text-slate-500 truncate">Catat Penjualan & Kas In</div>
          </div>
        </Link>

        <Link
          href="/transaksi/tambah?type=PENGELUARAN"
          className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-colors flex items-center gap-3 shadow-subtle group"
        >
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center flex-shrink-0 border border-rose-200">
            <ArrowUpRight className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs text-slate-900 truncate">Uang Keluar</div>
            <div className="text-[11px] text-slate-500 truncate">Belanja Bahan & Biaya</div>
          </div>
        </Link>

        <Link
          href="/laporan"
          className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-colors flex items-center gap-3 shadow-subtle group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0 border border-blue-200">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-xs text-slate-900 truncate">Laporan & Neraca</div>
            <div className="text-[11px] text-slate-500 truncate">Neraca, Laba Rugi, Buku Besar</div>
          </div>
        </Link>
      </div>

      {/* Grafik Arus Kas 6 Bulan Terakhir */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Tren Arus Kas (6 Bulan Terakhir)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan pendapatan vs pengeluaran unit catering
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-56 flex items-center justify-center text-slate-400 text-xs font-medium">
            Memuat grafik...
          </div>
        ) : (
          <CashFlowChart data={data?.chartData || []} />
        )}
      </div>

      {/* Grid: Transaksi Terkini & Akses Laporan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Catatan Kas Terbaru (2 Kolom) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-600" />
                Catatan Kas Terbaru
              </h2>
              <Link
                href="/transaksi"
                className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-0.5"
              >
                <span>Lihat Semua</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data?.recentTransactions && data.recentTransactions.length > 0 ? (
              <div className="space-y-2.5">
                {data.recentTransactions.map((trx) => {
                  const trxDate = new Intl.DateTimeFormat('id-ID', {
                    day: 'numeric',
                    month: 'short',
                  }).format(new Date(trx.date));

                  const isIncome = trx.type === 'PEMASUKAN';

                  return (
                    <div
                      key={trx.id}
                      className="p-3 bg-slate-50/70 hover:bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                              isIncome
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isIncome ? 'Masuk' : 'Keluar'}
                          </span>
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {trx.account?.name || trx.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal truncate mt-0.5">
                          {trx.description} • {trxDate}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div
                          className={`text-xs sm:text-sm font-bold tabular-nums ${
                            isIncome ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIncome ? '+' : '-'} Rp {Number(trx.amount).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                Belum ada transaksi tercatat
              </div>
            )}
          </div>
        </div>

        {/* Ringkasan Neraca & Akses Cepat Laporan */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-indigo-600" />
                Neraca & Akuntansi
              </h2>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-md">
                SAK EMKM
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Laporan posisi keuangan unit catering BUMDes Bogem disusun berdasarkan prinsip pembukuan standar (Aktiva = Pasiva).
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Posisi Kas Berjalan:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  Rp {(data?.summary?.currentBalance ?? 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Surplus/Defisit Bulan Ini:</span>
                <span
                  className={`font-bold tabular-nums ${
                    ((data?.summary?.monthlyIncome ?? 0) - (data?.summary?.monthlyExpense ?? 0)) >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  Rp {(((data?.summary?.monthlyIncome ?? 0) - (data?.summary?.monthlyExpense ?? 0))).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <Link
              href="/laporan"
              className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-subtle"
            >
              <span>Buka Neraca Lengkap</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
