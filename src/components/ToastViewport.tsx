import { AlertCircle, Check, Info, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToast, type ToastType } from "@/hooks/useToast";

const toastStyles: Record<ToastType, string> = {
  error: "bg-red-500 text-white",
  info: "bg-blue-500 text-white",
  success: "bg-green-500 text-white",
};

const toastIcons = {
  error: AlertCircle,
  info: Info,
  success: Check,
};

export function ToastViewport() {
  const { dismiss, toasts } = useToast();
  const [exitingToasts, setExitingToasts] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    setExitingToasts((prev) => new Set(prev).add(id));
    setTimeout(() => {
      dismiss(id);
      setExitingToasts((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300); // Match animation duration
  };

  useEffect(() => {
    if (!toasts.length) {
      setExitingToasts(new Set());
    }
  }, [toasts]);

  if (!toasts.length) return null;

  return (
    <div className="fixed left-1/2 top-5 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-3">
      {toasts.map((toast, index) => {
        const Icon = toastIcons[toast.type];
        const isExiting = exitingToasts.has(toast.id);

        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-4 rounded-2xl px-6 py-5 shadow-lg",
              "animate-slide-in-right",
              isExiting && "animate-slide-out-right",
              toastStyles[toast.type],
            )}
            style={{
              animationDelay: !isExiting ? `${index * 50}ms` : "0ms",
            }}
            role={toast.type === "error" ? "alert" : "status"}
          >
            <Icon className="mt-0.5 h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-6">{toast.title}</p>
              {toast.message && <p className="mt-1 text-sm text-white/90">{toast.message}</p>}
            </div>
            <button
              aria-label="Fermer"
              className="-mr-1 rounded-md p-1 transition-smooth hover:bg-white/15"
              onClick={() => handleDismiss(toast.id)}
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
