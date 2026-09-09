'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Wallet,
  FileText,
  BookOpen,
  Users,
  History,
  HelpCircle,
  UtensilsCrossed,
  Hammer,
  Wifi,
  Smartphone,
  Sprout,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { clsx } from 'clsx';

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const isCatering = session?.user?.role === 'CATERING';

  const cateringMenuItems = [
    {
      name: 'Buku Kas Catering',
      href: '/units/catering',
      icon: UtensilsCrossed,
      color: 'text-amber-600',
    },
    {
      name: '+ Catat Uang Masuk',
      href: '/transaksi/tambah?businessUnit=CATERING&type=PEMASUKAN',
      icon: ArrowDownLeft,
      color: 'text-emerald-600',
    },
    {
      name: '- Uang Keluar & Operasional',
      href: '/transaksi/tambah?businessUnit=CATERING&type=PENGELUARAN',
      icon: ArrowUpRight,
      color: 'text-rose-600',
    },
    {
      name: 'Laporan Keuangan Catering',
      href: '/laporan?businessUnit=CATERING',
      icon: FileText,
      color: 'text-blue-600',
    },
  ];

  const menuItems = [
    {
      name: 'Beranda Konsolidasi',
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
      name: 'Laporan Keuangan',
      href: '/laporan',
      icon: FileText,
    },
  ];

  const unitMenuItems = [
    {
      name: 'Catering Desa',
      href: '/units/catering',
      icon: UtensilsCrossed,
      color: 'text-amber-500',
    },
    {
      name: 'Penyewaan Molen',
      href: '/units/molen',
      icon: Hammer,
      color: 'text-orange-500',
    },
    {
      name: 'WiFi Balai Desa',
      href: '/units/wifi',
      icon: Wifi,
      color: 'text-blue-500',
    },
    {
      name: 'PPOB',
      href: '/units/ppob',
      icon: Smartphone,
      color: 'text-emerald-500',
    },
    {
      name: 'Ketahanan Pangan (Sapi)',
      href: '/units/sapi',
      icon: Sprout,
      color: 'text-emerald-600',
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
      <div className="space-y-5">
        {/* Jika Role Khusus CATERING */}
        {isCatering ? (
          <div className="pt-1">
            <div className="text-[10px] font-bold tracking-wider text-amber-600 uppercase px-2.5 mb-1.5 flex items-center gap-1.5">
              <span>Unit Usaha Catering</span>
            </div>
            <nav className="space-y-0.5">
              {cateringMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href.includes('?') && pathname === item.href.split('?')[0]);

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
                        isActive ? 'text-white' : item.color
                      )}
                    />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : (
          <>
            {/* Menu Navigasi Utama Admin */}
            <div className="pt-1">
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2.5 mb-1.5">
                Utama (Sekretariat Desa)
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

            {/* Menu Unit Usaha BUMDes */}
            <div>
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2.5 mb-1.5">
                Unit Usaha BUMDes
              </div>
              <nav className="space-y-0.5">
                {unitMenuItems.map((item) => {
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
                          isActive ? 'text-white' : item.color
                        )}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </>
        )}

        {/* Menu Khusus Admin */}
        {isAdmin && (
          <div>
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2.5 mb-1.5">
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
