import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BigButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'income' | 'expense' | 'outline' | 'ghost';
  size?: 'small' | 'normal' | 'large';
  icon?: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

export function BigButton({
  children,
  className,
  variant = 'primary',
  size = 'normal',
  icon,
  isLoading = false,
  loadingText = 'Memproses...',
  fullWidth = false,
  disabled,
  ...props
}: BigButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 rounded-xl select-none';

  const sizeStyles = {
    small: 'h-8 px-3 text-xs gap-1.5',
    normal: 'h-9 sm:h-10 px-4 text-xs sm:text-sm gap-2 shadow-subtle',
    large: 'h-11 px-5 text-sm sm:text-base gap-2.5 shadow-subtle',
  };

  const variantStyles = {
    primary:
      'bg-slate-900 hover:bg-slate-800 text-white focus-visible:ring-slate-900',
    secondary:
      'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-400',
    outline:
      'bg-transparent text-emerald-800 border border-emerald-300 hover:bg-emerald-50 focus-visible:ring-emerald-500',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500',
    income:
      'bg-emerald-600 hover:bg-emerald-700 text-white focus-visible:ring-emerald-500',
    expense:
      'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500',
  };

  return (
    <button
      className={twMerge(
        clsx(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          fullWidth && 'w-full',
          className
        )
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon && <span className="flex-shrink-0 flex items-center justify-center">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </button>
  );
}
