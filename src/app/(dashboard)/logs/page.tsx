'use client';

import React, { useState, useEffect } from 'react';
import { Search, Shield, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface AuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/logs');
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.targetType && log.targetType.toLowerCase().includes(q)) ||
      (log.detail && log.detail.toLowerCase().includes(q)) ||
      (log.user?.name && log.user.name.toLowerCase().includes(q)) ||
      (log.user?.email && log.user.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="Catatan Aktivitas Sistem"
        description="Audit log otomatis dari setiap penambahan, pengeditan, atau penghapusan data"
      />

      {/* Pencarian Log */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-subtle flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="Cari aktivitas, nama petugas, rincian data..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-slate-900 focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        <span className="text-xs text-slate-400 font-medium">
          Total {filteredLogs.length} Catatan
        </span>
      </div>

      {/* Tabel Log */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Memuat catatan aktivitas...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Belum ada aktivitas yang tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-36">Waktu</th>
                  <th className="py-3 px-4 w-36">Aksi</th>
                  <th className="py-3 px-4 w-28">Entitas</th>
                  <th className="py-3 px-4">Rincian Perubahan</th>
                  <th className="py-3 px-4 w-36">Pengguna</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const dateStr = new Intl.DateTimeFormat('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(log.createdAt));

                  let actionColor = 'bg-slate-100 text-slate-700 border-slate-200';
                  const act = (log.action || '').toUpperCase();
                  if (act.startsWith('CREATE')) {
                    actionColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  } else if (act.startsWith('UPDATE')) {
                    actionColor = 'bg-blue-50 text-blue-800 border-blue-200';
                  } else if (act.startsWith('DELETE')) {
                    actionColor = 'bg-rose-50 text-rose-800 border-rose-200';
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${actionColor}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {log.targetType}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px] max-w-sm truncate" title={log.detail || '-'}>
                        {log.detail || '-'}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-900 font-medium">
                        <div className="flex items-center gap-1">
                          {log.user?.role === 'ADMIN' ? (
                            <Shield className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          )}
                          <span className="truncate">{log.user?.name || 'Sistem'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
