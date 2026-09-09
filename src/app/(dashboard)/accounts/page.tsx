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
  Utensils,
  Building2,
  Info,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { BigButton } from '@/components/ui/BigButton';
import { invalidateClientAccountsCache } from '@/lib/client-cache';

type AccountCategory =
  | 'ASET'
  | 'KEWAJIBAN'
  | 'MODAL'
  | 'PENDAPATAN'
  | 'BEBAN_OPERASIONAL'
  | 'BEBAN_NON_OPERASIONAL';

type BusinessUnit = 'CATERING' | 'RENTAL_MOLEN' | 'WIFI_DESA' | 'PPOB' | 'KETAHANAN_PANGAN' | 'UMUM';

interface AccountItem {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  businessUnit: BusinessUnit;
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
    desc: 'Kas tunai, bank, piutang, persediaan bahan baku (1004), perlengkapan (1005), dan peralatan catering (1201).',
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
    desc: 'Bahan baku (5001), perlengkapan & kemasan (5002), upah masak (5003), pemeliharaan peralatan (5004), operasional kantor (5051), logistik (5052).',
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

const CATERING_PRESETS = [
  {
    id: 'KITCHEN',
    title: '🍳 Biaya Pokok Dapur / HPP',
    category: 'BEBAN_OPERASIONAL' as AccountCategory,
    prefix: '500x',
    desc: 'Bahan baku mentah, bumbu, minyak, beras, kemasan box snack, gas elpiji dapur, dan upah masak harian.',
    example: 'Beban Sewa Alat Pemanas Prasmanan',
  },
  {
    id: 'OFFICE',
    title: '🏢 Beban Operasional Kantor Catering',
    category: 'BEBAN_OPERASIONAL' as AccountCategory,
    prefix: '505x',
    desc: 'Nota struk pesanan, pulsa/kuota chat WhatsApp pelanggan, administrasi kantor, sabun cuci, transport/bensin kurir.',
    example: 'Beban Promosi & Brosur Cetak Catering',
  },
  {
    id: 'REVENUE',
    title: '💰 Pendapatan Usaha Catering',
    category: 'PENDAPATAN' as AccountCategory,
    prefix: '400x',
    desc: 'Penerimaan pesanan nasi box, prasmanan hajatan, pesanan snack rapat, sewa alat catering, atau ongkir pengantaran.',
    example: 'Pendapatan Pesanan Snack Box Instansi',
  },
  {
    id: 'ASSET',
    title: '📦 Aset Peralatan Catering',
    category: 'ASET' as AccountCategory,
    prefix: '120x',
    desc: 'Peralatan masak bernilai tetap: kompor gas komersil, wajan besar, chiller/freezer, motor pengantar.',
    example: 'Aset Kompor Gas High Pressure',
  },
];

export default function AccountsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUnitScope, setSelectedUnitScope] = useState<'ALL' | 'CATERING' | 'UMUM'>('ALL');
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
    businessUnit: BusinessUnit;
    isActive: boolean;
  }>({
    code: '',
    name: '',
    category: 'BEBAN_OPERASIONAL',
    businessUnit: 'CATERING',
    isActive: true,
  });

  const [selectedCateringPreset, setSelectedCateringPreset] = useState<string>('OFFICE');

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

  // Helper: Dapatkan nomor kode rekomendasi berikutnya
  const getNextAvailableCode = useCallback(
    (presetId: string, currentAccounts: AccountItem[]) => {
      let rangeMin = 5051;
      let rangeMax = 5099;

      if (presetId === 'KITCHEN') {
        rangeMin = 5001;
        rangeMax = 5049;
      } else if (presetId === 'OFFICE') {
        rangeMin = 5051;
        rangeMax = 5099;
      } else if (presetId === 'REVENUE') {
        rangeMin = 4001;
        rangeMax = 4009;
      } else if (presetId === 'ASSET') {
        rangeMin = 1201;
        rangeMax = 1205;
      }

      const existingCodes = currentAccounts
        .map((a) => parseInt(a.code, 10))
        .filter((num) => !isNaN(num) && num >= rangeMin && num <= rangeMax);

      if (existingCodes.length === 0) return rangeMin.toString();
      const maxCode = Math.max(...existingCodes);
      return (maxCode + 1).toString();
    },
    []
  );

  // Open Create Modal
  const handleOpenCreate = (targetUnit: BusinessUnit = 'CATERING', presetType = 'OFFICE') => {
    const nextCode = targetUnit === 'CATERING' ? getNextAvailableCode(presetType, accounts) : '';
    const preset = CATERING_PRESETS.find((p) => p.id === presetType) || CATERING_PRESETS[1];

    setFormData({
      code: nextCode,
      name: '',
      category: targetUnit === 'CATERING' ? preset.category : 'BEBAN_OPERASIONAL',
      businessUnit: targetUnit,
      isActive: true,
    });
    setSelectedCateringPreset(presetType);
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
      businessUnit: acc.businessUnit || 'UMUM',
      isActive: acc.isActive,
    });
    setIsEditing(true);
    setEditingId(acc.id);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Pilih preset catering di form
  const handleSelectPreset = (presetId: string) => {
    setSelectedCateringPreset(presetId);
    const preset = CATERING_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const nextCode = getNextAvailableCode(presetId, accounts);
      setFormData((prev) => ({
        ...prev,
        category: preset.category,
        businessUnit: 'CATERING',
        code: nextCode,
      }));
    }
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
          businessUnit: formData.businessUnit,
          isActive: formData.isActive,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        invalidateClientAccountsCache();
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
        invalidateClientAccountsCache();
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
      // Filter Scope Unit
      if (selectedUnitScope === 'CATERING' && acc.businessUnit !== 'CATERING') return false;
      if (selectedUnitScope === 'UMUM' && acc.businessUnit === 'CATERING') return false;

      // Filter Kategori
      const matchCat = selectedCategory === 'SEMUA' || acc.category === selectedCategory;

      // Filter Pencarian
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q);

      return matchCat && matchSearch;
    });
  }, [accounts, selectedUnitScope, selectedCategory, searchQuery]);

  // Statistics
  const cateringCount = useMemo(() => {
    return accounts.filter((a) => a.businessUnit === 'CATERING').length;
  }, [accounts]);

  const stats = useMemo(() => {
    const total = filteredAccounts.length;
    const aset = filteredAccounts.filter((a) => a.category === 'ASET').length;
    const kewajiban = filteredAccounts.filter((a) => a.category === 'KEWAJIBAN').length;
    const modal = filteredAccounts.filter((a) => a.category === 'MODAL').length;
    const pendapatan = filteredAccounts.filter((a) => a.category === 'PENDAPATAN').length;
    const beban = filteredAccounts.filter(
      (a) => a.category === 'BEBAN_OPERASIONAL' || a.category === 'BEBAN_NON_OPERASIONAL'
    ).length;

    return { total, aset, kewajiban, modal, pendapatan, beban };
  }, [filteredAccounts]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <PageHeader
        title="Master Kode Akun Keuangan"
        description="Kelola pos akun akuntansi standar (SAK EMKM) BUMDes Bogem dan pengaturan kode akun khusus Catering"
        action={
          isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenCreate('CATERING', 'OFFICE')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold shadow-subtle transition-all"
              >
                <Utensils className="w-3.5 h-3.5 text-amber-700" />
                <span>+ Akun Khusus Catering</span>
              </button>
              <BigButton
                variant="primary"
                size="normal"
                onClick={() => handleOpenCreate('UMUM')}
                icon={<Plus className="w-4 h-4" />}
              >
                Tambah Akun Umum
              </BigButton>
            </div>
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

      {/* Tab Filter Unit Usaha (Scope) */}
      <div className="flex items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-subtle">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSelectedUnitScope('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedUnitScope === 'ALL'
                ? 'bg-slate-900 text-white shadow-subtle'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Unit ({accounts.length})
          </button>

          <button
            onClick={() => setSelectedUnitScope('CATERING')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedUnitScope === 'CATERING'
                ? 'bg-amber-600 text-white shadow-subtle'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Khusus Catering Desa ({cateringCount})</span>
          </button>

          <button
            onClick={() => setSelectedUnitScope('UMUM')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedUnitScope === 'UMUM'
                ? 'bg-slate-900 text-white shadow-subtle'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            BUMDes Umum & Unit Lain ({accounts.length - cateringCount})
          </button>
        </div>

        {selectedUnitScope === 'CATERING' && isAdmin && (
          <button
            onClick={() => handleOpenCreate('CATERING', 'OFFICE')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Pos Akun Catering</span>
          </button>
        )}
      </div>

      {/* Info Banner Alur CRUD Khusus Catering untuk Super Admin */}
      {selectedUnitScope === 'CATERING' && (
        <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex items-start gap-3 shadow-subtle">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-bold">
              💡 Rekomendasi Alur Pengaturan Kode Akun Catering untuk Super Admin:
            </p>
            <p className="leading-relaxed text-amber-800">
              Pengurus Catering (Ibu Sri) dapat langsung menggunakan pos akun yang dibuat di sini saat mencatat transaksi.
              Gunakan awalan <strong>500x</strong> untuk <em>Biaya Pokok Dapur</em> (bahan baku, upah masak, gas), awalan <strong>505x</strong> untuk <em>Operasional Kantor Catering</em> (ATK, nota, pulsa, transport), dan <strong>400x</strong> untuk <em>Pendapatan Pesanan</em>.
            </p>
          </div>
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
            <span>Total Tampil</span>
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
                  <th className="py-3 px-4 w-36">Unit Bisnis</th>
                  <th className="py-3 px-4 w-40">Kategori Akuntansi</th>
                  <th className="py-3 px-4 text-center w-28">Riwayat Trx</th>
                  <th className="py-3 px-4 text-center w-24">Status</th>
                  {isAdmin && <th className="py-3 px-4 text-right w-24">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccounts.map((acc) => {
                  const meta = CATEGORY_METADATA[acc.category] || CATEGORY_METADATA.PENDAPATAN;
                  const trxCount = acc._count?.transactions ?? 0;
                  const isCatering = acc.businessUnit === 'CATERING';

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
                        {isCatering ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Utensils className="w-3 h-3 text-amber-700" />
                            <span>Khusus Catering</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {acc.businessUnit || 'UMUM'}
                          </span>
                        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-lg overflow-hidden my-6">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Ubah Kode Akun Keuangan' : 'Tambah Kode Akun Keuangan'}
                </h3>
                <p className="text-xs text-slate-500">
                  Pengaturan pos akun pembukuan BUMDes Bogem (SAK EMKM)
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

              {/* Pemilihan Unit Bisnis */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Peruntukan Unit Usaha <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, businessUnit: 'CATERING' }));
                      handleSelectPreset('OFFICE');
                    }}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      formData.businessUnit === 'CATERING'
                        ? 'border-amber-500 bg-amber-50/80 ring-2 ring-amber-500/20 text-amber-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Utensils className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Khusus Catering Desa</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Otomatis muncul di kas Catering</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, businessUnit: 'UMUM' }))}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      formData.businessUnit !== 'CATERING'
                        ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/20 text-slate-950'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-slate-700 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Umum / Unit Lain</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Operasional BUMDes umum</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Jika Unit CATERING: Tampilkan Preset Khusus Catering */}
              {formData.businessUnit === 'CATERING' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Pilih Jenis Pos Akun Catering <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CATERING_PRESETS.map((preset) => {
                      const isSelected = selectedCateringPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'border-amber-600 bg-amber-500/10 ring-1 ring-amber-500 text-amber-950'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="text-xs font-bold">{preset.title}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                            {preset.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Kategori Akuntansi Standar (Hanya jika Umum atau Edit) */}
              {formData.businessUnit !== 'CATERING' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kategori Akuntansi SAK EMKM <span className="text-rose-500">*</span>
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
                </div>
              )}

              {/* Kode Akun */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nomor Kode Akun <span className="text-rose-500">*</span>
                  </label>
                  {formData.businessUnit === 'CATERING' && (
                    <span className="text-[11px] text-amber-700 font-medium inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      Rekomendasi otomatis terisi
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 5053"
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
                  placeholder={
                    formData.businessUnit === 'CATERING'
                      ? 'Contoh: Beban Cetak Brosur & Promosi Catering'
                      : 'Contoh: Beban Perlengkapan Kantor'
                  }
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
                  {isEditing ? 'Simpan Perubahan' : 'Simpan Kode Akun'}
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
                  Akun ini memiliki <strong>{deleteConfirmAccount._count?.transactions} riwayat transaksi</strong>. Untuk menjaga keutuhan laporan keuangan & neraca, akun akan <strong>dinonaktifkan</strong> agar tidak muncul di form input baru, tanpa merusak laporan historis.
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
