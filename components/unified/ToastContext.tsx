import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  id?: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastEntry extends Required<ToastOptions> {
  id: string;
  dismissAt: number;
}

interface ToastContextValue {
  notify: (options: ToastOptions) => string;
  dismiss: (toastId: string) => void;
  toasts: ToastEntry[];
}

const DEFAULT_DURATION = 6000;
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

function buildToast(options: ToastOptions): ToastEntry {
  const now = Date.now();
  const id = options.id || `toast-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const duration = options.durationMs ?? DEFAULT_DURATION;

  return {
    id,
    title: options.title ?? '',
    description: options.description ?? '',
    variant: options.variant ?? 'info',
    durationMs: duration,
    actionLabel: options.actionLabel ?? '',
    onAction: options.onAction ?? (() => {}),
    dismissAt: now + duration,
  };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  const notify = useCallback(
    (options: ToastOptions) => {
      const toast = buildToast(options);
      setToasts(prev => [...prev, toast]);

      if (toast.durationMs > 0) {
        window.setTimeout(() => dismiss(toast.id), toast.durationMs);
      }

      return toast.id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify, dismiss, toasts }), [notify, dismiss, toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastViewportProps {
  toasts: ToastEntry[];
  onDismiss: (toastId: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none flex flex-col items-end gap-3 px-6 py-6 z-[9999]">
      <div className="ml-auto w-full max-w-sm space-y-3">
        {toasts.map(toast => (
          <article
            key={toast.id}
            className="pointer-events-auto rounded-xl border border-gray-200 shadow-lg bg-white/95 backdrop-blur-sm px-4 py-3 flex flex-col gap-1 transition-transform duration-200 ease-out translate-x-0"
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                {toast.title && (
                  <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
                )}
                {toast.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-line">{toast.description}</p>
                )}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </header>
            <footer className="flex items-center justify-between text-xs">
              <span className={variantColorClass(toast.variant)}>
                {variantLabel(toast.variant)}
              </span>
              {toast.actionLabel && (
                <button
                  onClick={() => {
                    toast.onAction();
                    onDismiss(toast.id);
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {toast.actionLabel}
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}

function variantLabel(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'Success';
    case 'warning':
      return 'Needs attention';
    case 'error':
      return 'Error';
    default:
      return 'Notice';
  }
}

function variantColorClass(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return 'text-green-600';
    case 'warning':
      return 'text-amber-600';
    case 'error':
      return 'text-red-600';
    default:
      return 'text-blue-600';
  }
}
