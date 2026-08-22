'use client';

import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { BigButton } from './BigButton';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title = 'Konfirmasi Tindakan',
  message = 'Apakah Anda yakin ingin melanjutkan tindakan ini?',
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  isDanger = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-elevated border border-slate-200 p-6 sm:p-7"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              isDanger ? 'bg-rose-50 border border-rose-200 text-rose-600' : 'bg-amber-50 border border-amber-200 text-amber-600'
            }`}
          >
            {isDanger ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">{title}</h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 pt-2 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <BigButton
            type="button"
            variant="secondary"
            size="normal"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto"
            icon={<X className="w-4 h-4" />}
          >
            {cancelText}
          </BigButton>

          <BigButton
            type="button"
            variant={isDanger ? 'danger' : 'primary'}
            size="normal"
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Sedang Menghapus..."
            className="w-full sm:w-auto"
            icon={isDanger ? <Trash2 className="w-4 h-4" /> : undefined}
          >
            {confirmText}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
