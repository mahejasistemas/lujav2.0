"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useNotifications } from "@/platf/notifications";

type TopbarProps = {
  base?: string;
  puesto?: string;
  rol?: string;
  nombreCompleto?: string;
  avatarUrl?: string;
};

export function Topbar({ base, puesto, rol, nombreCompleto, avatarUrl }: TopbarProps) {
  const { items, unreadCount, markAllRead, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"nuevas" | "confirmadas" | "rechazadas" | "cp">(
    "nuevas",
  );
  const [now, setNow] = useState(() => Date.now());

  const initials = (nombreCompleto ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const roleLabel = rol ? rol : "—";
  const roleTone =
    roleLabel.toLowerCase() === "administrador"
      ? "bg-white/20 text-white ring-1 ring-white/15"
      : "bg-white/15 text-white/90 ring-1 ring-white/10";

  const visibleItems = useMemo(() => {
    const normalized = items;

    if (tab === "nuevas") {
      return normalized.filter((n) => !n.read).slice(0, 10);
    }

    if (tab === "confirmadas") {
      return normalized.filter((n) => n.variant === "success").slice(0, 10);
    }

    if (tab === "rechazadas") {
      return normalized.filter((n) => n.variant === "error").slice(0, 10);
    }

    return normalized.filter((n) => n.variant === "info").slice(0, 10);
  }, [items, tab]);

  const tabCounts = useMemo(() => {
    return {
      nuevas: unreadCount,
      confirmadas: items.filter((n) => n.variant === "success").length,
      rechazadas: items.filter((n) => n.variant === "error").length,
      cp: items.filter((n) => n.variant === "info").length,
    };
  }, [items, unreadCount]);

  function timeAgo(createdAt: number) {
    const diff = Math.max(0, now - createdAt);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} d`;
    if (hours > 0) return `${hours} h`;
    if (minutes > 0) return `${minutes} min`;
    return `${seconds} s`;
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 h-14 border-b border-brand-hover bg-brand">
      <div className="flex h-full w-full items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 items-center gap-3 text-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl ">
            <Image src="/tls.svg" alt="TLS" width={70} height={70} priority />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-white">
            <span className="min-w-0 truncate font-medium">
              {base ? base : "—"}
            </span>
            <span className="text-white/50">/</span>
            <span className="min-w-0 truncate text-white/90">{puesto ? puesto : "—"}</span>
            <span className="text-white/50">/</span>
            <span className="min-w-0 truncate text-white/90">
              {nombreCompleto ? nombreCompleto : "—"}
            </span>
          </div>

          <svg
            className="h-4 w-4 shrink-0 text-white/70"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleTone}`}>
            {roleLabel}
          </span>
          <div className="relative">
            <button
              type="button"
              className={
                open
                  ? "relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white ring-2 ring-white/20 transition-colors"
                  : "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15"
              }
              aria-label="Notificaciones"
              aria-expanded={open}
              onClick={() => {
                setOpen((v) => {
                  const next = !v;
                  if (next) setNow(Date.now());
                  return next;
                });
              }}
            >
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold leading-4 text-brand">
                  {unreadCount > 9 ? "9+" : String(unreadCount)}
                </span>
              ) : null}
              <svg
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 2a5 5 0 0 0-5 5v2.586l-.707.707A1 1 0 0 0 4 12.414V14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.586a1 1 0 0 0-.293-.707L15 9.586V7a5 5 0 0 0-5-5Z" />
                <path d="M8.5 16a1.5 1.5 0 0 0 3 0h-3Z" />
              </svg>
            </button>

            {open ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label="Cerrar notificaciones"
                  onClick={() => setOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-2 w-[420px] overflow-hidden rounded-2xl border border-black/[.08] bg-white shadow-lg">
                  <div className="flex items-center justify-between px-4 pb-3 pt-4">
                    <div className="text-sm font-semibold text-zinc-900">
                      Notificaciones
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 hover:bg-black/[.04]"
                        aria-label="Marcar todo como leído"
                        onClick={() => {
                          markAllRead();
                          clear();
                        }}
                        disabled={items.length === 0}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.28a1 1 0 0 1-1.42.004L3.29 9.21a1 1 0 1 1 1.42-1.4l3.07 3.113 6.49-6.56a1 1 0 0 1 1.414-.006Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 rounded-xl bg-brand-soft p-1 text-xs font-semibold text-zinc-700 ring-1 ring-red-200/60">
                      <button
                        type="button"
                        className={
                          tab === "nuevas"
                            ? "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-zinc-900 shadow-sm ring-1 ring-red-200/60"
                            : "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/60"
                        }
                        onClick={() => setTab("nuevas")}
                      >
                        Nuevas
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-red-700 ring-1 ring-red-200/60">
                          {tabCounts.nuevas}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={
                          tab === "confirmadas"
                            ? "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-zinc-900 shadow-sm ring-1 ring-red-200/60"
                            : "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/60"
                        }
                        onClick={() => setTab("confirmadas")}
                      >
                        Confirmadas
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-red-700 ring-1 ring-red-200/60">
                          {tabCounts.confirmadas}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={
                          tab === "rechazadas"
                            ? "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-zinc-900 shadow-sm ring-1 ring-red-200/60"
                            : "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/60"
                        }
                        onClick={() => setTab("rechazadas")}
                      >
                        Rechazadas
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-red-700 ring-1 ring-red-200/60">
                          {tabCounts.rechazadas}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={
                          tab === "cp"
                            ? "flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-zinc-900 shadow-sm ring-1 ring-red-200/60"
                            : "flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-white/60"
                        }
                        onClick={() => setTab("cp")}
                      >
                        Cp
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-red-700 ring-1 ring-red-200/60">
                          {tabCounts.cp}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[440px] overflow-y-auto">
                    {visibleItems.length === 0 ? (
                      <div className="px-4 pb-10 text-center text-sm text-zinc-600">
                        Sin notificaciones
                      </div>
                    ) : (
                      <div className="divide-y divide-dashed divide-black/[.10]">
                        {visibleItems.map((n) => (
                          <div key={n.id} className="px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm text-zinc-900">
                                  <span className="font-semibold">
                                    {n.title}
                                  </span>
                                </div>
                                {n.description ? (
                                  <div className="mt-1 text-sm text-zinc-600">
                                    {n.description}
                                  </div>
                                ) : null}
                              </div>
                              <div className="shrink-0 text-xs text-zinc-500">
                                {timeAgo(n.createdAt)} ago
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <Link
            href="/platf/perfil"
            className="inline-flex items-center gap-2 rounded-full px-2 py-1 hover:bg-black/[.04]"
            aria-label="Cuenta"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-black/[.08] bg-white text-xs font-semibold text-zinc-700">
              {avatarUrl ? (
                <span className="relative h-full w-full">
                  <span className="absolute inset-0.5">
                    <Image
                      src={avatarUrl}
                      alt="Foto de perfil"
                      fill
                      sizes="32px"
                      className="object-contain"
                    />
                  </span>
                </span>
              ) : (
                <span className="inline-flex h-full w-full items-center justify-center bg-emerald-600 text-white">
                  {initials || "ME"}
                </span>
              )}
            </span>
            <svg
              className="h-4 w-4 text-zinc-500"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.24 4.5a.75.75 0 0 1-1.08 0l-4.24-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
