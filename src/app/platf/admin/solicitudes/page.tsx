"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "@/platf/Sidebar";
import { Topbar } from "@/platf/Topbar";

type BaseRow = { id: number; nombre: string };
type PuestoRow = { id: number; nombre: string };

type ProfileForRole = {
  nombre: string | null;
  apellido: string | null;
  base: { nombre: string } | null;
  puesto: { nombre: string; rol: { nombre: string } | null } | null;
  avatar_url?: string | null;
};

type RequestRow = {
  id: number;
  requester_user_id: string;
  current_base_id: number | null;
  current_puesto_id: number | null;
  requested_base_id: number | null;
  requested_puesto_id: number | null;
  status: string;
  created_at: string;
};

export default function SolicitudesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [base, setBase] = useState("");
  const [puesto, setPuesto] = useState("");
  const [rol, setRol] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [bases, setBases] = useState<BaseRow[]>([]);
  const [puestos, setPuestos] = useState<PuestoRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [decisions, setDecisions] = useState<Record<number, { baseId: string; puestoId: string }>>({});

  const pendingRequests = useMemo(() => {
    return requests.filter((r) => (r.status || "").toLowerCase() === "pending");
  }, [requests]);

  function baseName(id: number | null) {
    if (!id) return "—";
    return bases.find((b) => b.id === id)?.nombre ?? `#${id}`;
  }

  function puestoName(id: number | null) {
    if (!id) return "—";
    return puestos.find((p) => p.id === id)?.nombre ?? `#${id}`;
  }

  async function reloadRequests() {
    setErrorMessage("");
    const { data, error } = await supabase.rpc("list_org_change_requests");

    if (error) {
      setErrorMessage(
        "No se pudieron cargar solicitudes (revisa la función list_org_change_requests).",
      );
      setRequests([]);
      return;
    }

    const rows = (data as RequestRow[] | null) ?? [];
    setRequests(rows);

    const nextDecisions: Record<number, { baseId: string; puestoId: string }> = {};
    for (const r of rows) {
      nextDecisions[r.id] = {
        baseId: r.requested_base_id ? String(r.requested_base_id) : "",
        puestoId: r.requested_puesto_id ? String(r.requested_puesto_id) : "",
      };
    }
    setDecisions(nextDecisions);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const [{ data: basesData }, { data: puestosData }] = await Promise.all([
        supabase.from("bases").select("id,nombre").order("nombre"),
        supabase.from("puestos").select("id,nombre").order("nombre"),
      ]);

      if (cancelled) return;

      setBases((basesData as BaseRow[] | null) ?? []);
      setPuestos((puestosData as PuestoRow[] | null) ?? []);

      const { data: profileWithAvatar, error: avatarErr } = await supabase
        .from("profiles")
        .select(
          "nombre,apellido,avatar_url,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      let profile: ProfileForRole | null = profileWithAvatar as ProfileForRole | null;

      if (avatarErr) {
        const { data: profileNoAvatar } = await supabase
          .from("profiles")
          .select("nombre,apellido,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))")
          .eq("user_id", user.id)
          .maybeSingle();
        profile = profileNoAvatar as ProfileForRole | null;
      }

      const roleName = profile?.puesto?.rol?.nombre ?? "";
      const isAdmin = roleName.toLowerCase() === "administrador";

      if (!isAdmin) {
        router.replace("/platf");
        return;
      }

      const metadata = user.user_metadata as Partial<{
        nombre: string;
        apellido: string;
        avatar_url: string;
      }>;

      setBase(profile?.base?.nombre ?? "");
      setPuesto(profile?.puesto?.nombre ?? "");
      setRol(roleName);
      setNombreCompleto(
        `${profile?.nombre ?? metadata.nombre ?? ""} ${profile?.apellido ?? metadata.apellido ?? ""}`.trim(),
      );
      const baseAvatarUrl = profile?.avatar_url ?? metadata.avatar_url ?? "";
      setAvatarUrl(baseAvatarUrl ? `${baseAvatarUrl}?v=${Date.now()}` : "");

      await reloadRequests();

      if (cancelled) return;
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function decide(requestId: number, decision: "approved" | "rejected") {
    setErrorMessage("");
    const choice = decisions[requestId];

    const decided_base_id = choice?.baseId ? Number(choice.baseId) : null;
    const decided_puesto_id = choice?.puestoId ? Number(choice.puestoId) : null;

    const { error } = await supabase.rpc("decide_org_change", {
      request_id: requestId,
      decision,
      decided_base_id,
      decided_puesto_id,
    });

    if (error) {
      setErrorMessage(
        "No se pudo procesar la solicitud (revisa la función decide_org_change).",
      );
      return;
    }

    await reloadRequests();
  }

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
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-zinc-900">
                  Solicitudes de cambio
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Autoriza cambios de base/puesto de los usuarios.
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-xl border border-black/[.08] bg-white px-4 py-3 text-sm text-zinc-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="rounded-2xl border border-black/[.08] bg-white p-10 text-center">
                  <div className="text-sm font-medium text-zinc-900">
                    No hay solicitudes pendientes
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    Cuando un usuario pida un cambio, aparecerá aquí.
                  </div>
                </div>
              ) : null}

              {pendingRequests.map((r) => {
                const choice = decisions[r.id] ?? { baseId: "", puestoId: "" };

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-black/[.08] bg-white p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          Solicitud #{r.id}
                        </div>
                        <div className="mt-1 text-sm text-zinc-600">
                          Usuario:{" "}
                          <span className="font-medium text-zinc-900">
                            {r.requester_user_id}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                          <div>
                            <span className="text-zinc-500">Actual:</span>{" "}
                            {baseName(r.current_base_id)} /{" "}
                            {puestoName(r.current_puesto_id)}
                          </div>
                          <div>
                            <span className="text-zinc-500">Solicitado:</span>{" "}
                            {baseName(r.requested_base_id)} /{" "}
                            {puestoName(r.requested_puesto_id)}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:items-end">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Decisión
                        </div>
                        <div className="grid w-full grid-cols-1 gap-2 sm:w-[360px] sm:grid-cols-2">
                          <select
                            value={choice.baseId}
                            onChange={(e) =>
                              setDecisions((prev) => ({
                                ...prev,
                                [r.id]: { ...choice, baseId: e.target.value },
                              }))
                            }
                            className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                          >
                            <option value="">Base</option>
                            {bases.map((b) => (
                              <option key={b.id} value={String(b.id)}>
                                {b.nombre}
                              </option>
                            ))}
                          </select>
                          <select
                            value={choice.puestoId}
                            onChange={(e) =>
                              setDecisions((prev) => ({
                                ...prev,
                                [r.id]: { ...choice, puestoId: e.target.value },
                              }))
                            }
                            className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                          >
                            <option value="">Puesto</option>
                            {puestos.map((p) => (
                              <option key={p.id} value={String(p.id)}>
                                {p.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mt-2 flex w-full gap-2 sm:w-auto">
                          <button
                            type="button"
                            onClick={() => void decide(r.id, "rejected")}
                            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            onClick={() => void decide(r.id, "approved")}
                            className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
                          >
                            Aprobar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
