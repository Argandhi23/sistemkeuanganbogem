'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ShoppingBag,
  Plus,
  Search,
  Calendar,
  Phone,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageHeader } from '@/components/ui/PageHeader';

interface CateringOrderItem {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  eventDate: string;
  menuDetail: string;
  portion: number;
  totalPrice: number | string;
  status: 'PENDING' | 'DIPROSES' | 'SELESAI' | 'DIBATALKAN';
  notes?: string | null;
  createdById: string;
  syncedToSheet: boolean;
  createdBy?: {
    id: string;
    name: string;
  };
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function PesananPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const currentUserId = session?.user?.id;

  const [orders, setOrders] = useState<CateringOrderItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 25,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<CateringOrderItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '25');

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const res = await fetch(`/api/pesanan?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setOrders(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusFilterChange = (st: string) => {
    setStatusFilter(st);
    setCurrentPage(1);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/pesanan/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setToastMessage('✅ Data pesanan berhasil dihapus');
        setDeleteTarget(null);
        fetchOrders();
      } else {
        const err = await res.json();
        setToastMessage(`❌ ${err.error || 'Gagal menghapus pesanan'}`);
      }
    } catch {
      setToastMessage('❌ Terjadi kesalahan');
    } finally {
      setIsDeleting(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded text-[10px] font-semibold">PENDING</span>;
      case 'DIPROSES':
        return <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.2 rounded text-[10px] font-semibold">DIPROSES</span>;
      case 'SELESAI':
        return <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px] font-semibold">SELESAI</span>;
      case 'DIBATALKAN':
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded text-[10px] font-semibold">DIBATALKAN</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <PageHeader
        title="Pesanan Catering"
        description="Kelola pesanan prasmanan, nasi box, dan acara catering Desa Bogem"
        action={
          <Link href="/pesanan/tambah">
            <BigButton variant="primary" size="normal" icon={<Plus className="w-4 h-4" />}>
              + Tambah Pesanan
            </BigButton>
          </Link>
        }
      />

      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white font-medium rounded-xl text-center text-xs shadow-subtle animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Filter Status Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-lg w-full sm:w-auto overflow-x-auto">
            {['ALL', 'PENDING', 'DIPROSES', 'SELESAI', 'DIBATALKAN'].map((st) => (
              <button
                key={st}
                onClick={() => handleStatusFilterChange(st)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors select-none ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-subtle font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? `Semua (${pagination.total})` : st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Cari pemesan / menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {isLoading && (
              <RefreshCw className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3 animate-spin" />
            )}
          </div>
        </div>
      </div>

      {/* Konten Pesanan */}
      {isLoading && orders.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-slate-400 border border-slate-200 text-xs">
          Memuat data pesanan...
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-dashed border-slate-300">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-800">Belum Ada Pesanan</h3>
          <p className="mt-0.5 text-xs text-slate-500 max-w-sm mx-auto">
            {debouncedSearch
              ? 'Tidak ada pesanan yang cocok dengan pencarian Anda.'
              : 'Catat pesanan catering pertama pelanggan Anda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Tampilan Mobile: Kartu */}
          <div className="grid grid-cols-1 gap-2.5 md:hidden">
            {orders.map((ord) => {
              const canEdit = isAdmin || ord.createdById === currentUserId;
              const eventDateStr = new Intl.DateTimeFormat('id-ID', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              }).format(new Date(ord.eventDate));

              return (
                <div
                  key={ord.id}
                  className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-subtle space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {getStatusBadge(ord.status)}
                        <span className="text-[11px] text-slate-500 font-medium">
                          {ord.portion} Porsi
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1">
                        {ord.customerName}
                      </h4>
                    </div>

                    <div className="text-sm font-bold text-slate-900 tabular-nums">
                      Rp {Number(ord.totalPrice).toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1">
                    <div className="font-medium text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{eventDateStr}</span>
                    </div>

                    <div className="text-slate-600">
                      <span className="font-medium text-slate-900">Menu:</span> {ord.menuDetail}
                    </div>

                    {ord.customerPhone && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-600">{ord.customerPhone}</span>
                        <a
                          href={`https://wa.me/${ord.customerPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-emerald-700 hover:underline"
                        >
                          (WA)
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>Oleh: {ord.createdBy?.name || 'Petugas'}</span>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Link href={`/pesanan/${ord.id}/edit`} className="text-slate-600 hover:text-slate-900 font-medium px-2 py-0.5 rounded hover:bg-slate-100">
                          Edit
                        </Link>
                      )}
                      {isAdmin && (
                        <button onClick={() => setDeleteTarget(ord)} className="text-rose-600 hover:text-rose-700 font-medium px-2 py-0.5 rounded hover:bg-rose-50">
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tampilan Desktop: Tabel */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Tanggal Acara</th>
                    <th className="py-3 px-4">Pemesan & Kontak</th>
                    <th className="py-3 px-4">Menu & Porsi</th>
                    <th className="py-3 px-4 text-right">Total (Rp)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((ord) => {
                    const canEdit = isAdmin || ord.createdById === currentUserId;
                    const eventDateStr = new Intl.DateTimeFormat('id-ID', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }).format(new Date(ord.eventDate));

                    return (
                      <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{eventDateStr}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {ord.customerName}
                          </div>
                          {ord.customerPhone && (
                            <div className="text-[11px] text-slate-400 font-normal flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{ord.customerPhone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-medium text-slate-800">
                            {ord.portion} Porsi
                          </div>
                          <div className="text-[11px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                            {ord.menuDetail}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <span className="font-bold text-slate-900 tabular-nums">
                            Rp {Number(ord.totalPrice).toLocaleString('id-ID')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(ord.status)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {canEdit && (
                              <Link href={`/pesanan/${ord.id}/edit`}>
                                <button
                                  title="Edit Pesanan"
                                  className="p-1 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </Link>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => setDeleteTarget(ord)}
                                title="Hapus Pesanan"
                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Menampilkan {((pagination.page - 1) * pagination.limit) + 1} -{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} dari{' '}
                <span className="font-bold text-slate-900">{pagination.total}</span> data
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev || isLoading}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>

                <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 font-semibold">
                  Halaman {pagination.page} dari {pagination.totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasNext || isLoading}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Hapus */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Hapus Pesanan Catering?"
        message={`Yakin ingin menghapus pesanan "${deleteTarget?.customerName} (${deleteTarget?.portion} Porsi)"?`}
        confirmText="Hapus"
        cancelText="Batal"
        isDanger={true}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
