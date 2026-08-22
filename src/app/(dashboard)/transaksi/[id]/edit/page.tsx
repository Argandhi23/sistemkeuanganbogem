'use client';

import React, { useState, useEffect } from 'react';
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

export default function EditTransaksiPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [type, setType] = useState<'PEMASUKAN' | 'PENGELUARAN'>('PEMASUKAN');
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
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
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch(`/api/transaksi/${id}`).then((r) => r.json()),
    ])
      .then(([accountsRes, trxRes]) => {
        const accList: AccountItem[] = accountsRes.data || [];
        setAccounts(accList);

        if (trxRes.data) {
          const trx = trxRes.data;
          setType(trx.type);
          setAmount(Number(trx.amount));
          setDate(new Date(trx.date).toISOString().split('T')[0]);
          setDescription(trx.description);

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

  const handleTypeChange = (newType: 'PEMASUKAN' | 'PENGELUARAN') => {
    setType(newType);
    const filtered = accounts.filter((a) =>
      newType === 'PEMASUKAN'
        ? a.category === 'PENDAPATAN' || a.category === 'MODAL' || a.category === 'ASET'
        : a.category === 'BEBAN_OPERASIONAL' || a.category === 'BEBAN_NON_OPERASIONAL' || a.category === 'ASET' || a.category === 'KEWAJIBAN'
    );
    if (filtered.length > 0) {
      setSelectedAccountId(filtered[0].id);
    }
  };

  const filteredAccounts = accounts.filter((a) =>
    type === 'PEMASUKAN'
      ? a.category === 'PENDAPATAN' || a.category === 'MODAL' || a.category === 'ASET'
      : a.category === 'BEBAN_OPERASIONAL' || a.category === 'BEBAN_NON_OPERASIONAL' || a.category === 'ASET' || a.category === 'KEWAJIBAN'
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    }
  };

  const handleDelete = async () => {
    try {
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
    return (
      <SuccessFeedback
        title="Perubahan Disimpan"
        message="Catatan transaksi telah diperbarui di database dan Google Sheets."
        primaryActionText="Kembali ke Buku Kas"
        primaryActionHref="/transaksi"
      />
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
          isAdmin ? (
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
