import { useEffect, useRef, useState } from "react";
import { Check, CircleUserRound, Menu, Moon, Sun } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark";

const themeStorageKey = "rentaldesk:theme";

export function Header({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-2 dark:bg-slate-900 md:px-2 md:pr-6">
      <div className="flex min-w-0 items-center gap-1">
        <button
          aria-label="Réduire ou ouvrir le menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-muted hover:text-foreground"
          onClick={onToggleSidebar}
          type="button"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <ThemeMenu />
        <button
          aria-label="Profil utilisateur"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary transition-smooth hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
          type="button"
        >
          <CircleUserRound className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const ActiveIcon = theme === "dark" ? Moon : Sun;

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Changer le thème"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-muted-foreground transition-smooth hover:bg-blue-50 hover:text-primary dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <ActiveIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 animate-fade-in rounded-lg border border-border bg-white p-1 shadow-xl dark:bg-slate-900">
          <ThemeOption icon={Sun} label="Clair" mode="light" selected={theme === "light"} setTheme={setTheme} />
          <ThemeOption icon={Moon} label="Sombre" mode="dark" selected={theme === "dark"} setTheme={setTheme} />
        </div>
      )}
    </div>
  );
}

function ThemeOption({
  icon: Icon,
  label,
  mode,
  selected,
  setTheme,
}: {
  icon: typeof Sun;
  label: string;
  mode: ThemeMode;
  selected: boolean;
  setTheme: (theme: ThemeMode) => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold transition-smooth",
        selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
      onClick={() => setTheme(mode)}
      type="button"
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {selected && <Check className="h-4 w-4" />}
    </button>
  );
}

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(themeStorageKey);
  return stored === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
