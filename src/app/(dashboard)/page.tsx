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
  Download,
  UtensilsCrossed,
  Hammer,
  Wifi,
  Smartphone,
  Sprout,
  Building2,
} from 'lucide-react';
import { formatRupiah } from '@/lib/formatters';
import { getClientDashboardCache, setClientDashboardCache } from '@/lib/client-cache';

const CashFlowChart = dynamic(() => import('@/components/dashboard/CashFlowChart'), {
  ssr: false,
  loading: () => (
    <div className="h-60 w-full flex items-center justify-center text-slate-400 text-xs font-medium animate-pulse bg-slate-50 rounded-xl">
      Memuat grafik arus kas...
    </div>
  ),
});

interface UnitFinancialItem {
  unit: 'CATERING' | 'RENTAL_MOLEN' | 'WIFI_DESA' | 'PPOB' | 'KETAHANAN_PANGAN' | 'UMUM';
  name: string;
  category: string;
  route: string;
  allTime: {
    income: number;
    expense: number;
    net: number;
    count: number;
  };
  thisMonth: {
    income: number;
    expense: number;
    net: number;
    count: number;
  };
  activeOrdersCount?: number;
}

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
  chartData: Array<{
    name: string;
    pemasukan: number;
    pengeluaran: number;
  }>;
  recentTransactions: Array<{
    id: string;
    type: 'PEMASUKAN' | 'PENGELUARAN';
    category: string;
    businessUnit?: string;
    description: string;
    amount: number | string;
    date: string;
    account?: { name: string; code: string };
    createdBy?: { name: string };
  }>;
  unitFinancials?: UnitFinancialItem[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(() => getClientDashboardCache() as DashboardData | null);
  const [isLoading, setIsLoading] = useState(!getClientDashboardCache());
  const [unitTimeframe, setUnitTimeframe] = useState<'allTime' | 'thisMonth'>('allTime');

  const fetchStats = async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const json = await res.json();
        setClientDashboardCache(json.data);
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(Boolean(getClientDashboardCache()));
  }, []);

  const currentMonthName = new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const getUnitIcon = (unit: string) => {
    switch (unit) {
      case 'CATERING':
        return <UtensilsCrossed className="w-4 h-4 text-amber-600" />;
      case 'RENTAL_MOLEN':
        return <Hammer className="w-4 h-4 text-orange-600" />;
      case 'WIFI_DESA':
        return <Wifi className="w-4 h-4 text-blue-600" />;
      case 'PPOB':
        return <Smartphone className="w-4 h-4 text-emerald-600" />;
      case 'KETAHANAN_PANGAN':
        return <Sprout className="w-4 h-4 text-emerald-800" />;
      default:
        return <Building2 className="w-4 h-4 text-slate-600" />;
    }
  };

  const getUnitBadge = (unit?: string) => {
    switch (unit) {
      case 'CATERING':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Catering</span>;
      case 'RENTAL_MOLEN':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">Molen</span>;
      case 'WIFI_DESA':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">WiFi</span>;
      case 'PPOB':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">PPOB</span>;
      case 'KETAHANAN_PANGAN':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-800 border border-green-200">Sapi</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">Umum</span>;
    }
  };

  const netMonthlyProfit = (data?.summary?.monthlyIncome ?? 0) - (data?.summary?.monthlyExpense ?? 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Utama Modern */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Dashboard Keuangan BUMDes Bogem
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Periode {currentMonthName}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/excel?type=transaksi"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-subtle transition-all"
            title="Download Rekap Transaksi Buku Kas Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download Excel</span>
          </a>
          <Link
            href="/transaksi/tambah?type=PENGELUARAN"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold shadow-subtle transition-all"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>- Uang Keluar</span>
          </Link>
          <Link
            href="/transaksi/tambah?type=PEMASUKAN"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-subtle transition-all"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>+ Uang Masuk</span>
          </Link>
        </div>
      </div>

      {/* Grid Ringkasan Keuangan (Top 4 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Saldo Kas */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Total Saldo Kas</span>
              <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-white tabular-nums">
                {formatRupiah(data?.summary?.currentBalance ?? 0)}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-end text-xs">
            <Link
              href="/transaksi"
              className="font-medium text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 transition-colors"
            >
              <span>Buku Kas</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Card 2: Pemasukan Bulan Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Pemasukan</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-emerald-700 tabular-nums">
                +{formatRupiah(data?.summary?.monthlyIncome ?? 0)}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                {typeof data?.summary?.incomeGrowth === 'number' && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      data.summary.incomeGrowth >= 0
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {data.summary.incomeGrowth >= 0 ? '+' : ''}{data.summary.incomeGrowth}%
                  </span>
                )}
                <span>Bulan Ini</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
            <Link href="/transaksi?type=PEMASUKAN" className="text-slate-700 font-medium hover:text-emerald-700 inline-flex items-center gap-1 transition-colors">
              <span>Rincian</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Card 3: Pengeluaran Bulan Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Pengeluaran</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight text-rose-700 tabular-nums">
                -{formatRupiah(data?.summary?.monthlyExpense ?? 0)}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                <span>Bulan Ini</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
            <Link href="/transaksi?type=PENGELUARAN" className="text-slate-700 font-medium hover:text-rose-700 inline-flex items-center gap-1 transition-colors">
              <span>Rincian</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Card 4: Laba Bersih Bulan Ini */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Laba Bersih</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div
                className={`text-2xl font-bold tracking-tight tabular-nums ${
                  netMonthlyProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {netMonthlyProfit >= 0 ? '+' : ''}{formatRupiah(netMonthlyProfit)}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    netMonthlyProfit >= 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {netMonthlyProfit >= 0 ? 'Surplus' : 'Defisit'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
            <Link href="/laporan" className="text-slate-700 font-medium hover:text-slate-900 inline-flex items-center gap-1 transition-colors">
              <span>Laporan</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION: KINERJA KEUANGAN PER UNIT USAHA */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Kinerja Unit Usaha
            </h2>
          </div>

          {/* Toggle Filter: All Time vs Bulan Ini */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto text-xs font-medium">
            <button
              onClick={() => setUnitTimeframe('allTime')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                unitTimeframe === 'allTime'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Akumulasi Total
            </button>
            <button
              onClick={() => setUnitTimeframe('thisMonth')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                unitTimeframe === 'thisMonth'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulan Ini
            </button>
          </div>
        </div>

        {/* Matrix Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.unitFinancials || []).map((unit) => {
            const metrics = unitTimeframe === 'allTime' ? unit.allTime : unit.thisMonth;
            const isProfit = metrics.net >= 0;

            return (
              <div
                key={unit.unit}
                className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Icon & Name */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200/60">
                        {getUnitIcon(unit.unit)}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">
                        {unit.name}
                      </h3>
                    </div>

                    {unit.activeOrdersCount !== undefined && unit.activeOrdersCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-semibold">
                        {unit.activeOrdersCount} Pesanan
                      </span>
                    )}
                  </div>

                  {/* Financial Numbers Matrix */}
                  <div className="mt-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Pemasukan</span>
                      <span className="font-semibold text-emerald-700 tabular-nums">
                        +{formatRupiah(metrics.income)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Pengeluaran</span>
                      <span className="font-semibold text-rose-600 tabular-nums">
                        -{formatRupiah(metrics.expense)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-700">Laba Bersih</span>
                      <span
                        className={`tabular-nums ${
                          isProfit ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {isProfit ? '+' : ''}{formatRupiah(metrics.net)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Clean Link */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
                  <Link
                    href={unit.route}
                    className="font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 transition-colors text-xs"
                  >
                    <span>Buku Kas</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chart & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grafik Arus Kas 6 Bulan */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-sm text-slate-900">Arus Kas 6 Bulan Terakhir</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span className="text-slate-600 font-medium">Pemasukan</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 font-medium">Pengeluaran</span>
              </div>
            </div>
          </div>

          <CashFlowChart data={data?.chartData || []} />
        </div>

        {/* Transaksi Terbaru Seluruh BUMDes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h2 className="font-bold text-sm text-slate-900">Aktivitas Terbaru</h2>
              <Link href="/transaksi" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                Lihat Semua →
              </Link>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-slate-400">Memuat transaksi terbaru...</div>
              ) : !data?.recentTransactions || data.recentTransactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">Belum ada transaksi kas tercatat.</div>
              ) : (
                data.recentTransactions.map((tx) => {
                  const isIncome = tx.type === 'PEMASUKAN';
                  const dateFormatted = new Date(tx.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          {getUnitBadge(tx.businessUnit)}
                          <span className="font-semibold text-slate-900 truncate">{tx.category}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {dateFormatted} • {tx.description}
                        </div>
                      </div>

                      <div
                        className={`font-bold tabular-nums whitespace-nowrap ${
                          isIncome ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {isIncome ? '+' : '-'}{formatRupiah(Number(tx.amount))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
            <Link
              href="/transaksi"
              className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
            >
              <span>Buka Seluruh Buku Kas</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
