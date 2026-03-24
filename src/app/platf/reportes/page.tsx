"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "@/platf/Sidebar";
import { Topbar } from "@/platf/Topbar";

type ProfileRow = {
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
  enviado_por_user_id?: string;
  status: string;
};

type PayloadShape = {
  empresa?: unknown;
  cliente?: unknown;
  emitidaPor?: unknown;
  correoEmitente?: unknown;
  fechaEmision?: unknown;
  fechaCaducidad?: unknown;
  divisa?: unknown;
  montos?: unknown;
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

function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`;
  return normalized;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toStartOfDayIso(date: string) {
  if (!date) return "";
  const dt = new Date(`${date}T00:00:00.000`);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString();
}

function toEndOfDayIso(date: string) {
  if (!date) return "";
  const dt = new Date(`${date}T23:59:59.999`);
  return Number.isNaN(dt.getTime()) ? "" : dt.toISOString();
}

function asString(v: unknown) {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function asRecord(v: unknown) {
  if (!v || typeof v !== "object") return null;
  return v as Record<string, unknown>;
}

export default function ReportesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<string>("");
  const [puesto, setPuesto] = useState<string>("");
  const [rol, setRol] = useState<string>("");
  const [nombreCompleto, setNombreCompleto] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [viewerUserId, setViewerUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [rows, setRows] = useState<PendingRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [ticketLoadingId, setTicketLoadingId] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function loadReport() {
    setRowsError("");
    setRowsLoading(true);

    let query = supabase
      .from("cotizaciones_pendientes")
      .select(
        "id,created_at,folio,origen,destino,moneda,total,enviado_por,enviado_por_user_id,status",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (!isAdmin && viewerUserId) {
      query = query.eq("enviado_por_user_id", viewerUserId);
    }

    query = query.in("status", ["aceptada", "aceptadas", "exitosa"]);

    const fromIso = toStartOfDayIso(dateFrom);
    if (fromIso) query = query.gte("created_at", fromIso);

    const toIso = toEndOfDayIso(dateTo);
    if (toIso) query = query.lte("created_at", toIso);

    const { data, error } = await query;

    if (error) {
      setRows([]);
      setRowsError(
        error.message ||
          "No se pudo cargar el reporte (revisa permisos/RLS de cotizaciones_pendientes).",
      );
      setRowsLoading(false);
      return;
    }

    setRows((data as PendingRow[] | null) ?? []);
    setRowsLoading(false);
  }

  function statusNormalized(status: string) {
    const s = (status || "").trim().toLowerCase();
    if (s === "aceptadas") return "aceptada";
    if (s === "no exitosa") return "no_exitosa";
    return s;
  }

  function canDownloadTicket(status: string) {
    const s = statusNormalized(status);
    return s === "aceptada" || s === "exitosa" || s === "no_exitosa";
  }

  async function downloadTicket(row: PendingRow) {
    if (!canDownloadTicket(row.status)) return;
    setTicketLoadingId(row.id);
    setRowsError("");

    const { data, error } = await supabase
      .from("cotizaciones_pendientes")
      .select("id,created_at,folio,origen,destino,moneda,total,enviado_por,status,payload,enviado_por_user_id")
      .eq("id", row.id)
      .maybeSingle();

    if (error || !data) {
      setTicketLoadingId("");
      setRowsError(
        error?.message ||
          "No se pudo descargar el ticket (revisa permisos/RLS de cotizaciones_pendientes).",
      );
      return;
    }

    if (!isAdmin && viewerUserId) {
      const ownerId = (data as { enviado_por_user_id?: string | null })
        .enviado_por_user_id;
      if (ownerId !== viewerUserId) {
        setTicketLoadingId("");
        setRowsError("No tienes permiso para descargar esta cotización.");
        return;
      }
    }

    const payload =
      (((data as { payload?: unknown }).payload as PayloadShape | null) ??
        null) as unknown;
    const base =
      (typeof structuredClone === "function"
        ? structuredClone(payload ?? {})
        : JSON.parse(JSON.stringify(payload ?? {}))) as Record<string, unknown>;

    base.folio =
      (data as PendingRow).folio ??
      asString((base as { folio?: unknown }).folio);
    base.tarifaOrigen =
      (data as PendingRow).origen ??
      asString((base as { tarifaOrigen?: unknown }).tarifaOrigen);
    base.destino =
      (data as PendingRow).destino ??
      asString((base as { destino?: unknown }).destino);
    base.divisa =
      (data as PendingRow).moneda ??
      asString((base as { divisa?: unknown }).divisa) ??
      "MXN";

    const montos =
      (asRecord((base as { montos?: unknown }).montos) || {}) as Record<
        string,
        unknown
      >;
    const total = asNumber(montos.total) || (data as PendingRow).total || 0;
    montos.total = total;
    (base as { montos?: unknown }).montos = montos;

    const json = JSON.stringify(base);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = `/platf/cotizaciones/ticket?d=${encodeURIComponent(b64)}&auto=1`;
    window.open(url, "_blank");
    setTicketLoadingId("");
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

      const { data: profileWithAvatar, error: avatarErr } = await supabase
        .from("profiles")
        .select(
          "nombre,apellido,avatar_url,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      let profile: ProfileRow | null =
        (profileWithAvatar as ProfileRow | null) ?? null;

      if (avatarErr) {
        const { data: profileNoAvatar } = await supabase
          .from("profiles")
          .select(
            "nombre,apellido,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))",
          )
          .eq("user_id", user.id)
          .maybeSingle();
        profile = (profileNoAvatar as ProfileRow | null) ?? null;
      }

      if (cancelled) return;

      const metadata = user.user_metadata as Partial<{
        nombre: string;
        apellido: string;
      }>;

      const profileRow = (profile as ProfileRow | null) ?? null;
      const fullName =
        `${profileRow?.nombre ?? metadata.nombre ?? ""} ${profileRow?.apellido ?? metadata.apellido ?? ""}`.trim();

      setBase(profileRow?.base?.nombre ?? "");
      setPuesto(profileRow?.puesto?.nombre ?? "");
      const roleName = profileRow?.puesto?.rol?.nombre ?? "";
      setRol(roleName);
      const admin = roleName.toLowerCase() === "administrador";
      setIsAdmin(admin);
      setNombreCompleto(fullName);
      setViewerUserId(user.id);
      const baseAvatarUrl =
        profileRow?.avatar_url ??
        (user.user_metadata as { avatar_url?: string }).avatar_url ??
        "";
      setAvatarUrl(baseAvatarUrl ? `${baseAvatarUrl}?v=${Date.now()}` : "");
      setLoading(false);

      setRowsError("");
      setRowsLoading(true);
      let query = supabase
        .from("cotizaciones_pendientes")
        .select(
          "id,created_at,folio,origen,destino,moneda,total,enviado_por,enviado_por_user_id,status",
        )
        .order("created_at", { ascending: false });

      if (!admin) {
        query = query
          .eq("enviado_por_user_id", user.id)
          .in("status", ["aceptada", "aceptadas", "exitosa"]);
      } else {
        query = query.in("status", ["aceptada", "aceptadas", "exitosa"]);
      }

      query = query.limit(500);

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        setRows([]);
        setRowsError(
          error.message ||
            "No se pudo cargar el reporte (revisa permisos/RLS de cotizaciones_pendientes).",
        );
        setRowsLoading(false);
        return;
      }

      setRows((data as PendingRow[] | null) ?? []);
      setRowsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const r of rows) {
      const currency = r.moneda ?? "";
      if (!currency) continue;
      const prev = byCurrency.get(currency) ?? 0;
      byCurrency.set(currency, prev + (Number(r.total) || 0));
    }
    const entries = Array.from(byCurrency.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], "es"),
    );
    return entries;
  }, [rows]);

  function downloadCsv() {
    const headers = [
      "created_at",
      "folio",
      "origen",
      "destino",
      "enviado_por",
      "status",
      "moneda",
      "total",
    ];
    const body = rows
      .map((r) =>
        [
          r.created_at,
          r.folio,
          r.origen,
          r.destino,
          r.enviado_por,
          r.status,
          r.moneda,
          r.total,
        ]
          .map(csvEscape)
          .join(","),
      )
      .join("\r\n");
    const csv = `${headers.map(csvEscape).join(",")}\r\n${body}\r\n`;
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadFile(`reporte-cotizaciones-${dateStamp}.csv`, csv, "text/csv");
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
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Reportes</h1>
                <p className="mt-1 text-sm text-zinc-600">
                  {isAdmin
                    ? "Solo cotizaciones aceptadas (hasta 500)."
                    : "Tus cotizaciones aceptadas o exitosas (hasta 500)."}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void loadReport()}
                  disabled={rowsLoading}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
                >
                  {rowsLoading ? "Cargando..." : "Actualizar"}
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  disabled={rowsLoading || rows.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-60"
                >
                  Descargar CSV
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Filtros
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-lg border border-black/[.08] bg-zinc-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-600">
                    Estatus: Aceptada / Exitosa
                  </div>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Desde
                    </span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      disabled={rowsLoading}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Hasta
                    </span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      disabled={rowsLoading}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void loadReport()}
                  disabled={rowsLoading}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-60"
                >
                  Generar
                </button>
              </div>

              <div className="rounded-2xl border border-black/[.08] bg-white p-4 lg:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Resumen
                    </div>
                    <div className="mt-2 text-sm font-medium text-zinc-900">
                      Registros: {rows.length}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {totals.length === 0 ? (
                      <span className="text-sm text-zinc-600">
                        Sin totales por moneda
                      </span>
                    ) : (
                      totals.map(([currency, amount]) => (
                        <span
                          key={currency}
                          className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-800"
                        >
                          {formatMoney(amount, currency)}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {rowsError ? (
                  <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                    {rowsError}
                  </div>
                ) : rowsLoading ? (
                  <div className="mt-4 text-sm text-zinc-600">Cargando…</div>
                ) : rows.length === 0 ? (
                  <div className="mt-4 text-sm text-zinc-600">
                    Sin resultados.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                          <th className="px-4 py-3">Folio</th>
                          <th className="px-4 py-3">Ruta</th>
                          <th className="px-4 py-3">Enviado por</th>
                          <th className="px-4 py-3">Estatus</th>
                          <th className="px-4 py-3">Total</th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3"></th>
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
                            <td className="px-4 py-3">{r.status}</td>
                            <td className="px-4 py-3 font-semibold text-zinc-900">
                              {formatMoney(r.total, r.moneda)}
                            </td>
                            <td className="px-4 py-3">
                              {new Date(r.created_at).toLocaleString("es-MX")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canDownloadTicket(r.status) ? (
                                <button
                                  type="button"
                                  onClick={() => void downloadTicket(r)}
                                  disabled={ticketLoadingId === r.id}
                                  className="inline-flex h-9 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
                                >
                                  {ticketLoadingId === r.id
                                    ? "Descargando..."
                                    : "Descargar ticket"}
                                </button>
                              ) : (
                                <span className="text-sm text-zinc-500">
                                  —
                                </span>
                              )}
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
    </div>
  );
}
