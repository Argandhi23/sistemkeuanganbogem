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

interface UnitAccountConfig {
  PEMASUKAN: {
    primaryCodes: string[];
    secondaryCodes?: string[];
  };
  PENGELUARAN: {
    primaryCodes: string[];
    secondaryCodes?: string[];
    assetCodes?: string[];
  };
}

const UNIT_ACCOUNTS_CONFIG: Record<string, UnitAccountConfig> = {
  RENTAL_MOLEN: {
    PEMASUKAN: {
      primaryCodes: ['4010'], // Pendapatan Sewa Mesin Molen
      secondaryCodes: ['4004', '4002'], // Ongkir Pengantaran Molen, Pendapatan Usaha Lain-lain
    },
    PENGELUARAN: {
      primaryCodes: ['5011', '5012'], // Pemeliharaan, Oli & Sparepart Molen, BBM / Solar Mesin Molen
      secondaryCodes: ['5005', '5007'], // Transportasi & Bensin Pengantaran, Beban Operasional Lain-lain
      assetCodes: ['1201'], // Aset Peralatan & Mesin Molen
    },
  },
  WIFI_DESA: {
    PEMASUKAN: {
      primaryCodes: ['4020'], // Pendapatan Retribusi / Iuran WiFi Balai Desa
      secondaryCodes: ['4002'], // Pendapatan Lain-lain (misal pasang baru / voucher)
    },
    PENGELUARAN: {
      primaryCodes: ['5021', '5022'], // Langganan Bandwidth & ISP, Pemeliharaan Jaringan & Kabel WiFi
      secondaryCodes: ['5005', '5007'], // Transportasi & Bensin Teknisi, Beban Operasional Lain-lain
      assetCodes: ['1202'], // Aset Jaringan & Router WiFi Desa
    },
  },
  PPOB: {
    PEMASUKAN: {
      primaryCodes: ['4030'], // Pendapatan Margin & Admin Fee PPOB
      secondaryCodes: ['4002'], // Pendapatan Lain-lain
    },
    PENGELUARAN: {
      primaryCodes: ['5031'], // Beban Operasional & Kertas Struk PPOB
      secondaryCodes: ['6001', '5007'], // Biaya Admin Bank / Top Up Saldo, Beban Operasional Lain-lain
    },
  },
  CATERING: {
    PEMASUKAN: {
      primaryCodes: ['4001', '4003'], // Pendapatan Catering, Sewa Alat Catering
      secondaryCodes: ['4004', '4002'], // Ongkir Pengantaran, Pendapatan Usaha Lain-lain
    },
    PENGELUARAN: {
      primaryCodes: ['5001', '5002', '5003', '5004', '1004', '1005'], // Bahan Baku, Box Snack, Upah Masak, Gas Elpiji Dapur, Persediaan, Perlengkapan
      secondaryCodes: ['5051', '5052', '5005', '5007', '5006'], // Operasional Kantor Khusus Catering (ATK, Transport, Listrik, Beban Kantor)
    },
  },
  KETAHANAN_PANGAN: {
    PEMASUKAN: {
      primaryCodes: ['4040'], // Pendapatan Penjualan Ternak Sapi
      secondaryCodes: ['4002', '3003'], // Penjualan Pupuk/Kotoran Sapi, Penyertaan Modal Ketahanan Pangan
    },
    PENGELUARAN: {
      primaryCodes: ['5041', '5042', '5043'], // Pakan Rumput/Konsentrat, Vaksin/Obat/Dokter, Pemeliharaan Kandang & Upah
      secondaryCodes: ['5005', '5007'], // Transportasi Pakan, Beban Operasional Lain-lain
      assetCodes: ['1203'], // Aset Biologis (Ternak Sapi)
    },
  },
  UMUM: {
    PEMASUKAN: {
      primaryCodes: ['4002', '4004', '4101'], // Pendapatan Lain-lain, Ongkir, Bunga Bank
      secondaryCodes: ['3001', '3002', '2001', '2002'], // Modal Usaha, Laba Ditahan, Utang Usaha, Pinjaman
    },
    PENGELUARAN: {
      primaryCodes: ['5005', '5006', '5007', '5008', '5009', '5010'], // Transport Kantor, Listrik/Air Kantor, Operasional Lain, Diskon, Promosi, Kebersihan
      secondaryCodes: ['6001', '6002', '2001', '2002', '3004'], // Admin Bank, Bunga Pinjaman, Utang Usaha, Bagi Hasil PADes
    },
  },
};

function TambahTransaksiForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const isCateringRole = session?.user?.role === 'CATERING';

  // Deteksi jika dibuka dari unit usaha tertentu vs dari Beranda (Role CATERING dikunci mutlak ke CATERING)
  const queryUnit = isCateringRole ? 'CATERING' : (searchParams.get('businessUnit') || searchParams.get('unit'));
  const isUnitLocked = isCateringRole || Boolean(searchParams.get('businessUnit') || searchParams.get('unit'));
  const initialUnit = isCateringRole ? 'CATERING' : (queryUnit || 'CATERING');
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

  const getAccountGroups = (
    trxType: 'PEMASUKAN' | 'PENGELUARAN',
    unit: string,
    accList: AccountItem[]
  ) => {
    const unitLabel = getUnitLabel(unit);
    const cfg = UNIT_ACCOUNTS_CONFIG[unit] || UNIT_ACCOUNTS_CONFIG.UMUM;

    const nonCash = accList.filter(
      (a) => a.code !== '1001' && a.code !== '1002' && a.code !== '101' && a.code !== '102'
    );

    if (trxType === 'PEMASUKAN') {
      const primary = nonCash.filter((a) => cfg.PEMASUKAN.primaryCodes.includes(a.code));
      const secondary = nonCash.filter((a) => cfg.PEMASUKAN.secondaryCodes?.includes(a.code));
      const custom = nonCash.filter(
        (a) =>
          a.businessUnit === unit &&
          a.category === 'PENDAPATAN' &&
          !cfg.PEMASUKAN.primaryCodes.includes(a.code) &&
          !cfg.PEMASUKAN.secondaryCodes?.includes(a.code)
      );

      return [
        {
          label: unit !== 'UMUM' ? `Pendapatan Utama - ${unitLabel}` : 'Pendapatan Operasional Kantor',
          accounts: [...primary, ...custom],
        },
        {
          label: 'Pendapatan Lain & Penunjang',
          accounts: secondary,
        },
      ].filter((g) => g.accounts.length > 0);
    } else {
      const primary = nonCash.filter((a) => cfg.PENGELUARAN.primaryCodes.includes(a.code));
      const secondary = nonCash.filter((a) => cfg.PENGELUARAN.secondaryCodes?.includes(a.code));
      const asset = nonCash.filter((a) => cfg.PENGELUARAN.assetCodes?.includes(a.code));
      const custom = nonCash.filter(
        (a) =>
          a.businessUnit === unit &&
          a.category === 'BEBAN_OPERASIONAL' &&
          !cfg.PENGELUARAN.primaryCodes.includes(a.code) &&
          !cfg.PENGELUARAN.secondaryCodes?.includes(a.code)
      );

      if (unit === 'CATERING') {
        const customKitchen = nonCash.filter(
          (a) =>
            a.businessUnit === 'CATERING' &&
            a.category === 'BEBAN_OPERASIONAL' &&
            !a.code.startsWith('505') &&
            !cfg.PENGELUARAN.primaryCodes.includes(a.code) &&
            !cfg.PENGELUARAN.secondaryCodes?.includes(a.code)
        );
        const customOffice = nonCash.filter(
          (a) =>
            a.businessUnit === 'CATERING' &&
            a.category === 'BEBAN_OPERASIONAL' &&
            a.code.startsWith('505') &&
            !cfg.PENGELUARAN.secondaryCodes?.includes(a.code)
        );

        return [
          {
            label: 'Biaya Pokok Dapur & Masak (Bahan, Kemasan Box, Upah Masak, Gas)',
            accounts: [...primary, ...customKitchen],
          },
          {
            label: 'Operasional Kantor Khusus Catering (ATK, Komunikasi, Kebersihan, Transport)',
            accounts: [...secondary, ...customOffice],
          },
        ].filter((g) => g.accounts.length > 0);
      }

      return [
        {
          label: unit !== 'UMUM' ? `Biaya Pokok & Operasional Utama - ${unitLabel}` : 'Beban Operasional Kantor',
          accounts: [...primary, ...custom],
        },
        {
          label: 'Beban Penunjang & Operasional',
          accounts: secondary,
        },
        {
          label: `Pengadaan Aset ${unitLabel}`,
          accounts: asset,
        },
      ].filter((g) => g.accounts.length > 0);
    }
  };

  const getPreferredAccount = (
    groups: Array<{ label: string; accounts: AccountItem[] }>
  ) => {
    if (groups.length > 0 && groups[0].accounts.length > 0) {
      return groups[0].accounts[0].id;
    }
    return '';
  };

  const applyInitialAccount = (
    trxType: 'PEMASUKAN' | 'PENGELUARAN',
    unit: string,
    accList: AccountItem[]
  ) => {
    const groups = getAccountGroups(trxType, unit, accList);
    const pref = getPreferredAccount(groups);
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

  const accountGroups = getAccountGroups(type, businessUnit, accounts);

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
