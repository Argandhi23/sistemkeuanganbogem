import React from 'react';

export default function BantuanLoading() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="pb-3 border-b border-slate-200">
        <div className="h-6 w-48 bg-slate-200 rounded-lg" />
        <div className="h-3.5 w-80 bg-slate-100 rounded mt-1" />
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200" />
              <div className="h-4 w-40 bg-slate-200 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-100 rounded" />
              <div className="h-3 w-5/6 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
