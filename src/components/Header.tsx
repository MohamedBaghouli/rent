import { NotificationBell } from "@/components/NotificationBell";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-4 md:px-6">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Agence de location</p>
        <h1 className="text-lg font-semibold">Gestion opérationnelle</h1>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
      </div>
    </header>
  );
}
