import React from 'react';

export default function LogsLoading() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="pb-3 border-b border-slate-200">
        <div className="h-6 w-52 bg-slate-200 rounded-lg" />
        <div className="h-3.5 w-80 bg-slate-100 rounded mt-1" />
      </div>

      {/* Search Bar Skeleton */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-subtle flex items-center justify-between">
        <div className="h-8 w-64 bg-slate-100 rounded-lg" />
        <div className="h-3.5 w-24 bg-slate-100 rounded" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        <div className="h-10 bg-slate-50 border-b border-slate-200" />
        <div className="divide-y divide-slate-100 p-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="py-2.5 px-4 flex items-center justify-between gap-4">
              <div className="h-3.5 w-24 bg-slate-100 rounded font-mono" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-24 bg-slate-200 rounded" />
              <div className="h-3.5 w-64 bg-slate-100 rounded" />
              <div className="h-3.5 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
