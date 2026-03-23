"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  badgeCount?: number;
};

function Icon({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center text-zinc-500">
      {children}
    </span>
  );
}

function Section({ title, items }: { title: string; items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/platf") return pathname === "/platf";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="px-3">
      <div className="px-2 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={
              isActive(item.href)
                ? "flex items-center gap-2 rounded-lg bg-white/80 px-2 py-2 text-sm font-semibold text-zinc-900 ring-1 ring-red-200/60"
                : "flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-zinc-700 hover:bg-white/60"
            }
          >
            {item.icon}
            <span className="flex min-w-0 flex-1 items-center gap-2 leading-5">
              <span className="truncate">{item.label}</span>
              {typeof item.badgeCount === "number" && item.badgeCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
                  {item.badgeCount > 99 ? "99+" : item.badgeCount}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (!cancelled) setIsAdmin(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("puesto:puestos(rol:roles(nombre))")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const roleName =
        (data as { puesto?: { rol?: { nombre?: string | null } | null } | null })
          ?.puesto?.rol?.nombre ?? "";
      const admin = roleName.toLowerCase() === "administrador";
      setIsAdmin(admin);

      if (admin) {
        const { count, error: countError } = await supabase
          .from("cotizaciones_pendientes")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendiente");

        if (cancelled) return;
        if (countError) {
          setPendingCount(0);
        } else {
          setPendingCount(count ?? 0);
        }
      } else {
        setPendingCount(0);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const usersItems: NavItem[] = [
    {
      label: "Mi Perfil",
      href: "/platf/perfil",
      icon: (
        <Icon>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-7 16a7 7 0 0 1 14 0H3Z"
              clipRule="evenodd"
            />
          </svg>
        </Icon>
      ),
    },
    {
      label: "Solicitudes de Cambio",
      href: "/platf/admin/solicitudes",
      icon: (
        <Icon>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm1 4a1 1 0 1 0-2 0v4a1 1 0 0 0 .293.707l2 2a1 1 0 1 0 1.414-1.414L11 9.586V6Z"
              clipRule="evenodd"
            />
          </svg>
        </Icon>
      ),
    },
  ];

  if (isAdmin) {
    usersItems.push(
      {
        label: "Gestión de Usuarios",
        href: "/platf/admin/usuarios",
        icon: (
          <Icon>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 0 1 14 0H3Z" />
            </svg>
          </Icon>
        ),
      },
      {
        label: "Roles y Permisos",
        href: "/platf/admin/roles",
        icon: (
          <Icon>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 0 1 .894.553l1.618 3.236 3.57.519a1 1 0 0 1 .554 1.706l-2.584 2.519.61 3.556a1 1 0 0 1-1.451 1.054L10 13.99l-3.191 1.677a1 1 0 0 1-1.451-1.054l.61-3.556L3.384 8.014a1 1 0 0 1 .554-1.706l3.57-.52 1.618-3.235A1 1 0 0 1 10 2Z"
                clipRule="evenodd"
              />
            </svg>
          </Icon>
        ),
      },
      {
        label: "Cotizaciones Pendientes",
        href: "/platf/admin/cotizaciones-pendientes",
        icon: (
          <Icon>
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5a1 1 0 0 0-.293-.707l-3.5-3.5A1 1 0 0 0 11.5 3H6Zm2 6a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z" />
            </svg>
          </Icon>
        ),
      },
    );
  }

  return (
    <aside className="sticky top-0 h-screen w-72 shrink-0 border-r border-red-200/60 bg-brand-soft">
      <div className="h-14 border-b border-red-200/60 bg-white/60" />

      <div className="h-[calc(100vh-3.5rem)] overflow-hidden pb-6">
        <Section
          title="Menú"
          items={[
            {
              label: "Alertas",
              href: "/platf",
              badgeCount: pendingCount,
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M4 5a2 2 0 0 1 2-2h2v2H6v2H4V5Zm10 0a2 2 0 0 0-2-2h-2v2h2v2h2V5ZM4 15a2 2 0 0 0 2 2h2v-2H6v-2H4v2Zm10 2a2 2 0 0 1-2 2h-2v-2h2v-2h2v2ZM7 7h6v6H7V7Z" />
                  </svg>
                </Icon>
              ),
            },
            {
              label: "Cotizaciones",
              href: "/platf/cotizaciones",
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.414A2 2 0 0 0 15.414 5L13 2.586A2 2 0 0 0 11.586 2H6Zm2 7a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Z" />
                  </svg>
                </Icon>
              ),
            },
            {
              label: "Clientes",
              href: "/platf/clientes",
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 18a7 7 0 0 1 14 0H3Z" />
                  </svg>
                </Icon>
              ),
            },
            {
              label: "Tarifas",
              href: "/platf/tarifas",
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M6 3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5a1 1 0 0 0-.293-.707l-3.5-3.5A1 1 0 0 0 11.5 3H6Zm3 7a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Zm0 4a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1Z" />
                  </svg>
                </Icon>
              ),
            },
            {
              label: "Reportes",
              href: "/platf/reportes",
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M3 3a1 1 0 0 1 1 1v11h12a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1Zm5 4a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 2a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Zm4-3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Z" />
                  </svg>
                </Icon>
              ),
            },
            {
              label: "Historial",
              href: "/platf/historial",
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0-8-8 1 1 0 0 0 2 0 6 6 0 1 1 6 6 1 1 0 1 0 0 2Zm1-11a1 1 0 0 0-2 0v3a1 1 0 0 0 .293.707l2 2a1 1 0 1 0 1.414-1.414L11 9.586V7Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Icon>
              ),
            },
            {
              label: "Estadísticas",
              href: "/platf",
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6H3a1 1 0 0 1-1-1v-5Zm6-8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v14H8V3Zm6 5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3V8Z" />
                  </svg>
                </Icon>
              ),
            },
          ]}
        />

        <Section
          title="Soporte"
          items={[
            {
              label: "Soporte",
              href: "/platf/soporte",
              icon: (
                <Icon>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a7 7 0 0 0-7 7v2a3 3 0 0 0 3 3h1a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3a1 1 0 0 1-1-1V9a6 6 0 1 1 12 0v2a1 1 0 0 1-1 1v-3a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1v4a2 2 0 0 1-2 2H9a1 1 0 1 0 0 2h1a4 4 0 0 0 4-4v-.126A3 3 0 0 0 17 11V9a7 7 0 0 0-7-7Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Icon>
              ),
            },
          ]}
        />

        <Section
          title="Usuarios"
          items={usersItems}
        />
      </div>
    </aside>
  );
}
