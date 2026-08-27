'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { BigButton } from '@/components/ui/BigButton';

type AccountCategory =
  | 'ASET'
  | 'KEWAJIBAN'
  | 'MODAL'
  | 'PENDAPATAN'
  | 'BEBAN_OPERASIONAL'
  | 'BEBAN_NON_OPERASIONAL';

interface AccountItem {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  isActive: boolean;
  _count?: {
    transactions: number;
  };
}

const CATEGORY_METADATA: Record<
  AccountCategory,
  { label: string; prefix: string; bg: string; text: string; border: string; desc: string }
> = {
  ASET: {
    label: 'Aset (Aktiva)',
    prefix: '1xxx',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    desc: 'Kas tunai, bank/rekening, piutang usaha, persediaan bahan baku, dan peralatan catering.',
  },
  KEWAJIBAN: {
    label: 'Kewajiban (Utang)',
    prefix: '2xxx',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    desc: 'Utang usaha, utang supplier belanja bahan, dan kewajiban operasional.',
  },
  MODAL: {
    label: 'Ekuitas (Modal)',
    prefix: '3xxx',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    desc: 'Penyertaan modal awal desa (APBDes), laba ditahan, dan cadangan ekuitas unit usaha.',
  },
  PENDAPATAN: {
    label: 'Pendapatan Usaha',
    prefix: '4xxx',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    desc: 'Penjualan catering harian, box, prasmanan, snack, dan pendapatan usaha lain.',
  },
  BEBAN_OPERASIONAL: {
    label: 'Beban Operasional',
    prefix: '5xxx',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    desc: 'Bahan baku makanan, upah tenaga masak, kemasan, transportasi, gas elpiji & listrik.',
  },
  BEBAN_NON_OPERASIONAL: {
    label: 'Beban Non-Operasional',
    prefix: '6xxx',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-300',
    desc: 'Biaya administrasi bank, transfer, dan beban non-operasional lainnya.',
  },
};

export default function AccountsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('SEMUA');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    category: AccountCategory;
    isActive: boolean;
  }>({
    code: '',
    name: '',
    category: 'PENDAPATAN',
    isActive: true,
  });

  const isSubmittingRef = useRef(false);
  const isDeletingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Delete Confirm Modal State
  const [deleteConfirmAccount, setDeleteConfirmAccount] = useState<AccountItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/accounts?all=true');
      if (res.ok) {
        const json = await res.json();
        setAccounts(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Open Create Modal
  const handleOpenCreate = (prefillCategory?: AccountCategory) => {
    const cat = prefillCategory || (selectedCategory !== 'SEMUA' ? (selectedCategory as AccountCategory) : 'PENDAPATAN');
    setFormData({
      code: '',
      name: '',
      category: cat,
      isActive: true,
    });
    setIsEditing(false);
    setEditingId(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (acc: AccountItem) => {
    setFormData({
      code: acc.code,
      name: acc.name,
      category: acc.category,
      isActive: acc.isActive,
    });
    setIsEditing(true);
    setEditingId(acc.id);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle Form Submit (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    setFormError(null);

    if (!formData.code.trim()) {
      setFormError('Kode akun wajib diisi');
      return;
    }
    if (!formData.name.trim()) {
      setFormError('Nama pos akun wajib diisi');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);
      const url = isEditing && editingId ? `/api/accounts/${editingId}` : '/api/accounts';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: formData.code.trim(),
          name: formData.name.trim(),
          category: formData.category,
          isActive: formData.isActive,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setIsModalOpen(false);
        showFeedback('success', json.message || 'Kode akun berhasil disimpan');
        fetchAccounts();
      } else {
        setFormError(json.error || 'Gagal menyimpan akun');
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle Delete / Deactivate
  const handleDelete = async () => {
    if (!deleteConfirmAccount || isDeletingRef.current || isDeleting) return;

    try {
      isDeletingRef.current = true;
      setIsDeleting(true);
      const res = await fetch(`/api/accounts/${deleteConfirmAccount.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (res.ok) {
        setDeleteConfirmAccount(null);
        showFeedback('success', json.message || 'Akun berhasil dihapus');
        fetchAccounts();
      } else {
        showFeedback('error', json.error || 'Gagal menghapus akun');
      }
    } catch {
      showFeedback('error', 'Terjadi kesalahan jaringan');
    } finally {
      setIsDeleting(false);
      isDeletingRef.current = false;
    }
  };

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchCat = selectedCategory === 'SEMUA' || acc.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [accounts, selectedCategory, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = accounts.length;
    const aset = accounts.filter((a) => a.category === 'ASET').length;
    const kewajiban = accounts.filter((a) => a.category === 'KEWAJIBAN').length;
    const modal = accounts.filter((a) => a.category === 'MODAL').length;
    const pendapatan = accounts.filter((a) => a.category === 'PENDAPATAN').length;
    const beban = accounts.filter(
      (a) => a.category === 'BEBAN_OPERASIONAL' || a.category === 'BEBAN_NON_OPERASIONAL'
    ).length;

    return { total, aset, kewajiban, modal, pendapatan, beban };
  }, [accounts]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Master Kode Akun Keuangan"
        description="Bagan Akun Standar (Chart of Accounts / SAK EMKM) Unit Usaha Catering BUMDes Bogem"
        action={
          isAdmin && (
            <BigButton
              variant="primary"
              size="normal"
              onClick={() => handleOpenCreate()}
              icon={<Plus className="w-4 h-4" />}
            >
              Tambah Kode Akun
            </BigButton>
          )
        }
      />

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setSelectedCategory('SEMUA')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            selectedCategory === 'SEMUA'
              ? 'bg-slate-900 text-white border-slate-900 shadow-subtle'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>Semua Akun</span>
            <Layers className="w-3.5 h-3.5 opacity-70" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums">{stats.total}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('ASET')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            selectedCategory === 'ASET'
              ? 'bg-blue-600 text-white border-blue-600 shadow-subtle'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>[1xxx] Aset</span>
            <Scale className="w-3.5 h-3.5 opacity-70" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums">{stats.aset}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('KEWAJIBAN')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            selectedCategory === 'KEWAJIBAN'
              ? 'bg-amber-600 text-white border-amber-600 shadow-subtle'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>[2xxx] Utang</span>
            <TrendingDown className="w-3.5 h-3.5 opacity-70" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums">{stats.kewajiban}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('MODAL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            selectedCategory === 'MODAL'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-subtle'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>[3xxx] Modal</span>
            <ShieldCheck className="w-3.5 h-3.5 opacity-70" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums">{stats.modal}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('PENDAPATAN')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            selectedCategory === 'PENDAPATAN'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-subtle'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>[4xxx] Pendapatan</span>
            <TrendingUp className="w-3.5 h-3.5 opacity-70" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums">{stats.pendapatan}</div>
        </div>

        <div
          onClick={() => setSelectedCategory('BEBAN_OPERASIONAL')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            selectedCategory === 'BEBAN_OPERASIONAL' || selectedCategory === 'BEBAN_NON_OPERASIONAL'
              ? 'bg-rose-600 text-white border-rose-600 shadow-subtle'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>[5xxx] Beban</span>
            <BookOpen className="w-3.5 h-3.5 opacity-70" />
          </div>
          <div className="text-xl font-bold mt-1.5 tabular-nums">{stats.beban}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-subtle space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode atau nama pos akun..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('SEMUA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === 'SEMUA'
                  ? 'bg-slate-900 text-white shadow-subtle'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Kategori
            </button>
            {(Object.keys(CATEGORY_METADATA) as AccountCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-subtle'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {CATEGORY_METADATA[cat].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table of Accounts */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Memuat daftar kode akun...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Tidak ada kode akun yang sesuai filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Kode Akun</th>
                  <th className="py-3 px-4">Nama Pos Akun Keuangan</th>
                  <th className="py-3 px-4 w-44">Kategori SAK EMKM</th>
                  <th className="py-3 px-4 text-center w-28">Riwayat Trx</th>
                  <th className="py-3 px-4 text-center w-24">Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right w-24">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => {
                  const meta = CATEGORY_METADATA[acc.category] || CATEGORY_METADATA.PENDAPATAN;
                  const trxCount = acc._count?.transactions ?? 0;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {acc.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {acc.name}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums text-slate-600 font-medium">
                        {trxCount > 0 ? (
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full font-semibold">
                            {trxCount} transaksi
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Belum ada</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            acc.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {acc.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(acc)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Kode Akun"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmAccount(acc)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus / Nonaktifkan Akun"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Akun */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Ubah Kode Akun Keuangan' : 'Tambah Kode Akun Keuangan'}
                </h3>
                <p className="text-xs text-slate-500">
                  Pos akun standar akuntansi BUMDes Bogem (SAK EMKM)
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Kategori Akun */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Kategori Akun <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as AccountCategory })
                  }
                  className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  {(Object.keys(CATEGORY_METADATA) as AccountCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      [{CATEGORY_METADATA[cat].prefix}] {CATEGORY_METADATA[cat].label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {CATEGORY_METADATA[formData.category].desc}
                </p>
              </div>

              {/* Kode Akun */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kode Akun (Nomor) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Rekomendasi prefix: {CATEGORY_METADATA[formData.category].prefix}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder={`Contoh: ${CATEGORY_METADATA[formData.category].prefix.replace('xxx', '001')}`}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.replace(/\s+/g, '') })}
                  className="w-full h-10 px-3 text-xs sm:text-sm font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              {/* Nama Pos Akun */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama Pos Akun Keuangan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beban Bahan Baku Makanan (Beras & Daging)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              {/* Status Aktif */}
              {isEditing && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 select-none">
                    Status Akun Aktif (Dapat dipilih saat input transaksi)
                  </label>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <BigButton
                  type="button"
                  variant="secondary"
                  size="normal"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </BigButton>
                <BigButton
                  type="submit"
                  variant="primary"
                  size="normal"
                  isLoading={isSubmitting}
                  loadingText="Menyimpan..."
                >
                  {isEditing ? 'Simpan Perubahan' : 'Tambah Akun'}
                </BigButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus / Nonaktifkan */}
      {deleteConfirmAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Hapus / Nonaktifkan Kode Akun?
                </h3>
                <p className="text-xs text-slate-500">
                  [{deleteConfirmAccount.code}] {deleteConfirmAccount.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {(deleteConfirmAccount._count?.transactions ?? 0) > 0 ? (
                <span>
                  Akun ini memiliki <strong>{deleteConfirmAccount._count?.transactions} riwayat transaksi</strong>. Untuk menjaga keutuhan laporan keuangan & neraca, akun akan <strong>dinonaktifkan</strong> agar tidak muncul di form input baru, tanpa menghapus laporan historis.
                </span>
              ) : (
                <span>
                  Akun ini belum memiliki transaksi terkait dan akan <strong>dihapus secara permanen</strong> dari bagan akun.
                </span>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <BigButton
                variant="secondary"
                size="normal"
                onClick={() => setDeleteConfirmAccount(null)}
                disabled={isDeleting}
              >
                Batal
              </BigButton>
              <BigButton
                variant="danger"
                size="normal"
                onClick={handleDelete}
                isLoading={isDeleting}
                loadingText="Memproses..."
              >
                {(deleteConfirmAccount._count?.transactions ?? 0) > 0 ? 'Nonaktifkan Akun' : 'Hapus Permanen'}
              </BigButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
