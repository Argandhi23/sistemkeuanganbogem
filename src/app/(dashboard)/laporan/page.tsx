'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Printer,
  Calendar,
  FileSpreadsheet,
  TrendingUp,
  BookOpen,
  DollarSign,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  IncomeStatementResult,
  GeneralLedgerResult,
  CashFlowResult,
  BalanceSheetResult,
  EquityStatementResult,
} from '@/lib/accounting';

interface AccountOption {
  id: string;
  code: string;
  name: string;
  category: string;
}

export default function LaporanPage() {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<'neraca' | 'laba-rugi' | 'perubahan-modal' | 'buku-besar' | 'arus-kas'>('neraca');
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Master Accounts for General Ledger
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Report States
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResult | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementResult | null>(null);
  const [equityStatement, setEquityStatement] = useState<EquityStatementResult | null>(null);
  const [generalLedger, setGeneralLedger] = useState<GeneralLedgerResult | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sheets Sync State
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];

  const years = [2024, 2025, 2026, 2027];

  useEffect(() => {
    fetch('/api/accounts')
      .then((res) => res.json())
      .then((json) => {
        const list = json.data || [];
        setAccounts(list);
        if (list.length > 0) {
          setSelectedAccountId((prev) => (prev ? prev : list[0].id));
        }
      })
      .catch((err) => console.error('Error fetching accounts:', err));
  }, []);

  const fetchReportData = useCallback(async () => {
    try {
      setIsLoading(true);
      const start = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

      if (activeTab === 'neraca') {
        const res = await fetch(`/api/laporan/neraca?asOfDate=${end}`);
        if (res.ok) {
          const json = await res.json();
          setBalanceSheet(json.data);
        }
      } else if (activeTab === 'laba-rugi') {
        const res = await fetch(`/api/laporan/laba-rugi?startDate=${start}&endDate=${end}`);
        if (res.ok) {
          const json = await res.json();
          setIncomeStatement(json.data);
        }
      } else if (activeTab === 'perubahan-modal') {
        const res = await fetch(`/api/laporan/perubahan-modal?startDate=${start}&endDate=${end}`);
        if (res.ok) {
          const json = await res.json();
          setEquityStatement(json.data);
        }
      } else if (activeTab === 'buku-besar') {
        if (selectedAccountId) {
          const res = await fetch(
            `/api/laporan/buku-besar?accountId=${selectedAccountId}&startDate=${start}&endDate=${end}`
          );
          if (res.ok) {
            const json = await res.json();
            setGeneralLedger(json.data);
          }
        }
      } else if (activeTab === 'arus-kas') {
        const res = await fetch(`/api/laporan/arus-kas?startDate=${start}&endDate=${end}`);
        if (res.ok) {
          const json = await res.json();
          setCashFlow(json.data);
        }
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedMonth, selectedYear, selectedAccountId]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleSyncToSheets = async () => {
    try {
      setIsSyncingSheet(true);
      setSyncFeedback(null);
      const res = await fetch('/api/laporan/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear, month: selectedMonth }),
      });
      const json = await res.json();
      if (res.ok) {
        setSyncFeedback(`✅ ${json.message || 'Laporan Bulanan & Neraca berhasil disinkronkan ke Google Sheets'}`);
      } else {
        setSyncFeedback(`❌ ${json.error || 'Gagal sinkronisasi'}`);
      }
    } catch {
      setSyncFeedback('❌ Gagal terhubung ke server');
    } finally {
      setIsSyncingSheet(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header Halaman (Tidak dicetak) */}
      <div className="no-print space-y-3">
        <PageHeader
          title="Laporan Keuangan"
          description="Laporan Laba Rugi, Buku Besar, dan Arus Kas unit Catering BUMDes Bogem"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <BigButton
                variant="secondary"
                size="normal"
                onClick={handleSyncToSheets}
                isLoading={isSyncingSheet}
                loadingText="Mengirim..."
                icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
              >
                Sync Sheets
              </BigButton>
              <BigButton
                variant="primary"
                size="normal"
                onClick={handlePrint}
                icon={<Printer className="w-4 h-4" />}
              >
                Cetak PDF
              </BigButton>
            </div>
          }
        />

        {syncFeedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium animate-in fade-in">
            {syncFeedback}
          </div>
        )}

        {/* Tab Navigasi & Filter Periode */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tab Selector Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg overflow-x-auto">
            <button
              onClick={() => setActiveTab('neraca')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'neraca'
                  ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-indigo-600" />
              <span>1. Neraca Keuangan</span>
            </button>

            <button
              onClick={() => setActiveTab('laba-rugi')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'laba-rugi'
                  ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. Laba Rugi</span>
            </button>

            <button
              onClick={() => setActiveTab('perubahan-modal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'perubahan-modal'
                  ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>3. Perubahan Modal</span>
            </button>

            <button
              onClick={() => setActiveTab('buku-besar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'buku-besar'
                  ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>4. Buku Besar</span>
            </button>

            <button
              onClick={() => setActiveTab('arus-kas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === 'arus-kas'
                  ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              <span>5. Arus Kas</span>
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="h-8 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none"
            >
              {months.map((m, idx) => (
                <option key={idx} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="h-8 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Khusus Tab Buku Besar: Dropdown Pemilih Akun */}
        {activeTab === 'buku-besar' && (
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-subtle flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Akun:
            </span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full h-8 px-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:border-slate-900 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  [{acc.code}] {acc.name} ({acc.category})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* DOKUMEN LAPORAN RESMI (Tampil di Web & Dicetak) */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-subtle print:border-none print:shadow-none print:p-0">
        {/* Kop Surat Laporan Resmi */}
        <div className="pb-5 border-b-2 border-slate-900 mb-6">
          <div className="flex items-center justify-center gap-4">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Logo BUMDes Bogem"
                width={56}
                height={56}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div className="text-center">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide">
                Pemerintah Desa Bogem
              </h2>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 uppercase">
                Badan Usaha Milik Desa (BUMDes) Bogem
              </h3>
              <p className="text-xs text-slate-600">
                Unit Usaha Catering & Pelayanan Konsumsi • Desa Bogem
              </p>
            </div>
          </div>

          <div className="mt-3 text-center">
            <div className="inline-block bg-slate-100 print:bg-transparent px-3 py-1 rounded-md border border-slate-300">
              <h4 className="text-xs font-bold text-slate-900 uppercase">
                {activeTab === 'neraca' && `Laporan Posisi Keuangan (Neraca): Per ${new Date(selectedYear, selectedMonth + 1, 0).getDate()} ${months[selectedMonth]} ${selectedYear}`}
                {activeTab === 'laba-rugi' && `Laporan Laba Rugi: ${months[selectedMonth]} ${selectedYear}`}
                {activeTab === 'perubahan-modal' && `Laporan Perubahan Modal: ${months[selectedMonth]} ${selectedYear}`}
                {activeTab === 'buku-besar' && `Buku Besar: ${generalLedger?.account?.name || ''} [${generalLedger?.account?.code || ''}] — ${months[selectedMonth]} ${selectedYear}`}
                {activeTab === 'arus-kas' && `Rekapitulasi Arus Kas: ${months[selectedMonth]} ${selectedYear}`}
              </h4>
            </div>
          </div>
        </div>

        {/* KONTEN TAB 1: LAPORAN NERACA STANDAR MANAJEMEN */}
        {activeTab === 'neraca' && (
          <div className="space-y-5">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Memuat data Neraca Keuangan...
              </div>
            ) : !balanceSheet ? (
              <div className="py-8 text-center text-slate-400 text-xs">Data tidak tersedia.</div>
            ) : (
              <div className="space-y-4">
                {/* Balance Status Banner */}
                <div
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-medium ${
                    balanceSheet.isBalanced
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{balanceSheet.isBalanced ? '✅' : '⚠️'}</span>
                    <div>
                      <span className="font-bold">Status Neraca: </span>
                      <span>{balanceSheet.isBalanced ? 'SEIMBANG (BALANCED)' : 'BELUM SEIMBANG'}</span>
                      <span className="text-slate-500 ml-2 font-normal">
                        (Prinsip Akuntansi: Total Aset = Total Kewajiban + Total Ekuitas)
                      </span>
                    </div>
                  </div>
                  {!balanceSheet.isBalanced && (
                    <div className="font-bold text-rose-700">
                      Selisih: Rp {Math.abs(balanceSheet.discrepancy).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>

                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Aset (Aktiva)</div>
                    <div className="text-sm sm:text-base font-bold text-emerald-700 mt-0.5 tabular-nums">
                      Rp {balanceSheet.assets.totalAssets.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Kewajiban</div>
                    <div className="text-sm sm:text-base font-bold text-slate-800 mt-0.5 tabular-nums">
                      Rp {balanceSheet.liabilities.totalLiabilities.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Ekuitas</div>
                    <div className="text-sm sm:text-base font-bold text-slate-800 mt-0.5 tabular-nums">
                      Rp {balanceSheet.equity.totalEquity.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 text-white rounded-xl">
                    <div className="text-[10px] font-semibold text-slate-400 uppercase">Total Pasiva</div>
                    <div className="text-sm sm:text-base font-bold text-white mt-0.5 tabular-nums">
                      Rp {balanceSheet.totalLiabilitiesAndEquity.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Tabel 2 Kolom: Aktiva (Kiri) vs Pasiva (Kanan) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 print:grid-cols-2">
                  {/* SISI KIRI: ASET / AKTIVA */}
                  <div className="space-y-4">
                    <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-emerald-800 text-white font-semibold text-[11px] uppercase">
                            <th colSpan={2} className="py-2.5 px-3">
                              ASET (AKTIVA)
                            </th>
                            <th className="py-2.5 px-3 text-right w-32">Jumlah (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {/* Aset Lancar */}
                          <tr className="bg-emerald-50/70 font-bold text-emerald-950 text-[11px] uppercase">
                            <td colSpan={3} className="py-2 px-3">
                              1. Aset Lancar
                            </td>
                          </tr>
                          {balanceSheet.assets.currentAssets.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-slate-500 w-16">{item.code}</td>
                              <td className="py-2 px-3 text-slate-800">{item.name}</td>
                              <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                                Rp {item.amount.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-emerald-50/40 font-semibold text-emerald-900">
                            <td colSpan={2} className="py-1.5 px-3 text-right">
                              Subtotal Aset Lancar:
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums">
                              Rp {balanceSheet.assets.currentAssets.total.toLocaleString('id-ID')}
                            </td>
                          </tr>

                          {/* Aset Tetap */}
                          <tr className="bg-emerald-50/70 font-bold text-emerald-950 text-[11px] uppercase">
                            <td colSpan={3} className="py-2 px-3">
                              2. Aset Tetap & Peralatan
                            </td>
                          </tr>
                          {balanceSheet.assets.fixedAssets.items.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-2 px-3 text-slate-400 italic">
                                Belum ada aset tetap tercatat
                              </td>
                            </tr>
                          ) : (
                            balanceSheet.assets.fixedAssets.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono text-slate-500 w-16">{item.code}</td>
                                <td className="py-2 px-3 text-slate-800">{item.name}</td>
                                <td
                                  className={`py-2 px-3 text-right font-medium tabular-nums ${
                                    item.amount < 0 ? 'text-rose-700' : 'text-slate-900'
                                  }`}
                                >
                                  {item.amount < 0
                                    ? `(Rp ${Math.abs(item.amount).toLocaleString('id-ID')})`
                                    : `Rp ${item.amount.toLocaleString('id-ID')}`}
                                </td>
                              </tr>
                            ))
                          )}
                          <tr className="bg-emerald-50/40 font-semibold text-emerald-900">
                            <td colSpan={2} className="py-1.5 px-3 text-right">
                              Subtotal Aset Tetap:
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums">
                              Rp {balanceSheet.assets.fixedAssets.total.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-emerald-700 text-white font-bold text-xs">
                            <td colSpan={2} className="py-2.5 px-3 uppercase">
                              TOTAL ASET (AKTIVA):
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              Rp {balanceSheet.assets.totalAssets.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* SISI KANAN: KEWAJIBAN & EKUITAS (PASIVA) */}
                  <div className="space-y-4">
                    <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-800 text-white font-semibold text-[11px] uppercase">
                            <th colSpan={2} className="py-2.5 px-3">
                              KEWAJIBAN & EKUITAS (PASIVA)
                            </th>
                            <th className="py-2.5 px-3 text-right w-32">Jumlah (Rp)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {/* Kewajiban */}
                          <tr className="bg-slate-100 font-bold text-slate-900 text-[11px] uppercase">
                            <td colSpan={3} className="py-2 px-3">
                              1. Kewajiban / Utang
                            </td>
                          </tr>
                          {balanceSheet.liabilities.currentLiabilities.items.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-2 px-3 text-slate-400 italic">
                                Tidak ada kewajiban lancar
                              </td>
                            </tr>
                          ) : (
                            balanceSheet.liabilities.currentLiabilities.items.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono text-slate-500 w-16">{item.code}</td>
                                <td className="py-2 px-3 text-slate-800">{item.name}</td>
                                <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                                  Rp {item.amount.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            ))
                          )}
                          <tr className="bg-slate-50 font-semibold text-slate-800">
                            <td colSpan={2} className="py-1.5 px-3 text-right">
                              Subtotal Kewajiban:
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums">
                              Rp {balanceSheet.liabilities.totalLiabilities.toLocaleString('id-ID')}
                            </td>
                          </tr>

                          {/* Ekuitas */}
                          <tr className="bg-slate-100 font-bold text-slate-900 text-[11px] uppercase">
                            <td colSpan={3} className="py-2 px-3">
                              2. Ekuitas & Modal
                            </td>
                          </tr>
                          {balanceSheet.equity.capital.items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-slate-500 w-16">{item.code}</td>
                              <td className="py-2 px-3 text-slate-800">{item.name}</td>
                              <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                                Rp {item.amount.toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                          <tr className="hover:bg-slate-50 bg-emerald-50/30">
                            <td className="py-2 px-3 font-mono text-emerald-700 font-bold w-16">3301</td>
                            <td className="py-2 px-3 text-emerald-950 font-semibold">
                              Laba/Rugi Bersih Periode Berjalan (Surplus/Defisit)
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-bold tabular-nums ${
                                balanceSheet.equity.currentPeriodProfit >= 0
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              Rp {balanceSheet.equity.currentPeriodProfit.toLocaleString('id-ID')}
                            </td>
                          </tr>
                          <tr className="bg-slate-50 font-semibold text-slate-800">
                            <td colSpan={2} className="py-1.5 px-3 text-right">
                              Subtotal Ekuitas:
                            </td>
                            <td className="py-1.5 px-3 text-right tabular-nums">
                              Rp {balanceSheet.equity.totalEquity.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-bold text-xs">
                            <td colSpan={2} className="py-2.5 px-3 uppercase">
                              TOTAL KEWAJIBAN & EKUITAS:
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">
                              Rp {balanceSheet.totalLiabilitiesAndEquity.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KONTEN TAB 2: LAPORAN LABA RUGI */}
        {activeTab === 'laba-rugi' && (
          <div className="space-y-5">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Memuat data Laba Rugi...
              </div>
            ) : !incomeStatement ? (
              <div className="py-8 text-center text-slate-400 text-xs">Data tidak tersedia.</div>
            ) : (
              <div className="space-y-4">
                {/* 3 Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Pendapatan</div>
                    <div className="text-lg font-bold text-emerald-700 mt-0.5 tabular-nums">
                      Rp {incomeStatement.revenue.total.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Beban</div>
                    <div className="text-lg font-bold text-rose-700 mt-0.5 tabular-nums">
                      Rp {(incomeStatement.operatingExpenses.total + incomeStatement.nonOperatingExpenses.total).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 text-white rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase">Laba / Rugi Bersih</div>
                    <div className="text-lg font-bold text-white mt-0.5 tabular-nums">
                      Rp {incomeStatement.netIncome.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Tabel Rincian Laba Rugi */}
                <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-100 font-semibold text-slate-700 text-[11px] uppercase border-b border-slate-300">
                        <th className="py-2.5 px-3 w-24">Kode</th>
                        <th className="py-2.5 px-3">Pos Akuntansi / Keterangan</th>
                        <th className="py-2.5 px-3 text-right w-36">Jumlah (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {/* PENDAPATAN */}
                      <tr className="bg-emerald-50/50 font-bold text-emerald-900 text-[11px] uppercase">
                        <td colSpan={3} className="py-2 px-3">
                          A. Pendapatan Usaha Catering
                        </td>
                      </tr>
                      {incomeStatement.revenue.accounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-500">{acc.code}</td>
                          <td className="py-2 px-3 text-slate-800">
                            {acc.name}
                            <span className="ml-2 text-[10px] text-slate-400">({acc.transactionCount} transaksi)</span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                            Rp {acc.total.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-50 font-bold text-emerald-950">
                        <td colSpan={2} className="py-2 px-3 text-right">
                          TOTAL PENDAPATAN (A):
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-700 tabular-nums">
                          Rp {incomeStatement.revenue.total.toLocaleString('id-ID')}
                        </td>
                      </tr>

                      {/* BEBAN OPERASIONAL */}
                      <tr className="bg-rose-50/50 font-bold text-rose-900 text-[11px] uppercase">
                        <td colSpan={3} className="py-2 px-3">
                          B. Beban Operasional
                        </td>
                      </tr>
                      {incomeStatement.operatingExpenses.accounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-500">{acc.code}</td>
                          <td className="py-2 px-3 text-slate-800">
                            {acc.name}
                            <span className="ml-2 text-[10px] text-slate-400">({acc.transactionCount} transaksi)</span>
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                            Rp {acc.total.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-rose-50 font-bold text-rose-950">
                        <td colSpan={2} className="py-2 px-3 text-right">
                          TOTAL BEBAN OPERASIONAL (B):
                        </td>
                        <td className="py-2 px-3 text-right text-rose-700 tabular-nums">
                          Rp {incomeStatement.operatingExpenses.total.toLocaleString('id-ID')}
                        </td>
                      </tr>

                      {/* LABA KOTOR */}
                      <tr className="bg-slate-100 font-bold text-slate-900">
                        <td colSpan={2} className="py-2 px-3 text-right">
                          LABA OPERASIONAL / KOTOR (A − B):
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          Rp {incomeStatement.grossOperatingProfit.toLocaleString('id-ID')}
                        </td>
                      </tr>

                      {/* BEBAN NON-OPERASIONAL */}
                      <tr className="bg-slate-50 font-semibold text-slate-700 text-[11px] uppercase">
                        <td colSpan={3} className="py-2 px-3">
                          C. Beban Non-Operasional
                        </td>
                      </tr>
                      {incomeStatement.nonOperatingExpenses.accounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-slate-500">{acc.code}</td>
                          <td className="py-2 px-3 text-slate-800">{acc.name}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                            Rp {acc.total.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100 font-semibold text-slate-800">
                        <td colSpan={2} className="py-2 px-3 text-right">
                          TOTAL BEBAN NON-OPERASIONAL (C):
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          Rp {incomeStatement.nonOperatingExpenses.total.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-bold text-xs">
                        <td colSpan={2} className="py-2.5 px-3 text-right uppercase">
                          LABA / RUGI BERSIH:
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          Rp {incomeStatement.netIncome.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KONTEN TAB 3: LAPORAN PERUBAHAN MODAL / EKUITAS */}
        {activeTab === 'perubahan-modal' && (
          <div className="space-y-5">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Memuat data Laporan Perubahan Modal...
              </div>
            ) : !equityStatement ? (
              <div className="py-8 text-center text-slate-400 text-xs">Data tidak tersedia.</div>
            ) : (
              <div className="space-y-4">
                {/* 3 Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Modal Awal Periode</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                      Rp {equityStatement.beginningCapital.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Laba Bersih Berjalan</div>
                    <div
                      className={`text-lg font-bold mt-0.5 tabular-nums ${
                        equityStatement.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {equityStatement.netIncome >= 0 ? '+' : '-'} Rp {Math.abs(equityStatement.netIncome).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 text-white rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase">Modal Akhir (Total Ekuitas)</div>
                    <div className="text-lg font-bold text-white mt-0.5 tabular-nums">
                      Rp {equityStatement.endingCapital.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Tabel Rincian Perubahan Modal */}
                <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-100 font-semibold text-slate-700 text-[11px] uppercase border-b border-slate-300">
                        <th className="py-2.5 px-3">Uraian / Pos Perubahan Ekuitas</th>
                        <th className="py-2.5 px-3 text-right w-44">Jumlah (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          1. Modal Awal Per 1 {months[selectedMonth]} {selectedYear}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900 tabular-nums">
                          Rp {equityStatement.beginningCapital.toLocaleString('id-ID')}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 pl-6 text-slate-700">
                          • Laba / (Rugi) Bersih Periode {months[selectedMonth]} {selectedYear}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-semibold tabular-nums ${
                            equityStatement.netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {equityStatement.netIncome >= 0 ? '+' : '-'} Rp {Math.abs(equityStatement.netIncome).toLocaleString('id-ID')}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 pl-6 text-slate-700">
                          • Penambahan Modal / Investasi Baru BUMDes
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900 tabular-nums">
                          + Rp {equityStatement.additionalCapital.toLocaleString('id-ID')}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 pl-6 text-slate-700">
                          • Penarikan Modal / Bagi Hasil PADes Desa Bogem
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-rose-700 tabular-nums">
                          - Rp {equityStatement.withdrawals.toLocaleString('id-ID')}
                        </td>
                      </tr>

                      <tr className="bg-slate-50 font-bold text-slate-900">
                        <td className="py-2.5 px-3">
                          2. Kenaikan / (Penurunan) Modal Bersih
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right tabular-nums ${
                            equityStatement.netChange >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {equityStatement.netChange >= 0 ? '+' : '-'} Rp {Math.abs(equityStatement.netChange).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-bold text-xs">
                        <td className="py-2.5 px-3 uppercase">
                          MODAL AKHIR PERIODE (TOTAL EKUITAS NERACA):
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          Rp {equityStatement.endingCapital.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KONTEN TAB 4: BUKU BESAR PER AKUN */}
        {activeTab === 'buku-besar' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Memuat data Buku Besar...
              </div>
            ) : !generalLedger ? (
              <div className="py-8 text-center text-slate-400 text-xs">Pilih akun untuk melihat buku besar.</div>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="text-slate-500 uppercase font-semibold text-[10px]">Akun Aktif</div>
                    <div className="text-sm font-bold text-slate-900">
                      [{generalLedger.account.code}] {generalLedger.account.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500 uppercase font-semibold text-[10px]">Saldo Awal Periode</div>
                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      Rp {generalLedger.openingBalance.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-100 font-semibold text-slate-700 text-[11px] uppercase border-b border-slate-300">
                        <th className="py-2.5 px-3 w-24">Tanggal</th>
                        <th className="py-2.5 px-3">Keterangan</th>
                        <th className="py-2.5 px-3 w-24">Petugas</th>
                        <th className="py-2.5 px-3 text-right w-28">Debit (Rp)</th>
                        <th className="py-2.5 px-3 text-right w-28">Kredit (Rp)</th>
                        <th className="py-2.5 px-3 text-right w-32">Saldo (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr className="bg-slate-50/80 font-medium text-slate-600">
                        <td className="py-2 px-3" colSpan={3}>
                          SALDO AWAL (SEBELUM {months[selectedMonth].toUpperCase()} {selectedYear})
                        </td>
                        <td className="py-2 px-3 text-right">-</td>
                        <td className="py-2 px-3 text-right">-</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                          Rp {generalLedger.openingBalance.toLocaleString('id-ID')}
                        </td>
                      </tr>

                      {generalLedger.entries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Tidak ada transaksi mutasi pada akun ini di periode terpilih.
                          </td>
                        </tr>
                      ) : (
                        generalLedger.entries.map((item) => {
                          const dateStr = new Intl.DateTimeFormat('id-ID', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          }).format(new Date(item.date));

                          return (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono">
                                {dateStr}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {item.description}
                              </td>
                              <td className="py-2 px-3 text-slate-500">
                                {item.creatorName}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-rose-700 tabular-nums">
                                {item.debit > 0 ? Number(item.debit).toLocaleString('id-ID') : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-emerald-700 tabular-nums">
                                {item.credit > 0 ? Number(item.credit).toLocaleString('id-ID') : '-'}
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums bg-slate-50/50">
                                Rp {Number(item.runningBalance).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                        <td colSpan={3} className="py-2.5 px-3 text-right uppercase">
                          Total & Saldo Akhir:
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-700 tabular-nums">
                          Rp {generalLedger.totalDebit.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-700 tabular-nums">
                          Rp {generalLedger.totalCredit.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-950 tabular-nums bg-slate-200">
                          Rp {generalLedger.closingBalance.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KONTEN TAB 5: LAPORAN ARUS KAS MANAJEMEN PROFESIONAL */}
        {activeTab === 'arus-kas' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Memuat data Laporan Arus Kas...
              </div>
            ) : !cashFlow ? (
              <div className="py-8 text-center text-slate-400 text-xs">Data tidak tersedia.</div>
            ) : (
              <div className="space-y-4">
                {/* 3 Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Saldo Awal Kas & Bank</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5 tabular-nums">
                      Rp {cashFlow.openingCashBalance.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase">Arus Kas Bersih Berjalan</div>
                    <div
                      className={`text-lg font-bold mt-0.5 tabular-nums ${
                        cashFlow.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {cashFlow.netCashFlow >= 0 ? '+' : '-'} Rp {Math.abs(cashFlow.netCashFlow).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 text-white rounded-xl">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase">Saldo Akhir Kas & Bank</div>
                    <div className="text-lg font-bold text-white mt-0.5 tabular-nums">
                      Rp {cashFlow.closingCashBalance.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>

                {/* Tabel Format Standar Manajemen 3 Pilar */}
                <div className="overflow-x-auto border border-slate-300 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs min-w-[550px]">
                    <thead>
                      <tr className="bg-slate-100 font-semibold text-slate-700 text-[11px] uppercase border-b border-slate-300">
                        <th className="py-2.5 px-3">Uraian / Aktivitas Arus Kas (SAK EMKM)</th>
                        <th className="py-2.5 px-3 text-right w-44">Jumlah (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {/* 1. AKTIVITAS OPERASI */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900 text-[11px] uppercase">
                        <td colSpan={2} className="py-2 px-3">
                          A. ARUS KAS DARI AKTIVITAS OPERASI
                        </td>
                      </tr>
                      {/* Penerimaan Operasi */}
                      {cashFlow.operatingActivities?.inflows?.length > 0 ? (
                        cashFlow.operatingActivities.inflows.map((item, idx) => (
                          <tr key={`op-in-${idx}`} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 pl-6 text-slate-800">
                              + Penerimaan dari [{item.code}] {item.name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-emerald-700 tabular-nums">
                              Rp {item.amount.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-1.5 px-3 pl-6 text-slate-400 italic">Tidak ada penerimaan operasi</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">Rp 0</td>
                        </tr>
                      )}
                      {/* Pengeluaran Operasi */}
                      {cashFlow.operatingActivities?.outflows?.length > 0 ? (
                        cashFlow.operatingActivities.outflows.map((item, idx) => (
                          <tr key={`op-out-${idx}`} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 pl-6 text-slate-800">
                              - Pembayaran [{item.code}] {item.name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-rose-700 tabular-nums">
                              (Rp {item.amount.toLocaleString('id-ID')})
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-1.5 px-3 pl-6 text-slate-400 italic">Tidak ada pengeluaran operasi</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">Rp 0</td>
                        </tr>
                      )}
                      <tr className="bg-slate-50 font-bold text-slate-900 border-b border-slate-300">
                        <td className="py-2 px-3 text-right">
                          Arus Kas Bersih dari Aktivitas Operasi (A):
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            (cashFlow.operatingActivities?.netAmount || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {(cashFlow.operatingActivities?.netAmount || 0) >= 0 ? '+' : '-'} Rp {Math.abs(cashFlow.operatingActivities?.netAmount || 0).toLocaleString('id-ID')}
                        </td>
                      </tr>

                      {/* 2. AKTIVITAS INVESTASI */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900 text-[11px] uppercase">
                        <td colSpan={2} className="py-2 px-3">
                          B. ARUS KAS DARI AKTIVITAS INVESTASI
                        </td>
                      </tr>
                      {cashFlow.investingActivities?.outflows?.length > 0 ? (
                        cashFlow.investingActivities.outflows.map((item, idx) => (
                          <tr key={`inv-out-${idx}`} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 pl-6 text-slate-800">
                              - Pembelian [{item.code}] {item.name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-rose-700 tabular-nums">
                              (Rp {item.amount.toLocaleString('id-ID')})
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-1.5 px-3 pl-6 text-slate-400 italic">Tidak ada pengeluaran investasi</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">Rp 0</td>
                        </tr>
                      )}
                      <tr className="bg-slate-50 font-bold text-slate-900 border-b border-slate-300">
                        <td className="py-2 px-3 text-right">
                          Arus Kas Bersih dari Aktivitas Investasi (B):
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            (cashFlow.investingActivities?.netAmount || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {(cashFlow.investingActivities?.netAmount || 0) >= 0 ? '+' : '-'} Rp {Math.abs(cashFlow.investingActivities?.netAmount || 0).toLocaleString('id-ID')}
                        </td>
                      </tr>

                      {/* 3. AKTIVITAS PENDANAAN */}
                      <tr className="bg-slate-100/90 font-bold text-slate-900 text-[11px] uppercase">
                        <td colSpan={2} className="py-2 px-3">
                          C. ARUS KAS DARI AKTIVITAS PENDANAAN
                        </td>
                      </tr>
                      {cashFlow.financingActivities?.inflows?.length > 0 && (
                        cashFlow.financingActivities.inflows.map((item, idx) => (
                          <tr key={`fin-in-${idx}`} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 pl-6 text-slate-800">
                              + Penerimaan [{item.code}] {item.name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-emerald-700 tabular-nums">
                              Rp {item.amount.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                      {cashFlow.financingActivities?.outflows?.length > 0 && (
                        cashFlow.financingActivities.outflows.map((item, idx) => (
                          <tr key={`fin-out-${idx}`} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 pl-6 text-slate-800">
                              - Penarikan Bagi Hasil / PADes [{item.code}] {item.name}
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium text-rose-700 tabular-nums">
                              (Rp {item.amount.toLocaleString('id-ID')})
                            </td>
                          </tr>
                        ))
                      )}
                      {(!cashFlow.financingActivities?.inflows?.length && !cashFlow.financingActivities?.outflows?.length) && (
                        <tr>
                          <td className="py-1.5 px-3 pl-6 text-slate-400 italic">Tidak ada transaksi pendanaan</td>
                          <td className="py-1.5 px-3 text-right text-slate-400">Rp 0</td>
                        </tr>
                      )}
                      <tr className="bg-slate-50 font-bold text-slate-900 border-b border-slate-300">
                        <td className="py-2 px-3 text-right">
                          Arus Kas Bersih dari Aktivitas Pendanaan (C):
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            (cashFlow.financingActivities?.netAmount || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {(cashFlow.financingActivities?.netAmount || 0) >= 0 ? '+' : '-'} Rp {Math.abs(cashFlow.financingActivities?.netAmount || 0).toLocaleString('id-ID')}
                        </td>
                      </tr>

                      {/* 4. REKONSILIASI KAS AKHIR */}
                      <tr className="bg-slate-100 font-bold text-slate-900">
                        <td className="py-2 px-3">
                          Kenaikan / (Penurunan) Kas Bersih Periode Berjalan (A + B + C)
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${
                            cashFlow.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {cashFlow.netCashFlow >= 0 ? '+' : '-'} Rp {Math.abs(cashFlow.netCashFlow).toLocaleString('id-ID')}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-700">
                          Saldo Kas & Setara Kas Awal Per 1 {months[selectedMonth]} {selectedYear}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900 tabular-nums">
                          Rp {cashFlow.openingCashBalance.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-bold text-xs">
                        <td className="py-2.5 px-3 uppercase">
                          SALDO KAS & BANK AKHIR PERIODE (TOTAL AKTIVA KAS NERACA):
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          Rp {cashFlow.closingCashBalance.toLocaleString('id-ID')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Kolom Tanda Tangan Resmi Desa */}
        <div className="mt-10 pt-5 grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-6 text-center text-xs font-medium text-slate-900 border-t border-slate-300">
          <div>
            <p className="text-slate-500">Mengetahui,</p>
            <p className="font-bold mt-0.5">Kepala Desa Bogem</p>
            <div className="h-16 sm:h-20" />
            <p className="border-t border-slate-900 inline-block px-6 pt-1 font-semibold">
              ( ......................................... )
            </p>
          </div>

          <div>
            <p className="text-slate-500">Disetujui Oleh,</p>
            <p className="font-bold mt-0.5">Ketua BUMDes Bogem</p>
            <div className="h-16 sm:h-20" />
            <p className="border-t border-slate-900 inline-block px-6 pt-1 font-semibold">
              ( ......................................... )
            </p>
          </div>

          <div>
            <p className="text-slate-500">Dibuat Oleh,</p>
            <p className="font-bold mt-0.5">Bendahara Catering</p>
            <div className="h-16 sm:h-20" />
            <p className="border-t border-slate-900 inline-block px-6 pt-1 font-semibold">
              ( ......................................... )
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
