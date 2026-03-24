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

type ClienteRow = {
  created_at: string;
};

type CotizacionRow = {
  created_at: string;
  status: string;
};

type GroupBy = "dia" | "semana";

type MetricSeriesPoint = {
  label: string;
  value: number;
};

function dateKeyLocal(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysLocal(dt: Date, days: number) {
  const next = new Date(dt);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDayLocal(dt: Date) {
  const d = new Date(dt);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekLocal(dt: Date) {
  const d = startOfDayLocal(dt);
  const day = d.getDay();
  const mondayBased = (day + 6) % 7;
  d.setDate(d.getDate() - mondayBased);
  return d;
}

function statusNormalized(status: string) {
  const s = (status || "").trim().toLowerCase();
  if (s === "aceptadas") return "aceptada";
  if (s === "no exitosa") return "no_exitosa";
  return s;
}

function formatDateLabel(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

function buildBuckets(from: Date, to: Date, groupBy: GroupBy) {
  const start = startOfDayLocal(from);
  const end = startOfDayLocal(to);
  const keys: string[] = [];
  const seen = new Set<string>();
  let cursor = new Date(start);

  while (cursor <= end) {
    const bucketKey =
      groupBy === "semana"
        ? dateKeyLocal(startOfWeekLocal(cursor))
        : dateKeyLocal(cursor);
    if (!seen.has(bucketKey)) {
      seen.add(bucketKey);
      keys.push(bucketKey);
    }
    cursor = addDaysLocal(cursor, 1);
  }

  return keys;
}

function makeSeriesFromCounts(
  bucketKeys: string[],
  counts: Record<string, number>,
  groupBy: GroupBy,
) {
  return bucketKeys.map((k) => {
    const label =
      groupBy === "semana" ? `Sem ${formatDateLabel(k)}` : formatDateLabel(k);
    return { label, value: counts[k] ?? 0 };
  });
}

function sumSeries(series: MetricSeriesPoint[]) {
  return series.reduce((acc, p) => acc + p.value, 0);
}

function formatCompact(value: number) {
  return value.toLocaleString("es-MX");
}

function trendFromSeries(series: MetricSeriesPoint[]) {
  const last = series.length > 0 ? series[series.length - 1]?.value ?? 0 : 0;
  const prev = series.length > 1 ? series[series.length - 2]?.value ?? 0 : 0;
  const delta = last - prev;
  const pct = prev === 0 ? (last === 0 ? 0 : 100) : (delta / prev) * 100;
  const direction = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  return { last, prev, delta, pct, direction } as const;
}

function buildSparkline(values: number[], width: number, height: number, pad: number) {
  const safe = values.length > 0 ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = Math.max(1, max - min);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const innerW = Math.max(1, w - pad * 2);
  const innerH = Math.max(1, h - pad * 2);
  const n = safe.length;
  const step = n <= 1 ? 0 : innerW / (n - 1);

  const points = safe.map((v, i) => {
    const x = pad + i * step;
    const t = (v - min) / range;
    const y = pad + (1 - t) * innerH;
    return { x, y };
  });

  const line =
    points.length === 0
      ? ""
      : points
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(" ");

  const baseY = pad + innerH;
  const area =
    points.length === 0
      ? ""
      : `M ${points[0]!.x.toFixed(2)} ${baseY.toFixed(2)} L ${points
          .map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
          .join(" L ")} L ${points[points.length - 1]!.x.toFixed(2)} ${baseY.toFixed(2)} Z`;

  return { line, area, min, max };
}

function MetricCard({
  title,
  subtitle,
  total,
  series,
  colorClassName,
}: {
  title: string;
  subtitle: string;
  total: number;
  series: MetricSeriesPoint[];
  colorClassName: string;
}) {
  const trend = useMemo(() => trendFromSeries(series), [series]);
  const values = useMemo(() => series.map((p) => p.value), [series]);
  const chart = useMemo(() => buildSparkline(values, 240, 72, 6), [values]);
  const trendText = useMemo(() => {
    const pct = Math.abs(trend.pct);
    const pctText = Number.isFinite(pct) ? `${pct.toFixed(0)}%` : "0%";
    if (trend.direction === "flat") return "Sin cambio";
    return `${trend.delta > 0 ? "+" : ""}${formatCompact(trend.delta)} (${trend.delta > 0 ? "+" : ""}${pctText})`;
  }, [trend]);
  const trendClassName =
    trend.direction === "up"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : trend.direction === "down"
        ? "text-rose-700 bg-rose-50 border-rose-200"
        : "text-zinc-700 bg-zinc-50 border-black/[.08]";

  return (
    <div className="rounded-2xl border border-black/[.08] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {title}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <div className="text-2xl font-semibold text-zinc-900">
              {formatCompact(total)}
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${trendClassName}`}
              title={`Último: ${formatCompact(trend.last)} · Anterior: ${formatCompact(trend.prev)}`}
            >
              {trendText}
            </span>
          </div>
          <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
        </div>

        <div className="w-full sm:w-[260px]">
          <div className="rounded-xl border border-black/[.08] bg-zinc-50 p-2">
            <svg
              viewBox="0 0 240 72"
              className={`h-[72px] w-full ${colorClassName}`}
              aria-hidden="true"
              role="img"
            >
              <defs>
                <linearGradient id={`${title.replace(/\s+/g, "-")}-grad`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {chart.area ? (
                <path d={chart.area} fill={`url(#${title.replace(/\s+/g, "-")}-grad)`} />
              ) : null}
              {chart.line ? (
                <path
                  d={chart.line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Mín {formatCompact(chart.min)}</span>
              <span>Máx {formatCompact(chart.max)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EstadisticasPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState("");
  const [puesto, setPuesto] = useState("");
  const [rol, setRol] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [viewerUserId, setViewerUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const [rangeDays, setRangeDays] = useState(30);
  const [groupBy, setGroupBy] = useState<GroupBy>("dia");
  const [refreshToken, setRefreshToken] = useState(0);

  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");

  const [clientesSeries, setClientesSeries] = useState<MetricSeriesPoint[]>([]);
  const [cotizacionesSeries, setCotizacionesSeries] = useState<MetricSeriesPoint[]>([]);
  const [exitosasSeries, setExitosasSeries] = useState<MetricSeriesPoint[]>([]);
  const [rechazadasSeries, setRechazadasSeries] = useState<MetricSeriesPoint[]>([]);
  const [noExitosasSeries, setNoExitosasSeries] = useState<MetricSeriesPoint[]>([]);

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

      let profile: ProfileRow | null = (profileWithAvatar as ProfileRow | null) ?? null;

      if (avatarErr) {
        const { data: profileNoAvatar } = await supabase
          .from("profiles")
          .select("nombre,apellido,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))")
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
      setIsAdmin(roleName.toLowerCase() === "administrador");
      setNombreCompleto(fullName);
      setViewerUserId(user.id);
      const baseAvatarUrl =
        profileRow?.avatar_url ??
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

    async function loadStats() {
      if (!viewerUserId) return;
      setStatsError("");
      setStatsLoading(true);

      const now = new Date();
      const to = startOfDayLocal(now);
      const from = startOfDayLocal(addDaysLocal(to, -(rangeDays - 1)));
      const bucketKeys = buildBuckets(from, to, groupBy);

      const clientesCounts: Record<string, number> = Object.create(null);
      const cotizacionesCounts: Record<string, number> = Object.create(null);
      const exitosasCounts: Record<string, number> = Object.create(null);
      const rechazadasCounts: Record<string, number> = Object.create(null);
      const noExitosasCounts: Record<string, number> = Object.create(null);

      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("created_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", addDaysLocal(to, 1).toISOString())
        .limit(5000);

      if (cancelled) return;

      if (clientesError) {
        setStatsLoading(false);
        setStatsError(
          clientesError.message || "No se pudieron cargar clientes (revisa permisos/RLS).",
        );
        return;
      }

      (((clientesData as ClienteRow[] | null) ?? []) as ClienteRow[]).forEach((r) => {
        const dt = new Date(r.created_at);
        if (Number.isNaN(dt.getTime())) return;
        const key =
          groupBy === "semana"
            ? dateKeyLocal(startOfWeekLocal(dt))
            : dateKeyLocal(dt);
        clientesCounts[key] = (clientesCounts[key] ?? 0) + 1;
      });

      let cotQuery = supabase
        .from("cotizaciones_pendientes")
        .select("created_at,status,enviado_por_user_id")
        .gte("created_at", from.toISOString())
        .lte("created_at", addDaysLocal(to, 1).toISOString())
        .order("created_at", { ascending: true })
        .limit(5000);

      if (!isAdmin) cotQuery = cotQuery.eq("enviado_por_user_id", viewerUserId);

      const { data: cotData, error: cotError } = await cotQuery;

      if (cancelled) return;

      if (cotError) {
        setStatsLoading(false);
        setStatsError(
          cotError.message ||
            "No se pudieron cargar cotizaciones (revisa permisos/RLS de cotizaciones_pendientes).",
        );
        return;
      }

      (((cotData as CotizacionRow[] | null) ?? []) as CotizacionRow[]).forEach((r) => {
        const dt = new Date(r.created_at);
        if (Number.isNaN(dt.getTime())) return;
        const bucketKey =
          groupBy === "semana"
            ? dateKeyLocal(startOfWeekLocal(dt))
            : dateKeyLocal(dt);
        cotizacionesCounts[bucketKey] = (cotizacionesCounts[bucketKey] ?? 0) + 1;

        const s = statusNormalized(r.status);
        if (s === "aceptada" || s === "exitosa") {
          exitosasCounts[bucketKey] = (exitosasCounts[bucketKey] ?? 0) + 1;
        } else if (s === "rechazada") {
          rechazadasCounts[bucketKey] = (rechazadasCounts[bucketKey] ?? 0) + 1;
        } else if (s === "no_exitosa") {
          noExitosasCounts[bucketKey] = (noExitosasCounts[bucketKey] ?? 0) + 1;
        }
      });

      setClientesSeries(makeSeriesFromCounts(bucketKeys, clientesCounts, groupBy));
      setCotizacionesSeries(makeSeriesFromCounts(bucketKeys, cotizacionesCounts, groupBy));
      setExitosasSeries(makeSeriesFromCounts(bucketKeys, exitosasCounts, groupBy));
      setRechazadasSeries(makeSeriesFromCounts(bucketKeys, rechazadasCounts, groupBy));
      setNoExitosasSeries(makeSeriesFromCounts(bucketKeys, noExitosasCounts, groupBy));
      setStatsLoading(false);
    }

    if (!loading) void loadStats();

    return () => {
      cancelled = true;
    };
  }, [groupBy, isAdmin, loading, rangeDays, refreshToken, viewerUserId]);

  const scopeLabel = isAdmin ? "Global" : "Mis cotizaciones";

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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Estadísticas
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  {scopeLabel} · Últimos {rangeDays} días
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="flex items-center gap-2 rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm">
                  <span className="text-zinc-600">Rango</span>
                  <select
                    value={String(rangeDays)}
                    onChange={(e) => {
                      const nextDays = Number(e.target.value) || 30;
                      setRangeDays(nextDays);
                      setGroupBy(nextDays > 31 ? "semana" : "dia");
                    }}
                    className="bg-transparent text-sm font-semibold text-zinc-900 outline-none"
                    disabled={statsLoading}
                  >
                    <option value="7">7 días</option>
                    <option value="30">30 días</option>
                    <option value="90">90 días</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm">
                  <span className="text-zinc-600">Agrupar</span>
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                    className="bg-transparent text-sm font-semibold text-zinc-900 outline-none"
                    disabled={statsLoading}
                  >
                    <option value="dia">Día</option>
                    <option value="semana">Semana</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setRefreshToken((v) => v + 1);
                  }}
                  disabled={statsLoading}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
                >
                  Actualizar
                </button>
              </div>
            </div>

            {statsError ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                {statsError}
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <MetricCard
                title="Clientes nuevos"
                subtitle="Altas en el periodo"
                total={sumSeries(clientesSeries)}
                series={clientesSeries}
                colorClassName="text-zinc-900"
              />
              <MetricCard
                title="Cotizaciones hechas"
                subtitle={scopeLabel}
                total={sumSeries(cotizacionesSeries)}
                series={cotizacionesSeries}
                colorClassName="text-sky-700"
              />
              <MetricCard
                title="Cotizaciones exitosas"
                subtitle="Aceptadas o exitosas"
                total={sumSeries(exitosasSeries)}
                series={exitosasSeries}
                colorClassName="text-emerald-700"
              />
              <MetricCard
                title="Cotizaciones rechazadas"
                subtitle="Rechazadas"
                total={sumSeries(rechazadasSeries)}
                series={rechazadasSeries}
                colorClassName="text-rose-700"
              />
              <MetricCard
                title="Cotizaciones no exitosas"
                subtitle="No exitosa"
                total={sumSeries(noExitosasSeries)}
                series={noExitosasSeries}
                colorClassName="text-amber-700"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
