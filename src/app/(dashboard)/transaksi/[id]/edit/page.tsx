'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Save,
  Trash2,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SuccessFeedback } from '@/components/ui/SuccessFeedback';

interface AccountItem {
  id: string;
  code: string;
  name: string;
  category: string;
}

let clientAccountsCache: AccountItem[] | null = null;

export default function EditTransaksiPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const currentUserId = session?.user?.id;

  const isSubmittingRef = useRef(false);
  const isDeletingRef = useRef(false);
  const [type, setType] = useState<'PEMASUKAN' | 'PENGELUARAN'>('PEMASUKAN');
  const [accounts, setAccounts] = useState<AccountItem[]>(() => clientAccountsCache || []);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [createdById, setCreatedById] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchAccountsPromise = clientAccountsCache
      ? Promise.resolve({ data: clientAccountsCache })
      : fetch('/api/accounts').then((r) => r.json());

    Promise.all([
      fetchAccountsPromise,
      fetch(`/api/transaksi/${id}`).then((r) => r.json()),
    ])
      .then(([accountsRes, trxRes]) => {
        const accList: AccountItem[] = accountsRes.data || [];
        clientAccountsCache = accList;
        setAccounts(accList);

        if (trxRes.data) {
          const trx = trxRes.data;
          setType(trx.type);
          setAmount(Number(trx.amount));
          setDate(new Date(trx.date).toISOString().split('T')[0]);
          setDescription(trx.description);
          setCreatedById(trx.createdById || '');

          if (trx.accountId) {
            setSelectedAccountId(trx.accountId);
          } else {
            const match = accList.find((a) => a.name === trx.category);
            if (match) {
              setSelectedAccountId(match.id);
            } else if (accList.length > 0) {
              setSelectedAccountId(accList[0].id);
            }
          }
        } else {
          setError('Data transaksi tidak ditemukan');
        }
      })
      .catch(() => setError('Gagal memuat data transaksi'))
      .finally(() => setIsFetching(false));
  }, [id]);

  const getValidAccountsForType = (trxType: 'PEMASUKAN' | 'PENGELUARAN', accList: AccountItem[]) => {
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

  const getAccountGroups = (trxType: 'PEMASUKAN' | 'PENGELUARAN', accList: AccountItem[]) => {
    if (trxType === 'PEMASUKAN') {
      const usaha = accList.filter(
        (a) => a.code.startsWith('40') || (a.category === 'PENDAPATAN' && !a.code.startsWith('41'))
      );
      const nonOperasional = accList.filter((a) => a.code.startsWith('41'));
      const modalDanUtang = accList.filter((a) => a.category === 'MODAL' || a.category === 'KEWAJIBAN');
      const piutang = accList.filter((a) => a.code === '1003' || a.category === 'ASET');

      return [
        { label: '🍱 Pendapatan Usaha & Layanan', accounts: usaha },
        { label: '🏦 Pendapatan Non-Operasional & Bunga Bank', accounts: nonOperasional },
        { label: '💰 Penerimaan Modal & Pinjaman', accounts: modalDanUtang },
        { label: '📋 Pelunasan Piutang Usaha', accounts: piutang },
      ].filter((g) => g.accounts.length > 0);
    } else {
      const hpp = accList.filter((a) =>
        ['5001', '5002', '5003', '5006', '1004', '1005'].includes(a.code)
      );
      const operasional = accList.filter(
        (a) =>
          ['5004', '5005', '5007', '5008', '5009', '5010'].includes(a.code) ||
          (a.category === 'BEBAN_OPERASIONAL' && !['5001', '5002', '5003', '5006'].includes(a.code))
      );
      const asetTetap = accList.filter((a) => a.code.startsWith('12') || a.code === '1201');
      const utang = accList.filter((a) => a.category === 'KEWAJIBAN' || a.code.startsWith('2'));
      const pades = accList.filter((a) => a.code === '3004' || a.category === 'MODAL');
      const nonOpex = accList.filter(
        (a) => a.category === 'BEBAN_NON_OPERASIONAL' || a.code.startsWith('6')
      );

      return [
        { label: '🛒 HPP & Belanja Dapur Langsung', accounts: hpp },
        { label: '🚚 Beban Operasional, Distribusi & Pemasaran', accounts: operasional },
        { label: '🍳 Belanja Modal / Pengadaan Alat (Aset Tetap)', accounts: asetTetap },
        { label: '💳 Pembayaran & Angsuran Utang', accounts: utang },
        { label: '🏛️ Penyaluran Bagi Hasil PADes ke Desa', accounts: pades },
        { label: '🏦 Beban Administrasi Bank & Non-Operasional', accounts: nonOpex },
      ].filter((g) => g.accounts.length > 0);
    }
  };

  const accountGroups = getAccountGroups(type, filteredAccounts);

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
      const res = await fetch(`/api/transaksi/${id}`, {
        method: 'PUT',
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
        setError(json.error || 'Gagal memperbarui transaksi');
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleDelete = async () => {
    if (isDeletingRef.current || isDeleting) return;

    try {
      isDeletingRef.current = true;
      setIsDeleting(true);
      const res = await fetch(`/api/transaksi/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/transaksi');
      } else {
        const err = await res.json();
        setError(err.error || 'Gagal menghapus data');
        setShowDeleteModal(false);
      }
    } catch {
      setError('Terjadi kesalahan saat menghapus data');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
      isDeletingRef.current = false;
    }
  };

  if (isFetching) {
    return (
      <div className="max-w-xl mx-auto p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
        Memuat data transaksi...
      </div>
    );
  }

  if (isSuccess) {
    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <PageHeader
          title="Edit Transaksi"
          description="Perbarui informasi uang masuk atau keluar unit catering"
          backHref="/transaksi"
          backLabel="Kembali ke Buku Kas"
        />
        <SuccessFeedback
          title="Perubahan Berhasil Disimpan"
          message="Catatan transaksi telah diperbarui di database dan disinkronkan ke Google Sheets."
          details={{
            type,
            amount,
            accountName: selectedAccount?.name,
            accountCode: selectedAccount?.code,
            date,
            description,
          }}
          primaryActionText="Edit Transaksi Lagi"
          onSecondaryClick={() => setIsSuccess(false)}
          secondaryActionText="Kembali ke Buku Kas"
          secondaryActionHref="/transaksi"
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <PageHeader
        title="Edit Transaksi"
        description="Perbarui informasi uang masuk atau keluar unit catering"
        backHref="/transaksi"
        backLabel="Kembali ke Buku Kas"
        action={
          (isAdmin || (createdById && createdById === currentUserId)) ? (
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="px-2.5 h-8 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-medium flex items-center gap-1 border border-rose-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          ) : undefined
        }
      />

      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-subtle">
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pilihan Tipe */}
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
              value={amount}
              onChange={(val) => setAmount(val)}
              placeholder="0"
            />
          </div>

          {/* Pos Akun Keuangan */}
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
              className="w-full p-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Tombol Simpan */}
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
              variant="primary"
              size="normal"
              isLoading={isLoading}
              loadingText="Menyimpan..."
              icon={<Save className="w-4 h-4" />}
            >
              Simpan Perubahan
            </BigButton>
          </div>
        </form>
      </div>

      {/* Modal Hapus */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Hapus Transaksi Ini?"
        message="Yakin ingin menghapus transaksi ini? Data akan dihapus dari database dan Google Sheets."
        confirmText="Hapus"
        cancelText="Batal"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
