import { NavLink } from "react-router-dom";
import { appName, navigationItems } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-white md:block">
      <div className="flex h-16 items-center border-b border-border px-6">
        <span className="text-lg font-semibold text-primary">{appName}</span>
      </div>
      <nav className="space-y-1 p-3">
        {navigationItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition",
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted hover:text-foreground",
              )
            }
            end={item.path === "/"}
            key={item.path}
            to={item.path}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
