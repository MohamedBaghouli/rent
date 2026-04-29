import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-4 md:px-6">
      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Agence de location</p>
        <h1 className="text-lg font-semibold">Gestion opérationnelle</h1>
      </div>
      <div className="hidden w-72 items-center gap-2 rounded-md border border-input bg-white px-3 md:flex">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input className="border-0 px-0 focus:ring-0" placeholder="Recherche globale" />
      </div>
    </header>
  );
}
