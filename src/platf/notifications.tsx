"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  variant: "success" | "error" | "info";
  createdAt: number;
  read: boolean;
};

type NotificationsContextValue = {
  items: NotificationItem[];
  unreadCount: number;
  add: (input: Omit<NotificationItem, "id" | "createdAt" | "read">) => void;
  markAllRead: () => void;
  clear: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  function generateId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const add = useCallback<
    NotificationsContextValue["add"]
  >(({ title, description, variant }) => {
    setItems((prev) => {
      const next: NotificationItem = {
        id: generateId(),
        title,
        description,
        variant,
        createdAt: Date.now(),
        read: false,
      };

      return [next, ...prev].slice(0, 20);
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const unreadCount = useMemo(
    () => items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [items],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({ items, unreadCount, add, markAllRead, clear }),
    [add, clear, items, markAllRead, unreadCount],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications debe usarse dentro de NotificationsProvider");
  }
  return ctx;
}
