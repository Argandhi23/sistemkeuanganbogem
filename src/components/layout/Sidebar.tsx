'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Wallet,
  ShoppingBag,
  FileText,
  BookOpen,
  Users,
  History,
  HelpCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const menuItems = [
    {
      name: 'Beranda',
      href: '/',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: 'Buku Kas & Transaksi',
      href: '/transaksi',
      icon: Wallet,
    },
    {
      name: 'Pesanan Catering',
      href: '/pesanan',
      icon: ShoppingBag,
    },
    {
      name: 'Laporan Keuangan',
      href: '/laporan',
      icon: FileText,
    },
  ];

  const adminMenuItems = [
    {
      name: 'Master Kode Akun',
      href: '/accounts',
      icon: BookOpen,
    },
    {
      name: 'Kelola Pengguna',
      href: '/users',
      icon: Users,
    },
    {
      name: 'Catatan Aktivitas',
      href: '/logs',
      icon: History,
    },
  ];

  return (
    <aside className="w-64 bg-transparent p-2 flex flex-col justify-between hidden lg:flex no-print">
      <div className="space-y-6">
        {/* Quick Action */}
        <div className="space-y-1.5 pt-1">
          <Link
            href="/transaksi/tambah?type=PEMASUKAN"
            className="w-full h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs flex items-center justify-between transition-colors shadow-subtle"
          >
            <span>+ Catat Uang Masuk</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-semibold">Kas In</span>
          </Link>

          <Link
            href="/transaksi/tambah?type=PENGELUARAN"
            className="w-full h-9 px-3 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg font-medium text-xs flex items-center justify-between transition-colors shadow-subtle"
          >
            <span>- Catat Uang Keluar</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">Kas Out</span>
          </Link>
        </div>

        {/* Menu Navigasi Utama */}
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2.5 mb-1.5">
            Menu
          </div>
          <nav className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors select-none',
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-subtle'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon
                    className={clsx(
                      'w-4 h-4 flex-shrink-0',
                      isActive ? 'text-white' : 'text-slate-400'
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Menu Khusus Admin */}
        {isAdmin && (
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase px-2.5 mb-1.5">
              Administrasi
            </div>
            <nav className="space-y-0.5">
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors select-none',
                      isActive
                        ? 'bg-slate-900 text-white font-semibold shadow-subtle'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <Icon
                      className={clsx(
                        'w-4 h-4 flex-shrink-0',
                        isActive ? 'text-white' : 'text-slate-400'
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Footer Nav */}
      <div className="pt-3 border-t border-slate-200/80">
        <Link
          href="/bantuan"
          className={clsx(
            'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors select-none',
            pathname === '/bantuan'
              ? 'bg-slate-100 text-slate-900 font-semibold'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          )}
        >
          <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>Panduan Penggunaan</span>
        </Link>
      </div>
    </aside>
  );
}
