'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { SuccessFeedback } from '@/components/ui/SuccessFeedback';

export default function TambahPesananPage() {
  const router = useRouter();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isSubmittingRef = useRef(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [eventDate, setEventDate] = useState<string>(
    () => tomorrow.toISOString().split('T')[0]
  );
  const [menuDetail, setMenuDetail] = useState('');
  const [portion, setPortion] = useState<number>(50);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [status, setStatus] = useState<'PENDING' | 'DIPROSES' | 'SELESAI' | 'DIBATALKAN'>('PENDING');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;

    setError(null);

    if (!customerName.trim()) {
      setError('Nama pemesan wajib diisi');
      return;
    }

    if (!eventDate) {
      setError('Tanggal acara wajib ditentukan');
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

    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const res = await fetch('/api/pesanan', {
        method: 'POST',
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
        setError(json.error || 'Gagal menyimpan pesanan');
      }
    } catch {
      setError('Terjadi kesalahan jaringan saat menyimpan pesanan');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  if (isSuccess) {
    return (
      <SuccessFeedback
        title="Pesanan Berhasil Dicatat"
        message={`Pesanan catering untuk "${customerName}" sebanyak ${portion} porsi (Total: Rp ${totalPrice.toLocaleString(
          'id-ID'
        )}) telah tersimpan.`}
        primaryActionText="Lihat Daftar Pesanan"
        primaryActionHref="/pesanan"
        secondaryActionText="Catat Pesanan Lainnya"
        onSecondaryClick={() => {
          setIsSuccess(false);
          setCustomerName('');
          setCustomerPhone('');
          setMenuDetail('');
          setTotalPrice(0);
          setNotes('');
        }}
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <PageHeader
        title="Tambah Pesanan Catering"
        description="Catat pesanan catering pelanggan unit BUMDes Bogem"
        backHref="/pesanan"
        backLabel="Kembali ke Daftar Pesanan"
      />

      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-subtle">
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Contoh: Ibu Sri Hariyati"
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Nomor HP / WhatsApp */}
          <div>
            <label htmlFor="customerPhone" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nomor WhatsApp / HP (Opsional)
            </label>
            <input
              id="customerPhone"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
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
              placeholder="Contoh: Nasi Kotak Ayam Bakar Kecap, Sambal Goreng, Urap, Kerupuk"
              className="w-full p-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Baris Grid: Jumlah Porsi & Total Harga */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Jumlah Porsi */}
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
                placeholder="100"
                className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
              />
            </div>

            {/* Total Harga */}
            <div>
              <label htmlFor="totalPrice" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Total Harga (Rp) <span className="text-rose-500">*</span>
              </label>
              <CurrencyInput
                id="totalPrice"
                value={totalPrice || ''}
                onChange={(val) => setTotalPrice(val)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Status Pesanan */}
          <div>
            <label htmlFor="status" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Status Pesanan
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'PENDING' | 'DIPROSES' | 'SELESAI' | 'DIBATALKAN')}
              className="w-full h-10 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            >
              <option value="PENDING">PENDING (Menunggu Konfirmasi)</option>
              <option value="DIPROSES">DIPROSES (Sedang Dimasak)</option>
              <option value="SELESAI">SELESAI (Sudah Diantar & Lunas)</option>
              <option value="DIBATALKAN">DIBATALKAN</option>
            </select>
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
              placeholder="Contoh: Minta diantar jam 11 siang ke Balai RT 02"
              className="w-full p-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all"
            />
          </div>

          {/* Tombol Simpan Form */}
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
              Simpan Pesanan
            </BigButton>
          </div>
        </form>
      </div>
    </div>
  );
}
