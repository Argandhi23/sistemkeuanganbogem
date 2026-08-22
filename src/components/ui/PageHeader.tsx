'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = 'Kembali',
  action,
}: PageHeaderProps) {
  return (
    <div className="mb-6 pb-4 border-b border-slate-200/70">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 mb-2 text-slate-500 hover:text-slate-900 font-medium text-xs py-1 px-2.5 -ml-2.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{backLabel}</span>
        </Link>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {action && <div className="flex-shrink-0 flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
