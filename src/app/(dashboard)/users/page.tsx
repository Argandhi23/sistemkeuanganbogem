'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  UserPlus,
  Shield,
  User as UserIcon,
  X,
  Save,
} from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PageHeader } from '@/components/ui/PageHeader';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  _count?: {
    transactions: number;
    orders: number;
  };
}

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<UserData | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isSubmittingRef = useRef(false);
  const isTogglingRef = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

    setFormError(null);

    if (!name.trim() || !email.trim() || !password) {
      setFormError('Semua kolom wajib diisi');
      return;
    }

    if (password.length < 6) {
      setFormError('Kata sandi minimal 6 karakter');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setIsSubmitting(true);

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role, isActive: true }),
      });

      const json = await res.json();

      if (res.ok) {
        setShowAddModal(false);
        setName('');
        setEmail('');
        setPassword('');
        setRole('USER');
        setToastMessage(`✅ Pengguna "${name}" berhasil ditambahkan`);
        fetchUsers();
      } else {
        setFormError(json.error || 'Gagal menambahkan pengguna');
      }
    } catch {
      setFormError('Terjadi kesalahan koneksi');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleToggleStatus = async () => {
    if (!toggleTarget || isTogglingRef.current) return;

    try {
      isTogglingRef.current = true;
      const res = await fetch(`/api/users/${toggleTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });

      if (res.ok) {
        setToastMessage(
          `✅ Status akun ${toggleTarget.name} diubah menjadi ${
            !toggleTarget.isActive ? 'Aktif' : 'Nonaktif'
          }`
        );
        setToggleTarget(null);
        fetchUsers();
      } else {
        const json = await res.json();
        setToastMessage(`❌ ${json.error || 'Gagal mengubah status'}`);
      }
    } catch {
      setToastMessage('❌ Terjadi kesalahan');
    } finally {
      isTogglingRef.current = false;
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="Pengguna & Hak Akses"
        description="Kelola akun petugas catering dan pengurus BUMDes Bogem"
        action={
          <BigButton
            variant="primary"
            size="normal"
            onClick={() => setShowAddModal(true)}
            icon={<UserPlus className="w-4 h-4" />}
          >
            + Tambah Pengguna
          </BigButton>
        }
      />

      {toastMessage && (
        <div className="p-3 bg-slate-900 text-white font-medium rounded-xl text-center text-xs shadow-subtle animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* Tabel Pengguna */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Memuat data pengguna...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada pengguna terdaftar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Nama Pengguna</th>
                  <th className="py-3 px-4">Email Login</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Riwayat</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isCurrent = u.id === session?.user?.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {u.name}
                        {isCurrent && (
                          <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                            (Anda)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {u.email}
                      </td>
                      <td className="py-3 px-4">
                        {u.role === 'ADMIN' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded">
                            <Shield className="w-3 h-3 text-amber-600" /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded">
                            <UserIcon className="w-3 h-3 text-slate-400" /> Petugas
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400 text-[11px]">
                        {u._count?.transactions || 0} trx • {u._count?.orders || 0} order
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {!isCurrent && (
                          <button
                            onClick={() => setToggleTarget(u)}
                            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                              u.isActive
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah Pengguna Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Tambah Akun Pengguna</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 mt-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ibu Siti Rahayu"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alamat Email (Login)
                </label>
                <input
                  type="email"
                  required
                  placeholder="siti@bogem.desa.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-9 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-9 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Akses
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
                  className="w-full h-9 px-3 text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="USER">USER / Petugas (Input data & lihat laporan)</option>
                  <option value="ADMIN">ADMIN (Kelola user & audit log)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <BigButton
                  type="button"
                  variant="secondary"
                  size="normal"
                  onClick={() => setShowAddModal(false)}
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
                  icon={<Save className="w-3.5 h-3.5" />}
                >
                  Simpan Akun
                </BigButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Toggle Status */}
      <ConfirmModal
        isOpen={!!toggleTarget}
        title={`${toggleTarget?.isActive ? 'Nonaktifkan' : 'Aktifkan'} Akun?`}
        message={`Apakah Anda yakin ingin ${
          toggleTarget?.isActive ? 'menonaktifkan' : 'mengaktifkan kembali'
        } akun ${toggleTarget?.name}?`}
        confirmText={`Ya, ${toggleTarget?.isActive ? 'Nonaktifkan' : 'Aktifkan'}`}
        cancelText="Batal"
        isDanger={toggleTarget?.isActive}
        onConfirm={handleToggleStatus}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}
