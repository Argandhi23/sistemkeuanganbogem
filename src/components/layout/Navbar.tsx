'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import {
  LogOut,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

export function Navbar() {
  const { data: session } = useSession();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      setSyncFeedback(null);
      const res = await fetch('/api/sync/retry', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncFeedback(`✅ ${data.message || 'Sinkronisasi berhasil'}`);
      } else {
        setSyncFeedback(`ℹ️ ${data.message || 'Sinkronisasi selesai'}`);
      }
    } catch {
      setSyncFeedback('❌ Gagal terhubung ke server');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'BG';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identitas BUMDes */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
              <Image
                src="/logo.png"
                alt="Logo BUMDes Bogem"
                width={32}
                height={32}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-slate-900 tracking-tight leading-none">
                  BUMDes Bogem
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Catering
                </span>
              </div>
            </div>
          </Link>

          {/* User Status & Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Tombol Sinkronisasi Google Sheets */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title="Sinkronkan data ke Google Sheets"
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Menyinkronkan...' : 'Sinkron Sheets'}</span>
            </button>

            {/* Menu Bantuan */}
            <Link
              href="/bantuan"
              className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Bantuan</span>
            </Link>

            {/* User Profile Badge */}
            {session?.user && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
                <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[11px] text-slate-700">
                  {getInitials(session.user.name)}
                </div>

                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {session.user.name || 'Petugas'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                    {session.user.role === 'ADMIN' ? 'Admin Desa' : 'Petugas'}
                  </div>
                </div>

                {/* Tombol Logout */}
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  title="Keluar dari Akun"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sync Toast Feedback Banner */}
        {syncFeedback && (
          <div className="text-center text-xs font-medium text-slate-800 bg-emerald-50 border border-emerald-200 rounded-lg py-1 px-3 mb-2 animate-in fade-in">
            {syncFeedback}
          </div>
        )}
      </div>
    </header>
  );
}
