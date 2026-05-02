import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { ToastViewport } from "@/components/ToastViewport";
import { PageTransition } from "@/components/PageTransition";
import { NotificationsContext, useNotificationsState } from "@/hooks/useNotifications";
import { ToastProvider } from "@/hooks/useToast";

export function App() {
  const notificationsValue = useNotificationsState();

  return (
    <NotificationsContext.Provider value={notificationsValue}>
      <ToastProvider>
        <div className="flex min-h-screen overflow-x-hidden bg-background">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">
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
