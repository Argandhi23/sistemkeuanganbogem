import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SessionProvider from '@/components/SessionProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
};

export const metadata: Metadata = {
  title: 'BUMDes Bogem - Pembukuan & Catering',
  description: 'Sistem Pembukuan dan Manajemen Pesanan Unit Usaha Catering BUMDes Desa Bogem',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans antialiased bg-[#F8FAFC] text-slate-900 selection:bg-slate-900 selection:text-white min-h-screen text-sm">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
