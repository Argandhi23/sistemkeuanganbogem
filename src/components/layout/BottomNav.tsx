'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Beranda',
      href: '/',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: 'Kas',
      href: '/transaksi',
      icon: Wallet,
    },
    {
      name: 'Laporan',
      href: '/laporan',
      icon: FileText,
    },
    {
      name: 'Bantuan',
      href: '/bantuan',
      icon: HelpCircle,
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-popover no-print">
      <div className="grid grid-cols-4 h-14 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center py-1 transition-colors relative select-none',
                isActive ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-600 font-medium'
              )}
            >
              <Icon className={clsx('w-4 h-4 mb-1', isActive ? 'text-slate-900' : 'text-slate-400')} />
              <span className="text-[10px] leading-none tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
