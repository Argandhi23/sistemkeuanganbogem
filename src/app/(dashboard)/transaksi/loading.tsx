import React from 'react';

export default function TransaksiLoading() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-slate-200 rounded-xl" />
          <div className="h-9 w-28 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-subtle space-y-2">
            <div className="h-3 w-28 bg-slate-100 rounded" />
            <div className="h-6 w-36 bg-slate-200 rounded" />
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-subtle flex flex-col sm:flex-row justify-between gap-3">
        <div className="h-8 w-60 bg-slate-100 rounded-lg" />
        <div className="h-8 w-64 bg-slate-100 rounded-lg" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        <div className="h-10 bg-slate-50 border-b border-slate-200" />
        <div className="divide-y divide-slate-100 p-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="py-3 px-4 flex items-center justify-between gap-4">
              <div className="h-3.5 w-20 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-44 bg-slate-200 rounded" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
