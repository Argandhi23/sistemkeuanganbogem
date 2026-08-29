'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Save,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { SuccessFeedback } from '@/components/ui/SuccessFeedback';

interface AccountItem {
  id: string;
  code: string;
  name: string;
  category: string;
}

let clientAccountsCache: AccountItem[] | null = null;

function TambahTransaksiForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const initialType = searchParams.get('type') === 'PENGELUARAN' ? 'PENGELUARAN' : 'PEMASUKAN';

  const isSubmittingRef = useRef(false);
  const [type, setType] = useState<'PEMASUKAN' | 'PENGELUARAN'>(initialType);
  const [accounts, setAccounts] = useState<AccountItem[]>(() => clientAccountsCache || []);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    if (clientAccountsCache && clientAccountsCache.length > 0) {
      const filtered = clientAccountsCache.filter((a) =>
        initialType === 'PEMASUKAN'
          ? a.category === 'PENDAPATAN'
          : a.category === 'BEBAN_OPERASIONAL' || a.category === 'BEBAN_NON_OPERASIONAL'
      );
      return filtered.length > 0 ? filtered[0].id : clientAccountsCache[0].id;
    }
    return '';
  });
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const getValidAccountsForType = (trxType: 'PEMASUKAN' | 'PENGELUARAN', accList: AccountItem[]) => {
    // Saring keluar akun kas/bank karena kas/bank adalah akun penampung mutasi kas itu sendiri
    const nonCash = accList.filter(
      (a) => a.code !== '1001' && a.code !== '1002' && a.code !== '101' && a.code !== '102'
    );

    if (trxType === 'PEMASUKAN') {
      return nonCash.filter(
        (a) =>
          a.category === 'PENDAPATAN' ||
          a.category === 'MODAL' ||
          a.category === 'KEWAJIBAN' ||
          a.code === '1003'
      );
    } else {
      return nonCash.filter(
        (a) =>
          a.category === 'BEBAN_OPERASIONAL' ||
          a.category === 'BEBAN_NON_OPERASIONAL' ||
          a.code === '1004' || // Persediaan Bahan Baku
          a.code === '1005' || // Perlengkapan Usaha & Kemasan
          a.code === '1201' || // Peralatan & Mesin Catering (Aset Tetap)
          a.code.startsWith('12') ||
          a.category === 'KEWAJIBAN' ||
          a.category === 'MODAL'
      );
    }
  };

  useEffect(() => {
    if (clientAccountsCache && clientAccountsCache.length > 0) {
      return;
    }
    fetch('/api/accounts')
      .then((res) => res.json())
      .then((json) => {
        const list: AccountItem[] = json.data || [];
        clientAccountsCache = list;
        setAccounts(list);

        const validAccounts = getValidAccountsForType(initialType, list);
        if (validAccounts.length > 0) {
          // Default ke Pendapatan Catering (4001) atau Bahan Baku (5001) jika ada
          const preferred =
            initialType === 'PEMASUKAN'
              ? validAccounts.find((a) => a.code === '4001') || validAccounts[0]
              : validAccounts.find((a) => a.code === '5001') || validAccounts[0];
          setSelectedAccountId(preferred.id);
        }
      })
      .catch((err) => console.error('Error fetching accounts:', err));
  }, [initialType]);

  const handleTypeChange = (newType: 'PEMASUKAN' | 'PENGELUARAN') => {
    setType(newType);
    const valid = getValidAccountsForType(newType, accounts);
    if (valid.length > 0) {
      const preferred =
        newType === 'PEMASUKAN'
          ? valid.find((a) => a.code === '4001') || valid[0]
          : valid.find((a) => a.code === '5001') || valid[0];
      setSelectedAccountId(preferred.id);
    }
  };

  const filteredAccounts = getValidAccountsForType(type, accounts);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    setError(null);

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    const categoryName = selectedAccount?.name || (type === 'PEMASUKAN' ? 'Pendapatan Lain-lain' : 'Beban Lain-lain');

    if (!amount || amount <= 0) {
      setError('Nominal uang harus lebih besar dari Rp 0');
      return;
    }

    if (!description.trim()) {
      setError('Keterangan transaksi wajib diisi');
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const res = await fetch('/api/transaksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          category: categoryName,
          accountId: selectedAccountId || null,
          description: description.trim(),
          amount,
          date,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setIsSuccess(true);
      } else {
        setError(json.error || 'Gagal menyimpan transaksi');
      }
    } catch {
      setError('Terjadi kesalahan jaringan saat menyimpan data');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  if (isSuccess) {
    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <PageHeader
          title="Catat Transaksi Kas"
          description="Pencatatan uang masuk atau keluar unit usaha catering BUMDes Bogem"
          backHref="/transaksi"
          backLabel="Kembali ke Buku Kas"
        />
        <SuccessFeedback
          title={type === 'PEMASUKAN' ? 'Uang Masuk Berhasil Dicatat' : 'Uang Keluar Berhasil Dicatat'}
          message="Data transaksi telah berhasil disimpan ke database dan disinkronkan ke Google Sheets."
          details={{
            type,
            amount,
            accountName: selectedAccount?.name || (type === 'PEMASUKAN' ? 'Pendapatan Catering' : 'Beban Operasional'),
            accountCode: selectedAccount?.code,
            date,
            description,
          }}
          primaryActionText="Catat Transaksi Baru"
          onSecondaryClick={() => {
            setIsSuccess(false);
            setAmount(0);
            setDescription('');
          }}
          secondaryActionText="Buka Buku Kas & Transaksi"
          secondaryActionHref="/transaksi"
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <PageHeader
        title="Catat Transaksi Kas"
        description="Pencatatan uang masuk atau keluar unit usaha catering BUMDes Bogem"
        backHref="/transaksi"
        backLabel="Kembali ke Buku Kas"
      />

      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-subtle">
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilihan Tipe: Uang Masuk vs Uang Keluar */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('PEMASUKAN')}
                className={`h-10 px-3 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors border ${
                  type === 'PEMASUKAN'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-subtle'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>+ Uang Masuk</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('PENGELUARAN')}
                className={`h-10 px-3 rounded-xl font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors border ${
                  type === 'PENGELUARAN'
                    ? 'bg-rose-600 border-rose-600 text-white shadow-subtle'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>- Uang Keluar</span>
              </button>
            </div>
          </div>

          {/* Nominal Uang */}
          <div>
            <label htmlFor="amount" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nominal Uang (Rp) <span className="text-rose-500">*</span>
            </label>
            <CurrencyInput
              id="amount"
              value={amount || ''}
              onChange={(val) => setAmount(val)}
              placeholder="0"
            />
          </div>

          {/* Akun Akuntansi / Pos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="account" className="block text-xs font-semibold text-slate-700">
                Pos Akun Keuangan <span className="text-rose-500">*</span>
              </label>
              {isAdmin && (
                <a
                  href="/accounts"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  + Kelola Bagan Akun
                </a>
              )}
            </div>
            <select
              id="account"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            >
              {filteredAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  [{acc.code}] {acc.name} ({acc.category})
                </option>
              ))}
            </select>
          </div>

          {/* Tanggal Transaksi */}
          <div>
            <label htmlFor="date" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tanggal Transaksi <span className="text-rose-500">*</span>
            </label>
            <input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Keterangan */}
          <div>
            <label htmlFor="description" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Keterangan / Rincian <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Beli ayam potong 15kg dan beras untuk pesanan hajatan"
              className="w-full p-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Tombol Aksi Form */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <BigButton
              type="button"
              variant="secondary"
              size="normal"
              onClick={() => router.push('/transaksi')}
              disabled={isLoading}
            >
              Batal
            </BigButton>

            <BigButton
              type="submit"
              variant={type === 'PEMASUKAN' ? 'income' : 'expense'}
              size="normal"
              isLoading={isLoading}
              loadingText="Menyimpan..."
              icon={<Save className="w-4 h-4" />}
            >
              Simpan Transaksi
            </BigButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TambahTransaksiPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat formulir...</div>}>
      <TambahTransaksiForm />
    </Suspense>
  );
}
