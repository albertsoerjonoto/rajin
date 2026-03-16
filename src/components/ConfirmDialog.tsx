'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-dialog px-6 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-2xl p-5 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-primary mb-1">{title}</h3>
        <p className="text-sm text-text-secondary mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-text-muted bg-surface-secondary rounded-xl hover:bg-surface-hover transition-colors duration-200"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-danger rounded-xl hover:bg-danger-hover transition-colors duration-200"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
