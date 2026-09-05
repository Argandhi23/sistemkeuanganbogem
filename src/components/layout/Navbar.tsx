'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import {
  LogOut,
  HelpCircle,
} from 'lucide-react';

export function Navbar() {
  const { data: session } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      // Panggil signOut tanpa auto redirect untuk menghindari proxy mismatch / hang di hosting
      await signOut({ redirect: false });
    } catch (err) {
      console.warn('NextAuth signOut warning:', err);
    } finally {
      // Hard redirect ke login agar sesi bersih total
      window.location.href = '/login';
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
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Multi-Unit
                </span>
              </div>
            </div>
          </Link>

          {/* User Status & Action Buttons */}
          <div className="flex items-center gap-2">

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

                {/* Tombol Logout Aman & Handal */}
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  title="Keluar dari Akun"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  <LogOut className={`w-4 h-4 ${isLoggingOut ? 'animate-pulse text-rose-500' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
