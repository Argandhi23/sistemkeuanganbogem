'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CashFlowChartProps {
  data: Array<{
    name: string;
    pemasukan: number;
    pengeluaran: number;
  }>;
}

export default function CashFlowChart({ data }: CashFlowChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-slate-400 text-xs">
        Belum ada data untuk grafik
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(val) => `Rp${(val / 1000).toLocaleString('id-ID')}k`}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <Tooltip
            formatter={(val: unknown) => [
              `Rp ${Number(Array.isArray(val) ? val[0] : val || 0).toLocaleString('id-ID')}`,
              '',
            ]}
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              fontSize: '12px',
              fontWeight: '600',
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }}
            formatter={(val) => (val === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran')}
          />
          <Bar dataKey="pemasukan" fill="#16a34a" radius={[4, 4, 0, 0]} name="pemasukan" maxBarSize={32} />
          <Bar dataKey="pengeluaran" fill="#e11d48" radius={[4, 4, 0, 0]} name="pengeluaran" maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
