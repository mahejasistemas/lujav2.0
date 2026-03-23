"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "@/platf/Sidebar";
import { Topbar } from "@/platf/Topbar";

type ViewerProfileRow = {
  nombre: string | null;
  apellido: string | null;
  avatar_url?: string | null;
  base: { nombre: string } | null;
  puesto: { nombre: string; rol: { nombre: string } | null } | null;
};

type PendingRow = {
  id: string;
  created_at: string;
  folio: string;
  origen: string;
  destino: string;
  moneda: string;
  total: number;
  enviado_por: string;
  status: string;
};

function formatMoney(value: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${moneda}`;
  }
}

export default function CotizacionesPendientesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState("");
  const [puesto, setPuesto] = useState("");
  const [rol, setRol] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [rows, setRows] = useState<PendingRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [savingId, setSavingId] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  function statusNormalized(status: string) {
    const s = (status || "").trim().toLowerCase();
    if (s === "aceptadas") return "aceptada";
    if (s === "no exitosa") return "no_exitosa";
    return s;
  }

  async function reload() {
    setErrorMessage("");
    const { data, error } = await supabase
      .from("cotizaciones_pendientes")
      .select("id,created_at,folio,origen,destino,moneda,total,enviado_por,status")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      setRows([]);
      setErrorMessage(
        "No se pudieron cargar cotizaciones pendientes (revisa la tabla cotizaciones_pendientes y sus permisos).",
      );
      return;
    }

    setRows((data as PendingRow[] | null) ?? []);
  }

  async function updateStatus(
    id: string,
    nextStatus: "aceptada" | "rechazada" | "exitosa" | "no_exitosa",
  ) {
    setSaveMessage("");
    setSaveError("");
    setSavingId(id);

    const { data, error } = await supabase
      .from("cotizaciones_pendientes")
      .update({ status: nextStatus })
      .eq("id", id)
      .select("id,status")
      .maybeSingle();

    if (error) {
      setSavingId("");
      setSaveError(
        error.message ||
          "No se pudo actualizar el estatus (revisa permisos/RLS de cotizaciones_pendientes).",
      );
      return;
    }

    if (!data) {
      setSavingId("");
      setSaveError(
        "No se pudo actualizar el estatus (0 filas afectadas). Esto suele indicar RLS/policies (UPDATE) o que la fila no es visible para el usuario.",
      );
      await reload();
      return;
    }

    const actual = statusNormalized(
      String((data as { status?: unknown } | null)?.status ?? ""),
    );
    if (actual && actual !== nextStatus) {
      setSavingId("");
      setSaveError(
        `Se intentó guardar "${nextStatus}", pero la base devolvió "${actual}". Revisa RLS/triggers.`,
      );
      await reload();
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: actual || nextStatus } : r,
      ),
    );
    setSavingId("");
    setSaveMessage("Estatus actualizado.");
    await reload();
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

      const { data: profileWithAvatar } = await supabase
        .from("profiles")
        .select(
          "nombre,apellido,avatar_url,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      const profile = (profileWithAvatar as ViewerProfileRow | null) ?? null;
      const roleName = profile?.puesto?.rol?.nombre ?? "";
      const isAdmin = roleName.toLowerCase() === "administrador";

      if (!isAdmin) {
        router.replace("/platf");
        return;
      }

      if (cancelled) return;

      const metadata = user.user_metadata as Partial<{ nombre: string; apellido: string }>;
      const fullName =
        `${profile?.nombre ?? metadata.nombre ?? ""} ${profile?.apellido ?? metadata.apellido ?? ""}`.trim();

      setBase(profile?.base?.nombre ?? "");
      setPuesto(profile?.puesto?.nombre ?? "");
      setRol(roleName);
      setNombreCompleto(fullName);
      const baseAvatarUrl =
        profile?.avatar_url ??
        (user.user_metadata as { avatar_url?: string }).avatar_url ??
        "";
      setAvatarUrl(baseAvatarUrl ? `${baseAvatarUrl}?v=${Date.now()}` : "");
      setLoading(false);
      await reload();
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-zinc-50">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar base="" puesto="" rol="" nombreCompleto="" avatarUrl="" />
          <div className="flex-1 p-6">
            <div className="mx-auto w-full max-w-6xl">
              <div className="rounded-2xl border border-black/[.08] bg-white p-6 text-sm text-zinc-600">
                Cargando...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar base={base} puesto={puesto} rol={rol} nombreCompleto={nombreCompleto} avatarUrl={avatarUrl} />
        <div className="flex-1 bg-zinc-50 p-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Cotizaciones pendientes
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Se acumulan aquí hasta que se confirmen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
              >
                Recargar
              </button>
            </div>

            {errorMessage ? (
              <div className="mt-6 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                {errorMessage}
              </div>
            ) : null}
            {saveError ? (
              <div className="mt-3 rounded-xl border border-black/[.08] bg-red-50 px-4 py-3 text-sm text-red-900">
                {saveError}
              </div>
            ) : saveMessage ? (
              <div className="mt-3 rounded-xl border border-black/[.08] bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {saveMessage}
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-2xl border border-black/[.08] bg-white">
              <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pendientes ({rows.length})
              </div>
              {rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-600">
                  No hay cotizaciones pendientes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                        <th className="px-4 py-3">Folio</th>
                        <th className="px-4 py-3">Ruta</th>
                        <th className="px-4 py-3">Enviado por</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Estatus</th>
                        <th className="px-4 py-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[.08]">
                      {rows.map((r, idx) => (
                        <tr
                          key={r.id}
                          className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                        >
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {r.folio}
                          </td>
                          <td className="px-4 py-3">
                            {r.origen} → {r.destino}
                          </td>
                          <td className="px-4 py-3">{r.enviado_por}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            {formatMoney(r.total, r.moneda)}
                          </td>
                          <td className="px-4 py-3">
                            {statusNormalized(r.status) === "pendiente" ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-700">
                                  Pendiente
                                </span>
                                <select
                                  value="pendiente"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "aceptada" || v === "rechazada") {
                                      void updateStatus(r.id, v);
                                    }
                                  }}
                                  disabled={savingId === r.id}
                                  className="h-9 rounded-full border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                                >
                                  <option value="pendiente">Cambiar…</option>
                                  <option value="aceptada">Aceptar</option>
                                  <option value="rechazada">Rechazar</option>
                                </select>
                              </div>
                            ) : statusNormalized(r.status) === "aceptada" ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
                                  Aceptada
                                </span>
                                <select
                                  value="aceptada"
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === "exitosa" || v === "no_exitosa") {
                                      void updateStatus(r.id, v);
                                    }
                                  }}
                                  disabled={savingId === r.id}
                                  className="h-9 rounded-full border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                                >
                                  <option value="aceptada">Cambiar…</option>
                                  <option value="exitosa">Marcar exitosa</option>
                                  <option value="no_exitosa">Marcar no exitosa</option>
                                </select>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800">
                                {statusNormalized(r.status)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(r.created_at).toLocaleString("es-MX")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
