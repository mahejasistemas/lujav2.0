"use client";

import { NotificationsProvider } from "@/platf/notifications";

export function PlatfProviders({ children }: { children: React.ReactNode }) {
  return <NotificationsProvider>{children}</NotificationsProvider>;
}

