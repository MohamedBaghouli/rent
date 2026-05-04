import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ToastViewport } from "@/components/ToastViewport";
import { PageTransition } from "@/components/PageTransition";
import { NotificationsContext, useNotificationsState } from "@/hooks/useNotifications";
import { ToastProvider } from "@/hooks/useToast";

export function App() {
  const notificationsValue = useNotificationsState();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("rentaldesk:sidebar-collapsed") === "true";
  });

  useEffect(() => {
    window.localStorage.setItem("rentaldesk:sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <NotificationsContext.Provider value={notificationsValue}>
      <ToastProvider>
        <div className="min-h-screen overflow-hidden bg-background">
          <Sidebar collapsed={sidebarCollapsed} />
          <div className={`flex h-screen min-w-0 flex-col transition-smooth ${sidebarCollapsed ? "md:pl-16" : "md:pl-52"}`}>
            <Header onToggleSidebar={() => setSidebarCollapsed((current) => !current)} />
            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
              <PageTransition>
                <Outlet />
              </PageTransition>
            </main>
          </div>
        </div>
        <ToastViewport />
      </ToastProvider>
    </NotificationsContext.Provider>
  );
}
