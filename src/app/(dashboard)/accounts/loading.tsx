import React from 'react';

export default function AccountsLoading() {
  return (
    <div className="space-y-5 max-w-6xl mx-auto animate-pulse">
      <div className="h-10 bg-slate-200 rounded-xl w-1/3" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="h-20 bg-slate-100 rounded-xl" />
        <div className="h-20 bg-slate-100 rounded-xl" />
        <div className="h-20 bg-slate-100 rounded-xl" />
        <div className="h-20 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-80 bg-slate-100 rounded-2xl" />
    </div>
  );
}
