import React from 'react';

export default function LaporanLoading() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="h-6 w-44 bg-slate-200 rounded-lg" />
          <div className="h-3.5 w-80 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-200 rounded-xl" />
          <div className="h-9 w-28 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* Tabs & Period Skeleton */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-subtle flex flex-col sm:flex-row justify-between gap-3">
        <div className="h-8 w-72 bg-slate-100 rounded-lg" />
        <div className="h-8 w-48 bg-slate-100 rounded-lg" />
      </div>

      {/* Report Document Skeleton */}
      <div className="bg-white rounded-2xl p-8 border border-slate-200/90 shadow-subtle space-y-6">
        {/* Kop Surat Placeholder */}
        <div className="pb-5 border-b-2 border-slate-200 flex flex-col items-center space-y-2">
          <div className="w-12 h-12 bg-slate-200 rounded-full" />
          <div className="h-4 w-48 bg-slate-200 rounded" />
          <div className="h-5 w-64 bg-slate-200 rounded" />
          <div className="h-3.5 w-52 bg-slate-100 rounded" />
        </div>

        {/* 3 Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="h-3 w-28 bg-slate-200 rounded" />
              <div className="h-6 w-36 bg-slate-200 rounded" />
            </div>
          ))}
        </div>

        {/* Table Rows Placeholder */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="h-9 bg-slate-100 border-b border-slate-200" />
          <div className="divide-y divide-slate-100 p-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="py-2.5 px-3 flex justify-between">
                <div className="h-3.5 w-48 bg-slate-100 rounded" />
                <div className="h-3.5 w-24 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
