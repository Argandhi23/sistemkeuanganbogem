'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Save,
  Trash2,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageHeader } from '@/components/ui/PageHeader';
import { SuccessFeedback } from '@/components/ui/SuccessFeedback';

export default function EditPesananPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [menuDetail, setMenuDetail] = useState('');
  const [portion, setPortion] = useState<number>(0);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [status, setStatus] = useState<'PENDING' | 'DIPROSES' | 'SELESAI' | 'DIBATALKAN'>('PENDING');
  const [notes, setNotes] = useState('');

  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setIsFetching(true);
        const res = await fetch(`/api/pesanan/${id}`);
        if (!res.ok) {
          setError('Data pesanan tidak ditemukan');
          return;
        }
        const json = await res.json();
        const ord = json.data;

        setCustomerName(ord.customerName);
        setCustomerPhone(ord.customerPhone || '');
        setEventDate(new Date(ord.eventDate).toISOString().split('T')[0]);
        setMenuDetail(ord.menuDetail);
        setPortion(ord.portion);
        setTotalPrice(Number(ord.totalPrice));
        setStatus(ord.status);
        setNotes(ord.notes || '');
      } catch {
        setError('Gagal memuat data pesanan');
      } finally {
        setIsFetching(false);
      }
    };

    if (id) fetchOrder();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Nama pemesan wajib diisi');
      return;
    }

    if (!eventDate) {
      setError('Tanggal acara wajib diisi');
      return;
    }

    if (!menuDetail.trim()) {
      setError('Rincian menu catering wajib diisi');
      return;
    }

    if (!portion || portion <= 0) {
      setError('Jumlah porsi minimal 1');
      return;
    }

    if (!totalPrice || totalPrice <= 0) {
      setError('Total harga pesanan harus lebih besar dari Rp 0');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/pesanan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          eventDate,
          menuDetail: menuDetail.trim(),
          portion,
          totalPrice,
          status,
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setIsSuccess(true);
      } else {
        setError(json.error || 'Gagal memperbarui pesanan');
      }
    } catch {
      setError('Terjadi kesalahan jaringan saat menyimpan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/pesanan/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/pesanan');
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
        Memuat data pesanan...
      </div>
    );
  }

  if (isSuccess) {
    return (
      <SuccessFeedback
        title="Perubahan Pesanan Disimpan"
        message={`Data pesanan "${customerName}" telah diperbarui.`}
        primaryActionText="Kembali ke Daftar Pesanan"
        primaryActionHref="/pesanan"
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <PageHeader
        title="Edit Pesanan Catering"
        description="Perbarui informasi menu, tanggal acara, atau status pesanan"
        backHref="/pesanan"
        backLabel="Kembali ke Daftar Pesanan"
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
          {/* Status Pesanan */}
          <div>
            <label htmlFor="status" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Status Pesanan
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'PENDING' | 'DIPROSES' | 'SELESAI' | 'DIBATALKAN')}
              className="w-full h-10 px-3 text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            >
              <option value="PENDING">PENDING (Menunggu Konfirmasi)</option>
              <option value="DIPROSES">DIPROSES (Sedang Dimasak)</option>
              <option value="SELESAI">SELESAI (Sudah Diantar & Lunas)</option>
              <option value="DIBATALKAN">DIBATALKAN</option>
            </select>
          </div>

          {/* Nama Pemesan */}
          <div>
            <label htmlFor="customerName" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Pemesan / Pelanggan <span className="text-rose-500">*</span>
            </label>
            <input
              id="customerName"
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Nomor HP */}
          <div>
            <label htmlFor="customerPhone" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nomor WhatsApp / HP
            </label>
            <input
              id="customerPhone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Tanggal Acara */}
          <div>
            <label htmlFor="eventDate" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Tanggal Acara / Pengantaran <span className="text-rose-500">*</span>
            </label>
            <input
              id="eventDate"
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Rincian Menu */}
          <div>
            <label htmlFor="menuDetail" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Rincian Menu Masakan <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="menuDetail"
              required
              rows={3}
              value={menuDetail}
              onChange={(e) => setMenuDetail(e.target.value)}
              className="w-full p-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Jumlah Porsi & Total Harga */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="portion" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Jumlah Porsi / Box <span className="text-rose-500">*</span>
              </label>
              <input
                id="portion"
                type="number"
                min={1}
                required
                value={portion || ''}
                onChange={(e) => setPortion(parseInt(e.target.value, 10) || 0)}
                className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
              />
            </div>

            <div>
              <label htmlFor="totalPrice" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Total Harga (Rp) <span className="text-rose-500">*</span>
              </label>
              <CurrencyInput
                id="totalPrice"
                value={totalPrice || ''}
                onChange={(val) => setTotalPrice(val)}
              />
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label htmlFor="notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Tombol Simpan Perubahan */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <BigButton
              type="button"
              variant="secondary"
              size="normal"
              onClick={() => router.push('/pesanan')}
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
        title="Hapus Pesanan Ini?"
        message="Yakin ingin menghapus pesanan ini? Data akan dihapus dari database dan Google Sheets."
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
