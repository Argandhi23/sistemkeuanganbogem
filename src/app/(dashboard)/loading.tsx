import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 pb-1 border-b border-slate-200/60">
        <div>
          <div className="h-7 w-48 bg-slate-200 rounded-lg" />
          <div className="h-4 w-64 bg-slate-100 rounded-md mt-1.5" />
        </div>
        <div className="h-6 w-32 bg-slate-200 rounded-md" />
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 rounded-2xl p-5 h-40 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <div className="h-3 w-28 bg-slate-700 rounded" />
            <div className="w-4 h-4 bg-slate-700 rounded" />
          </div>
          <div>
            <div className="h-8 w-44 bg-slate-700 rounded-lg mt-2" />
            <div className="h-3 w-24 bg-slate-800 rounded mt-1.5" />
          </div>
          <div className="h-4 w-full bg-slate-800 rounded mt-2" />
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 h-40 flex flex-col justify-between shadow-subtle">
          <div className="flex justify-between items-center">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="w-6 h-6 bg-slate-100 rounded-md" />
          </div>
          <div>
            <div className="h-8 w-40 bg-slate-200 rounded-lg mt-2" />
            <div className="h-3 w-24 bg-slate-100 rounded mt-1.5" />
          </div>
          <div className="h-4 w-full bg-slate-100 rounded mt-2" />
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 h-40 flex flex-col justify-between shadow-subtle">
          <div className="flex justify-between items-center">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="w-6 h-6 bg-slate-100 rounded-md" />
          </div>
          <div>
            <div className="h-8 w-40 bg-slate-200 rounded-lg mt-2" />
            <div className="h-3 w-24 bg-slate-100 rounded mt-1.5" />
          </div>
          <div className="h-4 w-full bg-slate-100 rounded mt-2" />
        </div>
      </div>

      {/* 4 Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 bg-white border border-slate-200/80 rounded-xl flex items-center gap-2.5 shadow-subtle">
            <div className="w-8 h-8 rounded-lg bg-slate-200 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="h-3.5 w-20 bg-slate-200 rounded" />
              <div className="h-2.5 w-28 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-4">
        <div className="space-y-1">
          <div className="h-4 w-48 bg-slate-200 rounded" />
          <div className="h-3 w-64 bg-slate-100 rounded" />
        </div>
        <div className="h-56 bg-slate-50 rounded-xl flex items-end justify-between p-6 gap-4">
          {[40, 70, 55, 90, 65, 80].map((h, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div className="w-full max-w-[32px] bg-slate-200 rounded-t" style={{ height: `${h}%` }} />
              <div className="h-2.5 w-8 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 2 Bottom Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-subtle space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="h-4 w-36 bg-slate-200 rounded" />
              <div className="h-3 w-12 bg-slate-100 rounded" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="h-3.5 w-32 bg-slate-200 rounded" />
                    <div className="h-2.5 w-24 bg-slate-100 rounded" />
                  </div>
                  <div className="h-4 w-20 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
