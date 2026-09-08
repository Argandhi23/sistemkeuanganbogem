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
import { invalidateClientDashboardCache } from '@/lib/client-cache';
import { invalidateUnitLedgerCache } from '@/components/units/UnitCashLedger';

interface AccountItem {
  id: string;
  code: string;
  name: string;
  category: string;
  businessUnit: string;
}

let clientAccountsCache: AccountItem[] | null = null;

const getUnitLabel = (unit: string) => {
  switch (unit) {
    case 'CATERING':
      return 'Catering Desa';
    case 'RENTAL_MOLEN':
      return 'Sewa Molen';
    case 'WIFI_DESA':
      return 'WiFi Balai Desa';
    case 'PPOB':
      return 'PPOB';
    case 'KETAHANAN_PANGAN':
      return 'Peternakan Sapi';
    case 'UMUM':
      return 'Operasional Kantor / Umum';
    default:
      return unit;
  }
};

const getUnitRoute = (unit: string) => {
  switch (unit) {
    case 'CATERING':
      return '/units/catering';
    case 'RENTAL_MOLEN':
      return '/units/molen';
    case 'WIFI_DESA':
      return '/units/wifi';
    case 'PPOB':
      return '/units/ppob';
    case 'KETAHANAN_PANGAN':
      return '/units/sapi';
    default:
      return '/';
  }
};

function TambahTransaksiForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  // Deteksi jika dibuka dari unit usaha tertentu vs dari Beranda
  const queryUnit = searchParams.get('businessUnit') || searchParams.get('unit');
  const isUnitLocked = Boolean(queryUnit);
  const initialUnit = queryUnit || 'CATERING';
  const initialType = searchParams.get('type') === 'PENGELUARAN' ? 'PENGELUARAN' : 'PEMASUKAN';

  const isSubmittingRef = useRef(false);
  const [type, setType] = useState<'PEMASUKAN' | 'PENGELUARAN'>(initialType);
  const [businessUnit, setBusinessUnit] = useState<string>(initialUnit);
  const [accounts, setAccounts] = useState<AccountItem[]>(() => clientAccountsCache || []);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Saring akun berdasarkan Tipe Kas dan Unit Usaha yang dipilih
  const getValidAccountsForTypeAndUnit = (
    trxType: 'PEMASUKAN' | 'PENGELUARAN',
    unit: string,
    accList: AccountItem[]
  ) => {
    // Saring keluar akun kas/bank penampung
    const nonCash = accList.filter(
      (a) => a.code !== '1001' && a.code !== '1002' && a.code !== '101' && a.code !== '102'
    );

    if (trxType === 'PEMASUKAN') {
      return nonCash.filter((a) => {
        // 1. Akun pendapatan unit itu sendiri
        if (a.businessUnit === unit && (a.category === 'PENDAPATAN' || a.category === 'MODAL' || a.code.startsWith('40'))) {
          return true;
        }
        // 2. Akun pendapatan usaha lain & bunga bank umum yang bisa masuk ke unit
        if (['4002', '4101'].includes(a.code)) return true;
        // 3. Penerimaan modal & pinjaman
        if (['3001', '3002', '3003', '2001', '2002'].includes(a.code)) return true;
        // 4. Pelunasan piutang usaha
        if (a.code === '1003') return true;
        return false;
      });
    } else {
      return nonCash.filter((a) => {
        // 1. Beban & persediaan/aset milik unit itu sendiri
        if (a.businessUnit === unit) return true;
        // 2. Beban operasional umum penunjang yang dapat dikeluarkan oleh unit mana pun
        if (['5005', '5006', '5007', '5008', '5009', '5010', '6001', '6002', '2001', '2002', '3004'].includes(a.code)) {
          return true;
        }
        // 3. Aset peralatan umum jika pengadaan dilakukan oleh unit
        if (a.businessUnit === 'UMUM' && a.code.startsWith('12')) return true;
        return false;
      });
    }
  };

  const getAccountGroups = (
    trxType: 'PEMASUKAN' | 'PENGELUARAN',
    unit: string,
    accList: AccountItem[]
  ) => {
    const unitLabel = getUnitLabel(unit);

    if (trxType === 'PEMASUKAN') {
      // 1. Pendapatan Utama Unit Usaha
      const unitPendapatan = accList.filter(
        (a) => a.businessUnit === unit && (a.category === 'PENDAPATAN' || a.code.startsWith('40'))
      );
      // 2. Pendapatan Operasional Lain & Bunga Bank
      const nonOperasional = accList.filter(
        (a) =>
          !unitPendapatan.some((x) => x.id === a.id) &&
          (a.code === '4002' || a.code === '4101' || a.category === 'PENDAPATAN')
      );
      // 3. Penerimaan Modal & Pinjaman
      const modalDanUtang = accList.filter(
        (a) =>
          a.category === 'MODAL' ||
          a.category === 'KEWAJIBAN' ||
          a.code.startsWith('2') ||
          a.code.startsWith('3')
      );
      // 4. Pelunasan Piutang
      const piutang = accList.filter((a) => a.code === '1003' || a.category === 'ASET');

      return [
        {
          label: unit !== 'UMUM' ? `Pendapatan Utama - ${unitLabel}` : 'Pendapatan Usaha Utama',
          accounts: unitPendapatan.length > 0 ? unitPendapatan : accList.filter((a) => a.code.startsWith('40')),
        },
        {
          label: 'Pendapatan Operasional Lain & Bunga Bank',
          accounts: nonOperasional,
        },
        {
          label: 'Penerimaan Modal & Pinjaman',
          accounts: modalDanUtang,
        },
        {
          label: 'Pelunasan Piutang Usaha',
          accounts: piutang,
        },
      ].filter((g) => g.accounts.length > 0);
    } else {
      // 1. Biaya Pokok & Beban Utama Unit Usaha
      const unitBiaya = accList.filter(
        (a) =>
          a.businessUnit === unit &&
          (a.category === 'BEBAN_OPERASIONAL' ||
            a.code.startsWith('5') ||
            a.code === '1004' ||
            a.code === '1005')
      );
      // 2. Beban Operasional & Keperluan Usaha
      const operasionalUmum = accList.filter(
        (a) =>
          !unitBiaya.some((x) => x.id === a.id) &&
          ['5005', '5006', '5007', '5008', '5009', '5010'].includes(a.code)
      );
      // 3. Pengadaan Aset & Peralatan
      const asetTetap = accList.filter(
        (a) =>
          (a.code.startsWith('12') || (a.businessUnit === unit && a.category === 'ASET')) &&
          !unitBiaya.some((x) => x.id === a.id)
      );
      // 4. Pembayaran Utang & Beban Bank
      const utangDanNonOpex = accList.filter(
        (a) =>
          a.category === 'KEWAJIBAN' ||
          a.category === 'BEBAN_NON_OPERASIONAL' ||
          a.code.startsWith('2') ||
          a.code.startsWith('6') ||
          a.code === '3004'
      );

      return [
        {
          label: unit !== 'UMUM' ? `Biaya Pokok & Beban Utama - ${unitLabel}` : 'Beban Operasional Kantor',
          accounts: unitBiaya.length > 0 ? unitBiaya : operasionalUmum,
        },
        {
          label: 'Beban Operasional & Keperluan Usaha',
          accounts: unitBiaya.length > 0 ? operasionalUmum : [],
        },
        {
          label: 'Pengadaan Aset & Peralatan Usaha',
          accounts: asetTetap,
        },
        {
          label: 'Pembayaran Utang & Beban Bank',
          accounts: utangDanNonOpex,
        },
      ].filter((g) => g.accounts.length > 0);
    }
  };

  const getPreferredAccount = (
    trxType: 'PEMASUKAN' | 'PENGELUARAN',
    unit: string,
    groups: Array<{ label: string; accounts: AccountItem[] }>
  ) => {
    if (groups.length === 0) return '';
    // Prioritaskan akun milik unit di grup pertama
    const unitMatch = groups[0].accounts.find((a) => a.businessUnit === unit);
    if (unitMatch) return unitMatch.id;
    return groups[0].accounts[0]?.id || '';
  };

  const applyInitialAccount = (
    trxType: 'PEMASUKAN' | 'PENGELUARAN',
    unit: string,
    accList: AccountItem[]
  ) => {
    const valid = getValidAccountsForTypeAndUnit(trxType, unit, accList);
    const groups = getAccountGroups(trxType, unit, valid);
    const pref = getPreferredAccount(trxType, unit, groups);
    setSelectedAccountId(pref);
  };

  useEffect(() => {
    if (clientAccountsCache && clientAccountsCache.length > 0) {
      applyInitialAccount(type, businessUnit, clientAccountsCache);
      return;
    }
    fetch('/api/accounts')
      .then((res) => res.json())
      .then((json) => {
        const list: AccountItem[] = json.data || [];
        clientAccountsCache = list;
        setAccounts(list);
        applyInitialAccount(initialType, initialUnit, list);
      })
      .catch((err) => console.error('Error fetching accounts:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTypeChange = (newType: 'PEMASUKAN' | 'PENGELUARAN') => {
    setType(newType);
    applyInitialAccount(newType, businessUnit, accounts);
  };

  const handleUnitChange = (newUnit: string) => {
    setBusinessUnit(newUnit);
    applyInitialAccount(type, newUnit, accounts);
  };

  const filteredAccounts = getValidAccountsForTypeAndUnit(type, businessUnit, accounts);
  const accountGroups = getAccountGroups(type, businessUnit, filteredAccounts);

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
          businessUnit,
          paymentMethod,
          accountId: selectedAccountId || null,
          description: description.trim(),
          amount,
          date,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        invalidateClientDashboardCache();
        invalidateUnitLedgerCache(businessUnit);
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

  const pageTitle = isUnitLocked
    ? `${type === 'PEMASUKAN' ? 'Uang Masuk' : 'Uang Keluar'} - ${getUnitLabel(businessUnit)}`
    : (type === 'PEMASUKAN' ? 'Catat Uang Masuk' : 'Catat Uang Keluar');

  const pageDesc = isUnitLocked
    ? `Pencatatan kas operasional unit ${getUnitLabel(businessUnit)}`
    : 'Pencatatan kas masuk dan kas keluar operasional BUMDes Bogem';

  const backHref = isUnitLocked ? getUnitRoute(businessUnit) : '/';
  const backLabel = isUnitLocked ? `Kembali ke ${getUnitLabel(businessUnit)}` : 'Kembali ke Beranda';

  if (isSuccess) {
    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <PageHeader
          title={pageTitle}
          description={pageDesc}
          backHref={backHref}
          backLabel={backLabel}
        />
        <SuccessFeedback
          title={type === 'PEMASUKAN' ? 'Uang Masuk Berhasil Dicatat' : 'Uang Keluar Berhasil Dicatat'}
          message="Data transaksi telah berhasil disimpan ke buku kas dan laporan keuangan."
          details={{
            type,
            amount,
            accountName: selectedAccount?.name || (type === 'PEMASUKAN' ? 'Pendapatan Usaha' : 'Beban Operasional'),
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
          secondaryActionText={isUnitLocked ? `Buka Buku Kas ${getUnitLabel(businessUnit)}` : 'Buka Seluruh Buku Kas'}
          secondaryActionHref={isUnitLocked ? getUnitRoute(businessUnit) : '/transaksi'}
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <PageHeader
        title={pageTitle}
        description={pageDesc}
        backHref={backHref}
        backLabel={backLabel}
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

          {/* Unit Usaha: Terkunci (jika dari unit usaha) atau Dropdown Bebas (jika dari Beranda) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Unit Usaha BUMDes
            </label>
            {isUnitLocked ? (
              <div className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  {getUnitLabel(businessUnit)}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  Unit Ini
                </span>
              </div>
            ) : (
              <select
                id="businessUnit"
                value={businessUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all cursor-pointer"
              >
                <option value="CATERING">Catering Desa</option>
                <option value="RENTAL_MOLEN">Sewa Molen</option>
                <option value="WIFI_DESA">WiFi Balai Desa</option>
                <option value="PPOB">PPOB</option>
                <option value="KETAHANAN_PANGAN">Peternakan Sapi</option>
                <option value="UMUM">Operasional Kantor / Umum</option>
              </select>
            )}
          </div>

          {/* Pos Akun Keuangan (Dengan Kode & Pilihan Lengkap Sesuai Unit) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="account" className="block text-xs font-semibold text-slate-700">
                Pos Akun Keuangan {isUnitLocked && <span className="text-slate-500 font-normal">({getUnitLabel(businessUnit)})</span>} <span className="text-rose-500">*</span>
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
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all cursor-pointer"
            >
              {accountGroups.map((group) => (
                <optgroup key={group.label} label={group.label} className="font-semibold text-slate-700">
                  {group.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} className="font-normal text-slate-900">
                      [{acc.code}] {acc.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Nominal Uang & Metode Pembayaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div>
              <label htmlFor="paymentMethod" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Metode Pembayaran
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'TUNAI' | 'TRANSFER')}
                className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all cursor-pointer"
              >
                <option value="TUNAI">Kas Tunai</option>
                <option value="TRANSFER">Transfer Bank / Non-Tunai</option>
              </select>
            </div>
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
              Keterangan Transaksi <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Penerimaan pembayaran jasa atau belanja perlengkapan operasional"
              className="w-full p-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Tombol Aksi Form */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <BigButton
              type="button"
              variant="secondary"
              size="normal"
              onClick={() => router.push(backHref)}
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
