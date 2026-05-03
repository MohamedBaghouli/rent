import { CarFront } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <CarFront className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold uppercase tracking-normal text-foreground">AGENCE DE LOCATION</p>
          <p className="truncate text-xs font-medium text-muted-foreground">Ahmed Mahjoub</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <button
          aria-label="Profil utilisateur"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-primary transition-smooth hover:bg-blue-50"
          type="button"
        >
          AM
        </button>
      </div>
    </header>
  );
}
