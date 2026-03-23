"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "@/platf/Sidebar";
import { Topbar } from "@/platf/Topbar";

type BaseRow = { id: number; nombre: string };

type ProfileRow = {
  user_id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  base: { id: number; nombre: string } | null;
  puesto: { nombre: string; rol: { nombre: string } | null } | null;
};

type ViewerProfileRow = {
  nombre: string | null;
  apellido: string | null;
  avatar_url?: string | null;
  base: { nombre: string } | null;
  puesto: { nombre: string; rol: { nombre: string } | null } | null;
};

export default function AdminUsuariosPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [base, setBase] = useState<string>("");
  const [puesto, setPuesto] = useState<string>("");
  const [rol, setRol] = useState<string>("");
  const [nombreCompleto, setNombreCompleto] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const [bases, setBases] = useState<BaseRow[]>([]);
  const [baseFilter, setBaseFilter] = useState<string>("");
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: basesData }, viewerRes] = await Promise.all([
        supabase.from("bases").select("id,nombre").order("nombre"),
        supabase
          .from("profiles")
          .select(
            "nombre,apellido,avatar_url,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      setBases((basesData as BaseRow[] | null) ?? []);

      const viewerProfile = (viewerRes.data as ViewerProfileRow | null) ?? null;
      const roleName = viewerProfile?.puesto?.rol?.nombre ?? "";
      const isAdmin = roleName.toLowerCase() === "administrador";

      if (!isAdmin) {
        router.replace("/platf");
        return;
      }

      const metadata = user.user_metadata as Partial<{
        nombre: string;
        apellido: string;
      }>;

      const fullName =
        `${viewerProfile?.nombre ?? metadata.nombre ?? ""} ${viewerProfile?.apellido ?? metadata.apellido ?? ""}`.trim();

      setBase(viewerProfile?.base?.nombre ?? "");
      setPuesto(viewerProfile?.puesto?.nombre ?? "");
      setRol(roleName);
      setNombreCompleto(fullName);
      const baseAvatarUrl =
        viewerProfile?.avatar_url ??
        (user.user_metadata as { avatar_url?: string }).avatar_url ??
        "";
      setAvatarUrl(baseAvatarUrl ? `${baseAvatarUrl}?v=${Date.now()}` : "");
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setErrorMessage("");
      setUsersLoading(true);

      let q = supabase
        .from("profiles")
        .select(
          "user_id,nombre,apellido,telefono,base:bases(id,nombre),puesto:puestos(nombre,rol:roles(nombre))",
        )
        .order("apellido", { ascending: true })
        .order("nombre", { ascending: true });

      if (baseFilter) {
        q = q.eq("base_id", Number(baseFilter));
      }

      const { data, error } = await q;

      if (cancelled) return;

      if (error) {
        setUsersLoading(false);
        setErrorMessage(
          "No se pudo cargar la lista de usuarios. Revisa RLS de profiles para rol Administrador.",
        );
        return;
      }

      const raw = (data as unknown[] | null) ?? [];
      const normalized: ProfileRow[] = raw.map((r) => {
        const row = r as {
          user_id: unknown;
          nombre?: unknown;
          apellido?: unknown;
          telefono?: unknown;
          base?: unknown;
          puesto?: unknown;
        };

        const baseVal = Array.isArray(row.base)
          ? (row.base[0] as ProfileRow["base"] | undefined) ?? null
          : ((row.base as ProfileRow["base"] | undefined) ?? null);

        let puestoVal = Array.isArray(row.puesto)
          ? (row.puesto[0] as ProfileRow["puesto"] | undefined) ?? null
          : ((row.puesto as ProfileRow["puesto"] | undefined) ?? null);

        if (puestoVal && Array.isArray((puestoVal as unknown as { rol?: unknown }).rol)) {
          const rolArr = (puestoVal as unknown as { rol: unknown[] }).rol;
          puestoVal = {
            ...(puestoVal as { nombre: string; rol: unknown }),
            rol: (rolArr[0] as { nombre: string } | undefined) ?? null,
          };
        }

        return {
          user_id: String(row.user_id ?? ""),
          nombre: (row.nombre as string | null | undefined) ?? null,
          apellido: (row.apellido as string | null | undefined) ?? null,
          telefono: (row.telefono as string | null | undefined) ?? null,
          base: baseVal,
          puesto: puestoVal,
        };
      });

      setUsers(normalized);
      setUsersLoading(false);
    }

    if (!loading) void loadUsers();

    return () => {
      cancelled = true;
    };
  }, [baseFilter, loading]);

  const baseName = useMemo(() => {
    if (!baseFilter) return "Todas";
    return bases.find((b) => String(b.id) === baseFilter)?.nombre ?? "—";
  }, [baseFilter, bases]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-sm text-zinc-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          base={base}
          puesto={puesto}
          rol={rol}
          nombreCompleto={nombreCompleto}
          avatarUrl={avatarUrl}
        />

        <div className="flex-1 bg-zinc-50 p-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Gestión de Usuarios
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Lista de usuarios dados de alta por base.
                </p>
              </div>

              <div className="w-full sm:w-[320px]">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Base
                  </span>
                  <select
                    value={baseFilter}
                    onChange={(e) => setBaseFilter(e.target.value)}
                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                    disabled={usersLoading}
                  >
                    <option value="">Todas</option>
                    {bases.map((b) => (
                      <option key={b.id} value={String(b.id)}>
                        {b.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-zinc-900">
                  Usuarios · {baseName}
                </div>
                <div className="text-sm text-zinc-600">
                  {usersLoading ? "Cargando..." : `${users.length} usuarios`}
                </div>
              </div>

              {errorMessage ? (
                <div className="mt-4 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  {errorMessage}
                </div>
              ) : null}

              {!usersLoading && !errorMessage && users.length === 0 ? (
                <div className="mt-6 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-6 text-center">
                  <div className="text-sm font-medium text-zinc-900">
                    No hay usuarios
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    No se encontraron perfiles para esta base.
                  </div>
                </div>
              ) : null}

              {users.length > 0 ? (
                <div className="mt-6 overflow-hidden rounded-2xl border border-black/[.08]">
                  <div className="grid grid-cols-6 gap-0 bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <div className="col-span-2">Usuario</div>
                    <div className="col-span-1">Base</div>
                    <div className="col-span-1">Puesto</div>
                    <div className="col-span-1">Rol</div>
                    <div className="col-span-1">Teléfono</div>
                  </div>
                  <div className="divide-y divide-black/[.08] bg-white">
                    {users.map((u) => {
                      const full =
                        `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() ||
                        "—";
                      const baseLabel = u.base?.nombre ?? "—";
                      const puestoLabel = u.puesto?.nombre ?? "—";
                      const rolLabel = u.puesto?.rol?.nombre ?? "—";
                      const tel = u.telefono ?? "—";
                      return (
                        <div
                          key={u.user_id}
                          className="grid grid-cols-6 gap-0 px-4 py-3 text-sm text-zinc-700"
                        >
                          <div className="col-span-2 min-w-0">
                            <div className="truncate font-medium text-zinc-900">
                              {full}
                            </div>
                            <div className="truncate text-xs text-zinc-500">
                              {u.user_id}
                            </div>
                          </div>
                          <div className="col-span-1 truncate">{baseLabel}</div>
                          <div className="col-span-1 truncate">{puestoLabel}</div>
                          <div className="col-span-1 truncate">{rolLabel}</div>
                          <div className="col-span-1 truncate">{tel}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
