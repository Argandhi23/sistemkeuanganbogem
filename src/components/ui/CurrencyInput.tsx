'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CurrencyInputProps {
  value?: number | string;
  onChange: (value: number) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
}

export function formatRupiahDisplay(value: number | string): string {
  if (value === '' || value === undefined || value === null || value === 0 || value === '0') return '';
  const num = typeof value === 'string' ? parseInt(value.replace(/\D/g, ''), 10) : value;
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('id-ID');
}

export function CurrencyInput({
  value,
  onChange,
  id,
  name,
  placeholder = '0',
  disabled = false,
  className,
  error,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value !== undefined && value !== null && value !== '') {
      return formatRupiahDisplay(value);
    }
    return '';
  });

  useEffect(() => {
    if (value !== undefined && value !== null && value !== '') {
      setDisplayValue(formatRupiahDisplay(value));
    } else {
      setDisplayValue('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanNumbers = rawVal.replace(/\D/g, '');

    if (!cleanNumbers) {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const numValue = parseInt(cleanNumbers, 10);
    setDisplayValue(numValue.toLocaleString('id-ID'));
    onChange(numValue);
  };

  return (
    <div className="w-full">
      <div className="relative flex items-center">
        <div className="absolute left-0 top-0 bottom-0 pl-3.5 pr-2.5 flex items-center justify-center pointer-events-none select-none">
          <span className="text-slate-400 font-medium text-sm">Rp</span>
        </div>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={twMerge(
            clsx(
              'w-full h-10 pl-10 pr-3 text-sm font-semibold text-slate-900 bg-white border rounded-xl transition-all shadow-subtle focus:outline-none',
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                : 'border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10',
              disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
              className
            )
          )}
        />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>}
    </div>
  );
}
