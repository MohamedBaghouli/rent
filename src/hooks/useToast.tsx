import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type ToastType = "info" | "error" | "success";

export interface Toast {
  id: string;
  message: string;
  title: string;
  type: ToastType;
}

type ToastInput = {
  message?: string;
  title: string;
  type: ToastType;
};

type ToastContextValue = {
  dismiss: (id: string) => void;
  showToast: (toast: ToastInput) => void;
  toasts: Toast[];
};

const ToastContext = createContext<ToastContextValue>({
  dismiss: () => {},
  showToast: () => {},
  toasts: [],
});

const toastDuration = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, title, type }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [{ id, message: message ?? "", title, type }, ...current].slice(0, 3));
      window.setTimeout(() => dismiss(id), toastDuration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ dismiss, showToast, toasts }), [dismiss, showToast, toasts]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  return useContext(ToastContext);
}
