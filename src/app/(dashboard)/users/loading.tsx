import React from 'react';

export default function UsersLoading() {
  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="space-y-1">
          <div className="h-6 w-48 bg-slate-200 rounded-lg" />
          <div className="h-3.5 w-72 bg-slate-100 rounded" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded-xl" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-subtle overflow-hidden">
        <div className="h-10 bg-slate-50 border-b border-slate-200" />
        <div className="divide-y divide-slate-100 p-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="py-3 px-4 flex items-center justify-between gap-4">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3.5 w-40 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-4 w-16 bg-slate-100 rounded" />
              <div className="h-3.5 w-24 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
