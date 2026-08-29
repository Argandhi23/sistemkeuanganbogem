'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { BigButton } from '@/components/ui/BigButton';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setIsLoading(false);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Terjadi kesalahan koneksi');
      setIsLoading(false);
    }
  };

  const handleQuickFill = (accEmail: string, accPass: string) => {
    setEmail(accEmail);
    setPassword(accPass);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <div className="relative w-14 h-14 mx-auto mb-3 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="Logo BUMDes Bogem"
            width={56}
            height={56}
            className="w-full h-full object-contain drop-shadow-sm"
            priority
          />
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          BUMDes Desa Bogem
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Sistem Pembukuan & Pesanan Catering
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="bg-white py-6 px-5 sm:px-7 rounded-2xl shadow-card border border-slate-200/80">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="petugas@bogem.desa.id"
                  className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-9 pr-10 text-xs sm:text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <BigButton
                type="submit"
                variant="primary"
                size="normal"
                isLoading={isLoading}
                loadingText="Sedang Masuk..."
                className="w-full"
              >
                Masuk ke Sistem
              </BigButton>
            </div>
          </form>

          {/* Quick login helper (hanya tampil pada mode development/testing lokal) */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">
                ⚡ Akun Demo (Dev Mode Only):
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@bogem.desa.id', 'admin123')}
                  className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors"
                >
                  <div className="font-semibold text-slate-900 text-[11px]">👑 Admin</div>
                  <div className="text-[10px] text-slate-500 truncate">admin@bogem.desa.id</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('petugas@bogem.desa.id', 'petugas123')}
                  className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors"
                >
                  <div className="font-semibold text-slate-900 text-[11px]">👤 Petugas</div>
                  <div className="text-[10px] text-slate-500 truncate">petugas@bogem.desa.id</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
