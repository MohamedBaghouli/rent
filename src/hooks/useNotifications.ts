import { createContext, useCallback, useContext, useState } from "react";

export type NotificationType =
  | "mileage_threshold"
  | "insurance_expired"
  | "insurance_soon"
  | "technical_visit_expired"
  | "technical_visit_soon";

export interface AppNotification {
  id: string;
  type: NotificationType;
  message: string;
  carId?: number;
  createdAt: string;
  read: boolean;
}

const STORAGE_KEY = "rdesk_notifications";
const MAX_NOTIFICATIONS = 100;

function load(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function save(notifications: AppNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  push: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  push: () => {},
  markAllRead: () => {},
  clearAll: () => {},
});

export function useNotificationsState(): NotificationsContextValue {
  const [notifications, setNotifications] = useState<AppNotification[]>(load);

  const push = useCallback((notification: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications((prev) => {
      const today = new Date().toISOString().slice(0, 10);
      const duplicate = prev.some(
        (n) =>
          n.type === notification.type &&
          n.carId === notification.carId &&
          n.createdAt.startsWith(today),
      );
      if (duplicate) return prev;

      const newNotification: AppNotification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        read: false,
      };
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      save(updated);
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      save(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    save([]);
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    push,
    markAllRead,
    clearAll,
  };
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
