import { useEffect, useRef, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import type { AppNotification } from "@/hooks/useNotifications";

const typeLabels: Record<AppNotification["type"], string> = {
  mileage_threshold: "Kilométrage",
  insurance_expired: "Assurance expirée",
  insurance_soon: "Assurance bientôt",
  technical_visit_expired: "Visite technique expirée",
  technical_visit_soon: "Visite technique bientôt",
};

const typeDotColor: Record<AppNotification["type"], string> = {
  mileage_threshold: "bg-blue-500",
  insurance_expired: "bg-red-500",
  insurance_soon: "bg-amber-500",
  technical_visit_expired: "bg-red-500",
  technical_visit_soon: "bg-amber-500",
};

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleOpen() {
    setOpen((prev) => !prev);
    if (!open && unreadCount > 0) {
      markAllRead();
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md transition-smooth hover:bg-muted"
        onClick={handleOpen}
        type="button"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse-glow">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 animate-fade-in animate-slide-in-up rounded-lg border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground transition-smooth hover:text-destructive"
                onClick={clearAll}
                type="button"
              >
                <Trash2 className="h-3 w-3" />
                Tout effacer
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aucune notification
              </p>
            ) : (
              notifications.map((n, index) => (
                <div
                  className={cn(
                    "animate-fade-in animate-slide-in-up flex gap-3 border-b border-border px-4 py-3 last:border-0 transition-colors duration-300 hover:bg-muted/30",
                    !n.read && "bg-blue-50/50",
                  )}
                  key={n.id}
                  style={{
                    animationDelay: `${index * 30}ms`,
                  }}
                >
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      typeDotColor[n.type],
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {typeLabels[n.type]}
                    </p>
                    <p className="text-sm">{n.message}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
