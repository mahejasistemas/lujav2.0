"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
  payload: unknown;
};

type PayloadShape = {
  empresa?: unknown;
  cliente?: unknown;
  emitidaPor?: unknown;
  correoEmitente?: unknown;
  fechaEmision?: unknown;
  fechaCaducidad?: unknown;
  tarifaOrigen?: unknown;
  destino?: unknown;
  divisa?: unknown;
  servicio?: unknown;
  montos?: unknown;
  lonas?: unknown;
  seguro?: unknown;
  serviceBlocks?: unknown;
  mixtaBlocks?: unknown;
  cargas?: unknown;
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

function asArray(v: unknown) {
  return Array.isArray(v) ? v : [];
}

export default function CotizacionPendienteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const idParam = params?.id;
  const id = typeof idParam === "string" ? idParam : "";

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState("");
  const [puesto, setPuesto] = useState("");
  const [rol, setRol] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [row, setRow] = useState<PendingRow | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [draftPayload, setDraftPayload] = useState<PayloadShape | null>(null);
  const [savingPrices, setSavingPrices] = useState(false);
  const [savePricesMessage, setSavePricesMessage] = useState("");
  const [savePricesError, setSavePricesError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setRow(null);
        setErrorMessage("No se pudo identificar el ID de la cotización.");
        setLoading(false);
        return;
      }

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

      setErrorMessage("");
      const { data, error } = await supabase
        .from("cotizaciones_pendientes")
        .select(
          "id,created_at,folio,origen,destino,moneda,total,enviado_por,status,payload",
        )
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setRow(null);
        setErrorMessage("No se pudo cargar la cotización pendiente.");
        setLoading(false);
        return;
      }

      setRow(data as PendingRow);
      setDraftPayload(((data as PendingRow).payload as PayloadShape | null) ?? null);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const payload = useMemo(() => {
    return (row?.payload as PayloadShape | null) ?? null;
  }, [row]);

  const divisa = useMemo(() => {
    return asString(payload?.divisa) || row?.moneda || "MXN";
  }, [payload?.divisa, row?.moneda]);

  const computedTotal = useMemo(() => {
    const p = (draftPayload as PayloadShape | null) ?? payload;
    const montos = asRecord((p as unknown as { montos?: unknown })?.montos);
    const servicios = asArray((montos as unknown as { servicios?: unknown })?.servicios);
    const extras = asRecord((montos as unknown as { extras?: unknown })?.extras);
    const lonas = asNumber((extras as unknown as { lonas?: unknown })?.lonas);
    const seguro = asNumber((extras as unknown as { seguro?: unknown })?.seguro);
    const extrasTotal = asNumber((extras as unknown as { total?: unknown })?.total) || lonas + seguro;
    const serviciosTotal = servicios.reduce((acc, it) => {
      const r = asRecord(it);
      return acc + asNumber((r as unknown as { subtotal?: unknown })?.subtotal);
    }, 0);
    const sum = serviciosTotal + extrasTotal;
    if (sum === 0) {
      const m = asRecord(payload?.montos);
      const t = m ? asNumber(m.total) : 0;
      return t || (row?.total ?? 0);
    }
    return sum;
  }, [draftPayload, payload, row?.total]);

  function setServiceSubtotal(index: number, value: number) {
    setDraftPayload((prev) => {
      const p = (prev ? { ...prev } : {}) as Record<string, unknown>;
      const montos = (asRecord(p.montos) || {}) as Record<string, unknown>;
      const servicios = asArray(montos.servicios).slice();
      const item = (asRecord(servicios[index]) || {}) as Record<string, unknown>;
      servicios[index] = { ...item, subtotal: value } as unknown as unknown;
      montos.servicios = servicios as unknown as unknown[];
      p.montos = montos;
      return p as unknown as PayloadShape;
    });
  }

  function setServiceUnitPrice(index: number, value: number) {
    setDraftPayload((prev) => {
      const p = (prev ? { ...prev } : {}) as Record<string, unknown>;
      const montos = (asRecord(p.montos) || {}) as Record<string, unknown>;
      const servicios = asArray(montos.servicios).slice();
      const item = (asRecord(servicios[index]) || {}) as Record<string, unknown>;
      const cantidadTotal = asNumber(item.cantidadTotal);
      const extraMixta = asNumber(item.extraMixta);
      const subtotal = value * cantidadTotal + extraMixta;
      servicios[index] = {
        ...item,
        unitPrice: value,
        subtotal,
      } as unknown as unknown;
      montos.servicios = servicios as unknown as unknown[];
      p.montos = montos;
      return p as unknown as PayloadShape;
    });
  }

  function setServiceExtraMixta(index: number, value: number) {
    setDraftPayload((prev) => {
      const p = (prev ? { ...prev } : {}) as Record<string, unknown>;
      const montos = (asRecord(p.montos) || {}) as Record<string, unknown>;
      const servicios = asArray(montos.servicios).slice();
      const item = (asRecord(servicios[index]) || {}) as Record<string, unknown>;
      const cantidadTotal = asNumber(item.cantidadTotal);
      const unitPrice = asNumber(item.unitPrice);
      const subtotal = unitPrice * cantidadTotal + value;
      servicios[index] = {
        ...item,
        extraMixta: value,
        subtotal,
      } as unknown as unknown;
      montos.servicios = servicios as unknown as unknown[];
      p.montos = montos;
      return p as unknown as PayloadShape;
    });
  }

  function setCargaLineTotal(index: number, value: number) {
    setDraftPayload((prev) => {
      const p = (prev ? { ...prev } : {}) as Record<string, unknown>;
      const montos = (asRecord(p.montos) || {}) as Record<string, unknown>;
      const cargas = asArray(montos.cargas).slice();
      const item = (asRecord(cargas[index]) || {}) as Record<string, unknown>;
      cargas[index] = { ...item, lineTotal: value } as unknown as unknown;
      montos.cargas = cargas as unknown as unknown[];
      p.montos = montos;
      return p as unknown as PayloadShape;
    });
  }

  function setCargaUnitPrice(index: number, value: number) {
    setDraftPayload((prev) => {
      const p = (prev ? { ...prev } : {}) as Record<string, unknown>;
      const montos = (asRecord(p.montos) || {}) as Record<string, unknown>;
      const cargas = asArray(montos.cargas).slice();
      const item = (asRecord(cargas[index]) || {}) as Record<string, unknown>;
      const cantidad = asNumber(item.cantidad);
      const lineTotal = value * cantidad;
      cargas[index] = {
        ...item,
        unitPrice: value,
        lineTotal,
      } as unknown as unknown;
      montos.cargas = cargas as unknown as unknown[];
      p.montos = montos;
      return p as unknown as PayloadShape;
    });
  }

  function setLonasMonto(value: number) {
    setDraftPayload((prev) => {
      const p = (prev ? { ...prev } : {}) as Record<string, unknown>;
      const montos = (asRecord(p.montos) || {}) as Record<string, unknown>;
      const extras = (asRecord(montos.extras) || {}) as Record<string, unknown>;
      extras.lonas = value;
      const lonas = asNumber(extras.lonas);
      const seguro = asNumber(extras.seguro);
      extras.total = lonas + seguro;
      montos.extras = extras;
      p.montos = montos;
      return p as unknown as PayloadShape;
    });
  }

  function setSeguroMonto(value: number) {
    setDraftPayload((prev) => {
      const p = (prev ? { ...prev } : {}) as Record<string, unknown>;
      const montos = (asRecord(p.montos) || {}) as Record<string, unknown>;
      const extras = (asRecord(montos.extras) || {}) as Record<string, unknown>;
      extras.seguro = value;
      const lonas = asNumber(extras.lonas);
      const seguro = asNumber(extras.seguro);
      extras.total = lonas + seguro;
      montos.extras = extras;
      p.montos = montos;
      return p as unknown as PayloadShape;
    });
  }

  function openTicket() {
    const p = (draftPayload ?? payload) ?? {};
    const base = (structuredClone(p) as unknown as Record<string, unknown>) ?? {};
    // Ensure header data is present
    base.folio = row?.folio ?? asString((base as { folio?: unknown }).folio);
    base.tarifaOrigen = row?.origen ?? asString((base as { tarifaOrigen?: unknown }).tarifaOrigen);
    base.destino = row?.destino ?? asString((base as { destino?: unknown }).destino);
    base.divisa = row?.moneda ?? asString((base as { divisa?: unknown }).divisa) ?? "MXN";
    // Ensure montos.total is current
    const montos = (asRecord((base as { montos?: unknown }).montos) || {}) as Record<string, unknown>;
    montos.total = computedTotal;
    (base as { montos?: unknown }).montos = montos;
    const json = JSON.stringify(base);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = `/platf/cotizaciones/ticket?d=${encodeURIComponent(b64)}&auto=1`;
    window.open(url, "_blank");
  }

  async function savePrices() {
    if (!row) return;
    setSavePricesMessage("");
    setSavePricesError("");
    setSavingPrices(true);
    const sourcePayload = (draftPayload ?? payload) ?? {};
    const basePayload =
      (structuredClone(sourcePayload) as unknown as Record<string, unknown>) ??
      {};
    const montos = (asRecord(basePayload.montos) || {}) as Record<string, unknown>;
    const extras = (asRecord(montos.extras) || {}) as Record<string, unknown>;
    const lonas = asNumber(extras.lonas);
    const seguro = asNumber(extras.seguro);
    extras.total = lonas + seguro;
    montos.extras = extras;
    montos.total = computedTotal;
    basePayload.montos = montos;

    const lonasBlock = asRecord(basePayload.lonas);
    if (lonasBlock) lonasBlock.monto = String(lonas);
    if (lonasBlock) basePayload.lonas = lonasBlock;

    const seguroBlock = asRecord(basePayload.seguro);
    if (seguroBlock) seguroBlock.monto = String(seguro);
    if (seguroBlock) basePayload.seguro = seguroBlock;

    const newPayload = basePayload as unknown;
    const newTotal = computedTotal;
    const { error } = await supabase
      .from("cotizaciones_pendientes")
      .update({ payload: newPayload, total: newTotal })
      .eq("id", row.id);
    if (error) {
      setSavingPrices(false);
      setSavePricesError(
        error.message ||
          "No se pudieron guardar los cambios.",
      );
      return;
    }
    const { data: refreshed, error: refreshError } = await supabase
      .from("cotizaciones_pendientes")
      .select(
        "id,created_at,folio,origen,destino,moneda,total,enviado_por,status,payload",
      )
      .eq("id", row.id)
      .maybeSingle();

    if (!refreshError && refreshed) {
      setRow(refreshed as PendingRow);
      setDraftPayload(
        ((refreshed as PendingRow).payload as PayloadShape | null) ?? null,
      );
    } else {
      setRow({ ...row, total: newTotal, payload: newPayload as unknown });
      setDraftPayload((newPayload as unknown) as PayloadShape);
    }
    setSavingPrices(false);
    setSavePricesMessage("Cambios guardados.");
  }


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
                  Ver cotización
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  {row?.folio || "—"} · {row ? `${row.origen} → ${row.destino}` : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openTicket()}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                >
                  Descargar ticket
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/platf")}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                >
                  Regresar
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-6 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                {errorMessage}
              </div>
            ) : null}

            {row ? (
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Empresa
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {asString(payload?.empresa) || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Cliente
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {asString(payload?.cliente) || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Emite
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {asString(payload?.emitidaPor) || row.enviado_por || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Correo
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {asString(payload?.correoEmitente) || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Fecha emisión
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {asString(payload?.fechaEmision) || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Fecha caducidad
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {asString(payload?.fechaCaducidad) || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                    <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Servicios
                    </div>
                    <div className="p-4">
                      <div className="space-y-3">
                        {(() => {
                          const p = (draftPayload as PayloadShape | null) ?? payload;
                          const montos = asRecord(
                            (p as unknown as { montos?: unknown })?.montos,
                          );
                          const servicios = asArray(
                            (montos as unknown as { servicios?: unknown })?.servicios,
                          );
                          return servicios.map((x, idx) => {
                            const r = asRecord(x);
                            const subtotal = asNumber(
                              (r as unknown as { subtotal?: unknown })?.subtotal,
                            );
                            const unitPrice = asNumber(
                              (r as unknown as { unitPrice?: unknown })?.unitPrice,
                            );
                            const extraMixta = asNumber(
                              (r as unknown as { extraMixta?: unknown })?.extraMixta,
                            );
                            const indexLabel = String(
                              (r as unknown as { index?: unknown })?.index ?? idx + 1,
                            );
                            return (
                              <div
                                key={String((r as unknown as { id?: unknown })?.id ?? idx)}
                                className="rounded-xl border border-black/[.08] bg-white p-4"
                              >
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Servicio
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {indexLabel}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Tarifa
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {String(
                                        (r as unknown as { tariffType?: unknown })?.tariffType ??
                                          "—",
                                      )}
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Nombre
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {String(
                                        (r as unknown as { label?: unknown })?.label ?? "—",
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Cargas
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {String(
                                        (r as unknown as { cargasCount?: unknown })?.cargasCount ??
                                          "—",
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Cantidad
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {String(
                                        (r as unknown as { cantidadTotal?: unknown })?.cantidadTotal ??
                                          "—",
                                      )}
                                    </div>
                                  </div>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Unitario
                                    </span>
                                    <input
                                      value={String(unitPrice)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = Number(raw.replaceAll(",", "").trim());
                                        if (Number.isFinite(v)) setServiceUnitPrice(idx, v);
                                      }}
                                      inputMode="decimal"
                                      className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Extra
                                    </span>
                                    <input
                                      value={String(extraMixta)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = Number(raw.replaceAll(",", "").trim());
                                        if (Number.isFinite(v)) setServiceExtraMixta(idx, v);
                                      }}
                                      inputMode="decimal"
                                      className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1 md:col-span-2">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Subtotal
                                    </span>
                                    <input
                                      value={String(subtotal)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = Number(raw.replaceAll(",", "").trim());
                                        if (Number.isFinite(v)) setServiceSubtotal(idx, v);
                                      }}
                                      inputMode="decimal"
                                      className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                    <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Cargas
                    </div>
                    <div className="p-4">
                      <div className="space-y-3">
                        {(() => {
                          const p = (draftPayload as PayloadShape | null) ?? payload;
                          const montos = asRecord(
                            (p as unknown as { montos?: unknown })?.montos,
                          );
                          const cargas = asArray(
                            (montos as unknown as { cargas?: unknown })?.cargas,
                          );
                          return cargas.map((x, idx) => {
                            const r = asRecord(x);
                            const total = asNumber(
                              (r as unknown as { lineTotal?: unknown })?.lineTotal,
                            );
                            const unitPrice = asNumber(
                              (r as unknown as { unitPrice?: unknown })?.unitPrice,
                            );
                            const dims = `${String((r as unknown as { largo?: unknown })?.largo ?? "—")}×${String((r as unknown as { ancho?: unknown })?.ancho ?? "—")}×${String((r as unknown as { alto?: unknown })?.alto ?? "—")}`;
                            const serviceIndex = asNumber(
                              (r as unknown as { serviceIndex?: unknown })?.serviceIndex,
                            );
                            const indexLabel = String(
                              (r as unknown as { index?: unknown })?.index ?? idx + 1,
                            );
                            return (
                              <div
                                key={String((r as unknown as { id?: unknown })?.id ?? idx)}
                                className="rounded-xl border border-black/[.08] bg-white p-4"
                              >
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Carga
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {indexLabel}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Servicio
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {serviceIndex ? `Servicio ${serviceIndex}` : "—"}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Cantidad
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {String((r as unknown as { cantidad?: unknown })?.cantidad ?? "—")}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Peso
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {String((r as unknown as { peso?: unknown })?.peso ?? "—")}
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Dimensiones (L×A×H)
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                                      {dims}
                                    </div>
                                  </div>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Unitario
                                    </span>
                                    <input
                                      value={String(unitPrice)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = Number(raw.replaceAll(",", "").trim());
                                        if (Number.isFinite(v)) setCargaUnitPrice(idx, v);
                                      }}
                                      inputMode="decimal"
                                      className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Importe
                                    </span>
                                    <input
                                      value={String(total)}
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const v = Number(raw.replaceAll(",", "").trim());
                                        if (Number.isFinite(v)) setCargaLineTotal(idx, v);
                                      }}
                                      inputMode="decimal"
                                      className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    />
                                  </label>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Ruta
                    </div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">
                      {row.origen} → {row.destino}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Extras
                    </div>
                    <div className="mt-2 space-y-2 text-sm text-zinc-700">
                      {(() => {
                        const p = (draftPayload as PayloadShape | null) ?? payload;
                        const montos = asRecord((p as unknown as { montos?: unknown })?.montos);
                        const extras = asRecord((montos as unknown as { extras?: unknown })?.extras);
                        const lonas = asNumber((extras as unknown as { lonas?: unknown })?.lonas);
                        const seguro = asNumber((extras as unknown as { seguro?: unknown })?.seguro);
                        const extrasTotal =
                          asNumber((extras as unknown as { total?: unknown })?.total) ||
                          lonas + seguro;
                        return (
                          <>
                            <div>
                              Lonas: {formatMoney(lonas, divisa)}
                            </div>
                            <label className="flex items-center gap-2">
                              <span className="w-40">Lonas</span>
                              <input
                                value={String(lonas)}
                                onChange={(e) => {
                                  const v = Number(
                                    e.target.value.replaceAll(",", "").trim(),
                                  );
                                  if (Number.isFinite(v)) setLonasMonto(v);
                                }}
                                inputMode="decimal"
                                className="h-9 w-40 rounded-lg border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                              />
                            </label>
                            <div>
                              Seguro de carga: {formatMoney(seguro, divisa)}
                            </div>
                            <label className="flex items-center gap-2">
                              <span className="w-40">Seguro de carga</span>
                              <input
                                value={String(seguro)}
                                onChange={(e) => {
                                  const v = Number(
                                    e.target.value.replaceAll(",", "").trim(),
                                  );
                                  if (Number.isFinite(v)) setSeguroMonto(v);
                                }}
                                inputMode="decimal"
                                className="h-9 w-40 rounded-lg border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                              />
                            </label>
                            <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                              Extras total:{" "}
                              <span className="font-semibold text-zinc-900">
                                {formatMoney(extrasTotal, divisa)}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Total (sin impuestos)
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-900">
                      {formatMoney(computedTotal, divisa)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {divisa} · Sin impuestos
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Guardar cambios
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-3">
                      <button
                        type="button"
                        onClick={() => void savePrices()}
                        disabled={savingPrices}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-60"
                      >
                        {savingPrices ? "Guardando..." : "Guardar"}
                      </button>
                      {savePricesError ? (
                        <div className="text-sm text-red-700">{savePricesError}</div>
                      ) : savePricesMessage ? (
                        <div className="text-sm text-emerald-700">{savePricesMessage}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
