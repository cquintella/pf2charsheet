import React, { useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { useModalFocus } from '../utils/useModalFocus';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'alert';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  useModalFocus(dialogRef, onCancel);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 animate-fadeIn print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-base font-bold text-text-primary">
          {title}
        </h2>
        <p className="text-sm text-text-secondary whitespace-pre-line">{message}</p>
        <div className="flex justify-end gap-2 pt-1">
          {variant !== 'alert' && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-control hover:bg-control-hover text-sm font-medium text-text-primary border border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {cancelLabel || t('common.cancel')}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              variant === 'danger'
                ? 'bg-status-danger-bg hover:opacity-90 text-status-danger border border-status-danger-border'
                : 'bg-accent hover:bg-accent-hover text-accent-contrast'
            }`}
          >
            {confirmLabel || (variant === 'alert' ? t('common.close') : t('common.save'))}
          </button>
        </div>
      </div>
    </div>
  );
};
