"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

type QuoteRow = {
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
  payload?: unknown;
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

function statusNormalized(status: string) {
  const s = (status || "").trim().toLowerCase();
  if (s === "aceptadas") return "aceptada";
  if (s === "no exitosa") return "no_exitosa";
  return s;
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

function buildTicketHtml(row: QuoteRow, payload: PayloadShape | null) {
  const p = payload ?? null;
  const divisa = asString(p?.divisa) || row.moneda || "MXN";
  const montos = asRecord(p?.montos);
  const total = asNumber(montos?.total) || row.total || 0;
  const created = row.created_at
    ? new Date(row.created_at).toLocaleString("es-MX")
    : "—";

  const title = `Ticket de cotización ${row.folio || "—"}`;
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 0; background: #f4f4f5; color: #18181b; }
    .page { max-width: 860px; margin: 0 auto; padding: 24px; }
    .card { background: white; border: 1px solid rgba(0,0,0,.08); border-radius: 16px; overflow: hidden; }
    .header { padding: 18px 18px; background: #fafafa; border-bottom: 1px solid rgba(0,0,0,.08); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .h1 { font-size: 18px; font-weight: 700; margin: 0; }
    .meta { font-size: 12px; color: #52525b; }
    .content { padding: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .item { border: 1px solid rgba(0,0,0,.08); border-radius: 14px; padding: 12px; }
    .k { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #71717a; }
    .v { margin-top: 6px; font-size: 14px; font-weight: 600; }
    .total { grid-column: 1 / -1; background: #fafafa; }
    .total .v { font-size: 22px; }
    .foot { padding: 14px 18px; border-top: 1px solid rgba(0,0,0,.08); font-size: 12px; color: #52525b; display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    @media print { body { background: white; } .page { padding: 0; } .card { border: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="header">
        <div>
          <p class="h1">${esc(title)}</p>
          <div class="meta">${esc(created)}</div>
        </div>
        <div class="meta">
          Estatus: <strong>${esc(statusNormalized(row.status))}</strong>
        </div>
      </div>
      <div class="content">
        <div class="item">
          <div class="k">Empresa</div>
          <div class="v">${esc(asString(p?.empresa) || "—")}</div>
        </div>
        <div class="item">
          <div class="k">Cliente</div>
          <div class="v">${esc(asString(p?.cliente) || "—")}</div>
        </div>
        <div class="item">
          <div class="k">Ruta</div>
          <div class="v">${esc(`${row.origen} → ${row.destino}`)}</div>
        </div>
        <div class="item">
          <div class="k">Emite</div>
          <div class="v">${esc(asString(p?.emitidaPor) || row.enviado_por || "—")}</div>
        </div>
        <div class="item">
          <div class="k">Correo</div>
          <div class="v">${esc(asString(p?.correoEmitente) || "—")}</div>
        </div>
        <div class="item">
          <div class="k">Vigencia</div>
          <div class="v">${esc(`${asString(p?.fechaEmision) || "—"} → ${asString(p?.fechaCaducidad) || "—"}`)}</div>
        </div>
        <div class="item total">
          <div class="k">Total (sin impuestos)</div>
          <div class="v">${esc(formatMoney(total, divisa))}</div>
        </div>
      </div>
      <div class="foot">
        <div>Folio: <strong>${esc(row.folio || "—")}</strong></div>
        <div>ID: <strong>${esc(row.id)}</strong></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export default function HistorialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState("");
  const [puesto, setPuesto] = useState("");
  const [rol, setRol] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewerUserId, setViewerUserId] = useState("");

  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [ticketLoadingId, setTicketLoadingId] = useState("");

  const reload = useCallback(async () => {
    if (!viewerUserId) return;
    setRowsError("");
    setRowsLoading(true);

    let query = supabase
      .from("cotizaciones_pendientes")
      .select(
        "id,created_at,folio,origen,destino,moneda,total,enviado_por,enviado_por_user_id,status",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (!isAdmin) query = query.eq("enviado_por_user_id", viewerUserId);

    const { data, error } = await query;
    if (error) {
      setRows([]);
      setRowsError(
        error.message ||
          "No se pudo cargar el historial (revisa permisos/RLS de cotizaciones_pendientes).",
      );
      setRowsLoading(false);
      return;
    }

    setRows((data as QuoteRow[] | null) ?? []);
    setRowsLoading(false);
  }, [isAdmin, viewerUserId]);

  async function downloadTicket(row: QuoteRow) {
    setRowsError("");
    setTicketLoadingId(row.id);

    const { data, error } = await supabase
      .from("cotizaciones_pendientes")
      .select(
        "id,created_at,folio,origen,destino,moneda,total,enviado_por,enviado_por_user_id,status,payload",
      )
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

    if (!isAdmin) {
      const ownerId = (data as { enviado_por_user_id?: string | null })
        .enviado_por_user_id;
      if (ownerId !== viewerUserId) {
        setTicketLoadingId("");
        setRowsError("No tienes permiso para descargar esta cotización.");
        return;
      }
    }

    const payload = ((data as { payload?: unknown }).payload as PayloadShape | null) ?? null;
    const html = buildTicketHtml(data as QuoteRow, payload);
    downloadFile(
      `ticket-${String((data as { folio?: string }).folio ?? "cotizacion")}.html`,
      html,
      "text/html",
    );
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

      setRowsError("");
      setRowsLoading(true);
      let query = supabase
        .from("cotizaciones_pendientes")
        .select(
          "id,created_at,folio,origen,destino,moneda,total,enviado_por,enviado_por_user_id,status",
        )
        .order("created_at", { ascending: false })
        .limit(500);

      if (!admin) query = query.eq("enviado_por_user_id", user.id);

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        setRows([]);
        setRowsError(
          error.message ||
            "No se pudo cargar el historial (revisa permisos/RLS de cotizaciones_pendientes).",
        );
        setRowsLoading(false);
      } else {
        setRows((data as QuoteRow[] | null) ?? []);
        setRowsLoading(false);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Historial
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  {isAdmin ? "Todas las cotizaciones." : "Tus cotizaciones."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void reload()}
                disabled={rowsLoading}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
              >
                {rowsLoading ? "Cargando..." : "Actualizar"}
              </button>
            </div>

            {rowsError ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                {rowsError}
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-2xl border border-black/[.08] bg-white">
              <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Registros ({rows.length})
              </div>
              {rowsLoading ? (
                <div className="px-4 py-6 text-sm text-zinc-600">
                  Cargando...
                </div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-600">
                  Sin movimientos todavía.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                        <th className="px-4 py-3">Folio</th>
                        <th className="px-4 py-3">Ruta</th>
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
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800">
                              {statusNormalized(r.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">
                            {formatMoney(r.total, r.moneda)}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(r.created_at).toLocaleString("es-MX")}
                          </td>
                          <td className="px-4 py-3 text-right">
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
