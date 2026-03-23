"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { servicesSupabase, supabase } from "@/lib/supabase/client";
import { Sidebar } from "@/platf/Sidebar";
import { Topbar } from "@/platf/Topbar";
import { useNotifications } from "@/platf/notifications";

type ProfileRow = {
  nombre: string | null;
  apellido: string | null;
  avatar_url?: string | null;
  base: { nombre: string } | null;
  puesto: { nombre: string; rol: { nombre: string } | null } | null;
};

type TarifaRow = {
  origen: string;
  destino: string;
  precio_rabon: number;
  precio_sencillo: number;
  precio_sencillo_sp: number;
  precio_full: number;
  precio_full_sp: number;
  moneda?: string | null;
};

type TarifaBaseKey = "manzanillo" | "altamira" | "veracruz";
type QuoteType = "rabon" | "sencillo" | "full" | "sencillo_sp" | "full_sp";
type ServiceType =
  | "carga_general"
  | "carga_contenerizada"
  | "carga_mixta_especializada"
  | "carga_maritima";
type TariffType = "" | QuoteType;
type YesNo = "si" | "no";
type Currency = "MXN" | "USD" | "EUR";
type CargaRow = {
  id: string;
  serviceId: string;
  cantidad: string;
  largo: string;
  ancho: string;
  alto: string;
  peso: string;
};

type ServiceBlock = {
  id: string;
  servicioEquipo: string;
  tariffType: TariffType;
  tiempoCargaDescarga: 8 | 12 | 24;
  cargoExtraAplica: YesNo;
  cargoExtra: string;
  tolvaId: string;
  tolvaNombre: string;
  tolvaPrecio: string;
  unitarioManual?: string;
};

type MixtaBlock = {
  id: string;
  tipoServicio: string;
  equipoSobredimensionado: YesNo;
  tiempoCargaDescarga: 8 | 12 | 24;
  precioUnitario: string;
  pilotosAplica: YesNo;
  pilotosCantidad: string;
  maniobristasAplica: YesNo;
  maniobristasCantidad: string;
  camionesAuxiliaresAplica: YesNo;
  camionesAuxiliaresCantidad: string;
  paqueteId: string;
  paqueteNombre: string;
  paqueteIngreso: string;
  paqueteTrincaje: string;
  paqueteAlmacenaje: string;
};

const tarifaBases: { key: TarifaBaseKey; label: string; table: string }[] = [
  { key: "manzanillo", label: "Manzanillo", table: "tarifas_manzanillo" },
  { key: "altamira", label: "Altamira", table: "tarifas_altamira" },
  { key: "veracruz", label: "Veracruz", table: "tarifas_veracruz" },
];

function normalizeBaseName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function detectTarifaBaseKey(baseName: string): TarifaBaseKey | "" {
  if (!baseName) return "";
  const baseNormalized = normalizeBaseName(baseName);
  if (baseNormalized.includes("manzanillo")) return "manzanillo";
  if (baseNormalized.includes("altamira")) return "altamira";
  if (baseNormalized.includes("veracruz")) return "veracruz";
  return "";
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

function parseMoneyInput(value: string) {
  const cleaned = value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function tarifaPriceForType(tarifa: TarifaRow | null, tipo: QuoteType | "") {
  if (!tarifa || !tipo) return 0;
  if (tipo === "rabon") return tarifa.precio_rabon ?? 0;
  if (tipo === "sencillo") return tarifa.precio_sencillo ?? 0;
  if (tipo === "full") return tarifa.precio_full ?? 0;
  if (tipo === "sencillo_sp") return tarifa.precio_sencillo_sp ?? 0;
  return tarifa.precio_full_sp ?? 0;
}

function serviceLabel(service: ServiceType) {
  if (service === "carga_general") return "Carga general";
  if (service === "carga_contenerizada") return "Carga contenerizada";
  if (service === "carga_mixta_especializada") return "Carga mixta / especializada";
  return "Carga marítima";
}

function dateToInputValue(date: Date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function threeLetters(value: string) {
  const cleaned = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.slice(0, 3).toUpperCase();
}

function generateRowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newServiceBlock(): ServiceBlock {
  return {
    id: generateRowId(),
    servicioEquipo: "",
    tariffType: "",
    tiempoCargaDescarga: 12,
    cargoExtraAplica: "no",
    cargoExtra: "",
    tolvaId: "",
    tolvaNombre: "",
    tolvaPrecio: "",
    unitarioManual: "",
  };
}

function newMixtaBlock(): MixtaBlock {
  return {
    id: generateRowId(),
    tipoServicio: "",
    equipoSobredimensionado: "no",
    tiempoCargaDescarga: 12,
    precioUnitario: "",
    pilotosAplica: "no",
    pilotosCantidad: "",
    maniobristasAplica: "no",
    maniobristasCantidad: "",
    camionesAuxiliaresAplica: "no",
    camionesAuxiliaresCantidad: "",
    paqueteId: "",
    paqueteNombre: "",
    paqueteIngreso: "",
    paqueteTrincaje: "",
    paqueteAlmacenaje: "",
  };
}

type GoogleMapsLatLngBounds = {
  extend: (value: unknown) => void;
};

type GoogleMapsMap = {
  fitBounds: (bounds: GoogleMapsLatLngBounds, padding?: number) => void;
  setOptions: (opts: unknown) => void;
};

type GoogleMapsMarker = {
  setMap: (map: GoogleMapsMap | null) => void;
};

type GoogleMapsDirectionsRenderer = {
  setMap: (map: GoogleMapsMap | null) => void;
  setDirections: (directions: unknown) => void;
};

type GoogleMapsDirectionsService = {
  route: (
    request: unknown,
    callback: (result: unknown, status: string) => void,
  ) => void;
};

type GoogleMapsDirectionsLeg = {
  distance?: { text?: string; value?: number };
  duration?: { text?: string; value?: number };
};

type GoogleMapsDirectionsRoute = {
  legs?: GoogleMapsDirectionsLeg[];
  warnings?: string[];
  summary?: string;
};

type GoogleMapsDirectionsResult = {
  routes?: GoogleMapsDirectionsRoute[];
};

type GoogleMapsGeocodeResult = {
  geometry: { location: unknown };
};

type GoogleMapsGeocoder = {
  geocode: (
    request: { address: string },
    callback: (results: unknown[] | null, status: string) => void,
  ) => void;
};

type GoogleMapsNamespace = {
  maps: {
    Map: new (el: HTMLElement, opts: unknown) => GoogleMapsMap;
    Marker: new (opts: unknown) => GoogleMapsMarker;
    DirectionsRenderer: new (opts: unknown) => GoogleMapsDirectionsRenderer;
    DirectionsService: new () => GoogleMapsDirectionsService;
    Geocoder: new () => GoogleMapsGeocoder;
    LatLngBounds: new () => GoogleMapsLatLngBounds;
    TravelMode: { DRIVING: unknown };
    event: { trigger: (instance: unknown, eventName: string) => void };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsNamespace;
    __googleMapsScriptPromise?: Promise<void>;
  }
}

function loadGoogleMapsScript(apiKey: string) {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsScriptPromise) return window.__googleMapsScriptPromise;

  window.__googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-google-maps-loader="true"]',
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("No se pudo cargar Google Maps.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&v=weekly&language=es&region=MX`;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("No se pudo cargar Google Maps.")),
    );
    document.head.appendChild(script);
  });

  return window.__googleMapsScriptPromise;
}

function SelectPopover({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = "cotizacion-base-listbox";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selected = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-black/[.12] bg-white px-3 text-left text-sm text-zinc-900 outline-none transition-colors hover:bg-black/[.01] focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
      >
        <span className={selected ? "truncate" : "truncate text-zinc-400"}>
          {selected || placeholder}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-zinc-500"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-2xl border border-black/[.12] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
          role="listbox"
          id={listboxId}
        >
          <div className="max-h-64 overflow-auto p-1">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onValueChange(o.value);
                    setOpen(false);
                  }}
                  className={
                    active
                      ? "flex w-full items-center justify-between rounded-xl bg-zinc-950 px-3 py-2 text-left text-sm text-white"
                      : "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-zinc-900 hover:bg-black/[.04]"
                  }
                  role="option"
                  aria-selected={active}
                >
                  <span className="truncate">{o.label}</span>
                  {active ? (
                    <svg
                      className="h-4 w-4 shrink-0 text-white"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.42-.01L3.29 9.21a1 1 0 1 1 1.42-1.4l3.04 3.082 6.54-6.586a1 1 0 0 1 1.414-.016Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DestinoCombobox({
  value,
  onValueChange,
  options,
  disabled,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = "cotizacion-destino-listbox";

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 200);
    const result: string[] = [];
    for (const o of options) {
      if (result.length >= 200) break;
      if (o.toLowerCase().includes(q)) result.push(o);
    }
    return result;
  }, [options, value]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const el = rootRef.current;
      if (!el) return;
      const target = e.target as Node | null;
      if (target && !el.contains(target)) setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <input
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && !disabled}
        aria-autocomplete="list"
        aria-controls={listboxId}
      />

      {open && !disabled ? (
        <div
          className="absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-2xl border border-black/[.12] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
          role="listbox"
          id={listboxId}
        >
          <div className="max-h-72 overflow-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500">
                Sin resultados
              </div>
            ) : (
              filtered.map((d) => {
                const active = d === value;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      onValueChange(d);
                      setOpen(false);
                    }}
                    className={
                      active
                        ? "flex w-full items-center justify-between rounded-xl bg-zinc-950 px-3 py-2 text-left text-sm text-white"
                        : "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-zinc-900 hover:bg-black/[.04]"
                    }
                    role="option"
                    aria-selected={active}
                  >
                    <span className="truncate">{d}</span>
                    {active ? (
                      <svg
                        className="h-4 w-4 shrink-0 text-white"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.3a1 1 0 0 1-1.42-.01L3.29 9.21a1 1 0 1 1 1.42-1.4l3.04 3.082 6.54-6.586a1 1 0 0 1 1.414-.016Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-black/[.08] bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
            {options.length.toLocaleString("es-MX")} destinos · mostrando{" "}
            {filtered.length.toLocaleString("es-MX")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CotizacionesPage() {
  const router = useRouter();
  const notifications = useNotifications();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const googleMapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "";

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<string>("");
  const [puesto, setPuesto] = useState<string>("");
  const [rol, setRol] = useState<string>("");
  const [nombreCompleto, setNombreCompleto] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [viewerUserId, setViewerUserId] = useState<string>("");
  const isAdmin = useMemo(() => rol.trim().toLowerCase() === "administrador", [rol]);

  const [tarifasLoading, setTarifasLoading] = useState(false);
  const [tarifasError, setTarifasError] = useState("");
  const [destinos, setDestinos] = useState<string[]>([]);
  const [tarifaBase, setTarifaBase] = useState<TarifaBaseKey | "">("");
  const [destino, setDestino] = useState("");
  const [tarifa, setTarifa] = useState<TarifaRow | null>(null);
  const [tarifaOrigen, setTarifaOrigen] = useState<string>("");

  const routeMapRef = useRef<HTMLDivElement | null>(null);
  const routeMapInstanceRef = useRef<GoogleMapsMap | null>(null);
  const routeDirectionsRendererRef = useRef<GoogleMapsDirectionsRenderer | null>(
    null,
  );
  const routeMarkersRef = useRef<GoogleMapsMarker[]>([]);
  const [routeMapStatus, setRouteMapStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [routeMapMessage, setRouteMapMessage] = useState("");
  const [routeDistance, setRouteDistance] = useState("");
  const [routeDuration, setRouteDuration] = useState("");
  const [routeTolls, setRouteTolls] = useState("");

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  const [cliente, setCliente] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [clientesCatalog, setClientesCatalog] = useState<
    { id: string; nombre: string; empresa: string | null }[]
  >([]);
  const [clientesCatalogLoading, setClientesCatalogLoading] = useState(false);
  const [clientesCatalogError, setClientesCatalogError] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [emitidaPor, setEmitidaPor] = useState("");
  const [correoEmitente, setCorreoEmitente] = useState("");
  const [fechaEmision, setFechaEmision] = useState(() =>
    dateToInputValue(new Date()),
  );
  const fechaCaducidad = useMemo(() => {
    if (!fechaEmision) return "";
    return dateToInputValue(addDays(new Date(fechaEmision), 15));
  }, [fechaEmision]);

  const [folio, setFolio] = useState("");
  const [folioLoading, setFolioLoading] = useState(false);
  const [folioError, setFolioError] = useState("");

  const [servicio, setServicio] = useState<ServiceType>("carga_general");
  const [servicesCatalog, setServicesCatalog] = useState<string[]>([]);
  const [servicesCatalogLoading, setServicesCatalogLoading] = useState(false);
  const [servicesCatalogError, setServicesCatalogError] = useState("");
  const [tolvas, setTolvas] = useState<{ id: string; nombre: string }[]>([]);
  const [tolvasLoading, setTolvasLoading] = useState(false);
  const [tolvasError, setTolvasError] = useState("");
  const [paquetes, setPaquetes] = useState<
    {
      id: string;
      nombre: string;
      items: string[];
      ingresoDefault: number | null;
      ingresoRequerido: boolean;
      trincajeDefault: number | null;
      trincajeRequerido: boolean;
      almacenajeDefault: number | null;
      almacenajeRequerido: boolean;
      almacenajeNota: string;
    }[]
  >([]);
  const [paquetesLoading, setPaquetesLoading] = useState(false);
  const [paquetesError, setPaquetesError] = useState("");
  const [serviceBlocks, setServiceBlocks] = useState<ServiceBlock[]>(() => [
    newServiceBlock(),
  ]);
  const [mixtaBlocks, setMixtaBlocks] = useState<MixtaBlock[]>(() => [
    newMixtaBlock(),
  ]);
  const [divisa, setDivisa] = useState<Currency>("MXN");
  const [cargas, setCargas] = useState<CargaRow[]>(() => [
    {
      id: generateRowId(),
      serviceId: "",
      cantidad: "1",
      largo: "",
      ancho: "",
      alto: "",
      peso: "",
    },
  ]);
  const [lonaMetros, setLonaMetros] = useState("");
  const [lonaLargo, setLonaLargo] = useState("");
  const [lonaAncho, setLonaAncho] = useState("");
  const [lonaAlto, setLonaAlto] = useState("");
  const [montoLonas, setMontoLonas] = useState("");
  const [montoSeguroCarga, setMontoSeguroCarga] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [tipo, setTipo] = useState<QuoteType>("sencillo");

  const servicioTable = useMemo(() => {
    if (servicio === "carga_general") return "carga_general";
    if (servicio === "carga_contenerizada") return "carga_contenerizada";
    if (servicio === "carga_mixta_especializada") return "equipos_cargamix";
    return "carga_maritima";
  }, [servicio]);

  function setServicioAndReset(next: ServiceType) {
    setServicio(next);
    setServiceBlocks([newServiceBlock()]);
    setMixtaBlocks([newMixtaBlock()]);
    setDivisa("MXN");
    setCargas([
      {
        id: generateRowId(),
        serviceId: "",
        cantidad: "1",
        largo: "",
        ancho: "",
        alto: "",
        peso: "",
      },
    ]);
    setLonaMetros("");
    setLonaLargo("");
    setLonaAncho("");
    setLonaAlto("");
    setMontoLonas("");
    setMontoSeguroCarga("");
  }

  const servicioEquipoOptions = useMemo(() => {
    if (servicio !== "carga_general") return servicesCatalog;
    const tolvaNames = tolvas.map((t) => `Tolva: ${t.nombre}`);
    return [...servicesCatalog, ...tolvaNames].sort((a, b) => a.localeCompare(b));
  }, [servicesCatalog, servicio, tolvas]);

  const cargoExtraOptions = useMemo(() => {
    return ["LONAS", "LONAS + SEGURO DE CARGA", "SEGURO DE CARGA"];
  }, []);

  const lonasAplica = useMemo(() => {
    if (servicio !== "carga_general") return false;
    return serviceBlocks.some(
      (b) => b.cargoExtraAplica === "si" && b.cargoExtra.includes("LONAS"),
    );
  }, [servicio, serviceBlocks]);

  const seguroAplica = useMemo(() => {
    if (servicio !== "carga_general") return false;
    return serviceBlocks.some(
      (b) => b.cargoExtraAplica === "si" && b.cargoExtra.includes("SEGURO"),
    );
  }, [servicio, serviceBlocks]);

  useEffect(() => {
    const defaultServiceId =
      servicio === "carga_mixta_especializada"
        ? mixtaBlocks[0]?.id ?? ""
        : serviceBlocks[0]?.id ?? "";
    if (!defaultServiceId) return;

    setCargas((prev) => {
      let changed = false;
      const validIds =
        servicio === "carga_mixta_especializada"
          ? new Set(mixtaBlocks.map((b) => b.id))
          : new Set(serviceBlocks.map((b) => b.id));

      const next = prev.map((c) => {
        if (!c.serviceId || !validIds.has(c.serviceId)) {
          changed = true;
          return { ...c, serviceId: defaultServiceId };
        }
        return c;
      });
      return changed ? next : prev;
    });
  }, [mixtaBlocks, serviceBlocks, servicio]);

  const paquetesOptions = useMemo(() => {
    if (paquetes.length > 0) return paquetes.map((p) => p.nombre);
    return [
      "Paquete exportación 1 x 20 DC. 2026",
      "Paquete Exportación de automóviles 1 x 40 HC - 1x20 DC",
    ];
  }, [paquetes]);

  const empresasCatalog = useMemo(() => {
    const set = new Set<string>();
    for (const c of clientesCatalog) {
      const v = (c.empresa || "").trim();
      if (v) set.add(v);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [clientesCatalog]);

  useEffect(() => {
    let cancelled = false;

    async function loadServiciosCatalog() {
      setServicesCatalogError("");
      setServicesCatalog([]);
      setServicesCatalogLoading(true);

      const catClient =
        servicio === "carga_general" || servicio === "carga_mixta_especializada"
          ? servicesSupabase
          : supabase;
      const { data, error } = await catClient.from(servicioTable).select("*").limit(2000);

      if (cancelled) return;

      if (error) {
        const err = error as { code?: string; message?: string; details?: string; hint?: string };
        const source =
          servicio === "carga_general" || servicio === "carga_mixta_especializada"
            ? "SERVICES"
            : "PRINCIPAL";
        setServicesCatalogLoading(false);
        setServicesCatalogError(
          `No se pudieron cargar los servicios (tabla ${servicioTable}, fuente ${source}). ${String(err.code ?? "")} ${String(err.message ?? "")}`.trim(),
        );
        return;
      }

      const rows = (data as Array<Record<string, unknown>> | null) ?? [];
      if (rows.length === 0) {
        const source =
          servicio === "carga_general" || servicio === "carga_mixta_especializada"
            ? "SERVICES"
            : "PRINCIPAL";
        setServicesCatalog([]);
        setServicesCatalogLoading(false);
        setServicesCatalogError(
          `La tabla ${servicioTable} (fuente ${source}) no tiene registros o no son visibles (RLS/policies).`,
        );
        return;
      }
      const set = new Set<string>();
      const candidateKeys = [
        "servicio",
        "nombre",
        "label",
        "equipo",
        "nombre_equipo",
        "titulo",
        "descripcion",
      ];
      for (const r of rows) {
        let raw = "";
        for (const k of candidateKeys) {
          const v = r[k];
          if (typeof v === "string" && v.trim()) {
            raw = v;
            break;
          }
        }
        if (!raw) {
          for (const [, v] of Object.entries(r)) {
            if (typeof v === "string" && v.trim()) {
              raw = v;
              break;
            }
          }
        }
        const name = (raw || "").trim();
        if (name) set.add(name);
      }
      setServicesCatalog(Array.from(set).sort((a, b) => a.localeCompare(b)));
      setServicesCatalogLoading(false);
    }

    void loadServiciosCatalog();

    return () => {
      cancelled = true;
    };
  }, [servicio, servicioTable]);

  useEffect(() => {
    let cancelled = false;

    async function loadPaquetes() {
      setPaquetesError("");
      setPaquetes([]);

      if (servicio !== "carga_mixta_especializada") return;

      setPaquetesLoading(true);
      const { data, error } = await servicesSupabase
        .from("paquetes_cargamix")
        .select(
          "id,nombre,items,ingreso_default,ingreso_requerido,trincaje_default,trincaje_requerido,almacenaje_default,almacenaje_requerido,almacenaje_nota",
        )
        .limit(2000);

      if (cancelled) return;

      if (error) {
        setPaquetesLoading(false);
        setPaquetesError(
          "No se pudieron cargar los paquetes (revisa la tabla paquetes_cargamix y sus permisos).",
        );
        return;
      }

      const rows =
        (data as
          | Array<{
              id?: unknown;
              nombre?: unknown;
              items?: unknown;
              ingreso_default?: unknown;
              ingreso_requerido?: unknown;
              trincaje_default?: unknown;
              trincaje_requerido?: unknown;
              almacenaje_default?: unknown;
              almacenaje_requerido?: unknown;
              almacenaje_nota?: unknown;
            }>
          | null) ?? [];

      setPaquetes(
        rows
          .map((r) => {
            const itemsRaw = Array.isArray(r.items) ? r.items : [];
            const items = itemsRaw
              .map((x) => {
                if (typeof x === "string") return x.trim();
                if (x == null) return "";
                return String(x).trim();
              })
              .filter(Boolean);
            return {
              id: String(r.id ?? ""),
              nombre: String(r.nombre ?? ""),
              items,
              ingresoDefault:
                typeof r.ingreso_default === "number" && Number.isFinite(r.ingreso_default)
                  ? r.ingreso_default
                  : null,
              ingresoRequerido: Boolean(r.ingreso_requerido),
              trincajeDefault:
                typeof r.trincaje_default === "number" && Number.isFinite(r.trincaje_default)
                  ? r.trincaje_default
                  : null,
              trincajeRequerido: Boolean(r.trincaje_requerido),
              almacenajeDefault:
                typeof r.almacenaje_default === "number" &&
                Number.isFinite(r.almacenaje_default)
                  ? r.almacenaje_default
                  : null,
              almacenajeRequerido: Boolean(r.almacenaje_requerido),
              almacenajeNota: typeof r.almacenaje_nota === "string" ? r.almacenaje_nota : "",
            };
          })
          .filter((r) => r.id && r.nombre),
      );
      setPaquetesLoading(false);
    }

    void loadPaquetes();

    return () => {
      cancelled = true;
    };
  }, [servicio]);

  useEffect(() => {
    let cancelled = false;

    async function loadTolvas() {
      setTolvasError("");
      setTolvas([]);

      if (servicio !== "carga_general") return;

      setTolvasLoading(true);
      const { data, error } = await servicesSupabase
        .from("tolvas")
        .select("id,nombre")
        .order("nombre", { ascending: true })
        .limit(2000);

      if (cancelled) return;

      if (error) {
        setTolvasLoading(false);
        setTolvasError(
          "No se pudieron cargar las tolvas (revisa la tabla tolvas y sus permisos).",
        );
        return;
      }

      const rows = (data as { id: unknown; nombre: unknown }[] | null) ?? [];
      setTolvas(
        rows
          .map((r) => ({ id: String(r.id ?? ""), nombre: String(r.nombre ?? "") }))
          .filter((r) => r.id && r.nombre),
      );
      setTolvasLoading(false);
    }

    void loadTolvas();

    return () => {
      cancelled = true;
    };
  }, [servicio]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      setViewerUserId(user.id);

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

      const baseName = profileRow?.base?.nombre ?? "";
      setBase(baseName);
      setPuesto(profileRow?.puesto?.nombre ?? "");
      setRol(profileRow?.puesto?.rol?.nombre ?? "");
      setNombreCompleto(fullName);
      setEmitidaPor((prev) => (prev ? prev : fullName));
      setCorreoEmitente((prev) => (prev ? prev : user.email ?? ""));
      const baseAvatarUrl =
        profileRow?.avatar_url ??
        (user.user_metadata as { avatar_url?: string }).avatar_url ??
        "";
      setAvatarUrl(baseAvatarUrl ? `${baseAvatarUrl}?v=${Date.now()}` : "");
      setTarifaBase(detectTarifaBaseKey(baseName));
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    async function loadClientes() {
      setClientesCatalogError("");
      setClientesCatalog([]);
      if (!viewerUserId) return;
      setClientesCatalogLoading(true);

      let query = supabase
        .from("clientes")
        .select("id,nombre_completo,empresa,owner_user_id")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!isAdmin) query = query.eq("owner_user_id", viewerUserId);

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        setClientesCatalogLoading(false);
        const err = error as { code?: string; message?: string };
        const msg = String(err.message ?? "");
        if (err.code === "42P01" || /relation\s+\"clientes\"\s+does not exist/i.test(msg)) {
          setClientesCatalogError('Falta la tabla "clientes" o sus policies (RLS).');
        } else {
          setClientesCatalogError(
            error.message ||
              "No se pudieron cargar clientes (revisa permisos/RLS de la tabla clientes).",
          );
        }
        return;
      }

      const rows =
        ((data as unknown) as Array<{
          id?: unknown;
          nombre_completo?: unknown;
          empresa?: unknown;
        }> | null) ?? [];

      const mapped = rows
        .map((r) => ({
          id: String(r.id ?? ""),
          nombre: String(r.nombre_completo ?? "").trim(),
          empresa: r.empresa == null ? null : String(r.empresa),
        }))
        .filter((r) => r.id && r.nombre);

      setClientesCatalog(
        mapped.sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX")),
      );
      setClientesCatalogLoading(false);
    }

    void loadClientes();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, viewerUserId]);

  const tarifasTable = useMemo(() => {
    if (!tarifaBase) return "";
    return tarifaBases.find((b) => b.key === tarifaBase)?.table ?? "";
  }, [tarifaBase]);

  const tarifaBaseLabel = useMemo(() => {
    if (!tarifaBase) return "";
    return tarifaBases.find((b) => b.key === tarifaBase)?.label ?? "";
  }, [tarifaBase]);

  const folioPrefix = useMemo(() => {
    return tarifaBaseLabel ? threeLetters(tarifaBaseLabel) : "";
  }, [tarifaBaseLabel]);

  const emisionYear = useMemo(() => {
    if (!fechaEmision) return "";
    const year = new Date(fechaEmision).getFullYear();
    return String(year);
  }, [fechaEmision]);

  useEffect(() => {
    if (step !== 2) return;

    const el = routeMapRef.current;
    if (!el) return;
    const mapEl = el;

    if (!googleMapsApiKey) {
      setRouteMapStatus("error");
      setRouteMapMessage(
        "Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en tu .env.local para ver el mapa.",
      );
      return;
    }

    let cancelled = false;

    async function geocode(geocoder: GoogleMapsGeocoder, address: string) {
      return new Promise<GoogleMapsGeocodeResult>((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
          const first = (results?.[0] as GoogleMapsGeocodeResult | undefined) ?? null;
          if (status === "OK" && first) resolve(first);
          else reject(new Error(status || "ERROR"));
        });
      });
    }

    function latLngToNumbers(value: unknown): { lat: number; lng: number } | null {
      const v = value as
        | { lat?: unknown; lng?: unknown }
        | { lat?: () => unknown; lng?: () => unknown }
        | null;
      if (!v) return null;
      const latRaw = typeof v.lat === "function" ? v.lat() : v.lat;
      const lngRaw = typeof v.lng === "function" ? v.lng() : v.lng;
      if (typeof latRaw !== "number" || !Number.isFinite(latRaw)) return null;
      if (typeof lngRaw !== "number" || !Number.isFinite(lngRaw)) return null;
      return { lat: latRaw, lng: lngRaw };
    }

    function parseTollsResponse(json: unknown) {
      const obj = json as Record<string, unknown> | null;
      if (!obj) return { ok: false as const };
      const ok = obj.ok === true;
      const tollInfo = obj.tollInfo as Record<string, unknown> | null;
      const estimatedPrice = tollInfo?.estimatedPrice;
      const prices = Array.isArray(estimatedPrice) ? estimatedPrice : [];
      const formatted = prices
        .map((p) => (p as Record<string, unknown> | null)?.formatted)
        .filter((x): x is string => typeof x === "string" && x.length > 0);
      return { ok, formatted };
    }

    async function update() {
      try {
        setRouteMapStatus("loading");
        setRouteMapMessage("");
        setRouteDistance("");
        setRouteDuration("");
        setRouteTolls("");
        await loadGoogleMapsScript(googleMapsApiKey);
        if (cancelled) return;

        const g = window.google;
        if (!g?.maps) throw new Error("Google Maps no disponible.");

        const map =
          routeMapInstanceRef.current ??
          new g.maps.Map(mapEl, {
            center: { lat: 23.6345, lng: -102.5528 },
            zoom: 5,
            mapId: googleMapId || undefined,
            disableDefaultUI: true,
            zoomControl: true,
            fullscreenControl: true,
          });

        routeMapInstanceRef.current = map;
        map.setOptions({ mapId: googleMapId || undefined });
        setRouteMapStatus("ready");
        setRouteMapMessage("Calculando ruta...");
        for (const m of routeMarkersRef.current) {
          try {
            m.setMap(null);
          } catch {}
        }
        routeMarkersRef.current = [];

        const originLabel = tarifaBaseLabel?.trim();
        const destinationLabel = destino?.trim();
        if (!originLabel || !destinationLabel) {
          setRouteMapMessage("Selecciona origen y destino para trazar la ruta.");
          setRouteDistance("");
          setRouteDuration("");
          setRouteTolls("");
          return;
        }

        const geocoder = new g.maps.Geocoder();
        const [origin, destination] = await Promise.all([
          geocode(geocoder, `${originLabel}, México`),
          geocode(geocoder, `${destinationLabel}, México`),
        ]);
        if (cancelled) return;

        const originLoc = origin.geometry.location;
        const destinationLoc = destination.geometry.location;

        const bounds = new g.maps.LatLngBounds();
        bounds.extend(originLoc);
        bounds.extend(destinationLoc);

        map.fitBounds(bounds, 64);

        if (routeDirectionsRendererRef.current) {
          try {
            routeDirectionsRendererRef.current.setMap(null);
          } catch {}
        }

        const directionsRenderer = new g.maps.DirectionsRenderer({
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: "#111827",
            strokeOpacity: 0.9,
            strokeWeight: 5,
          },
        });
        routeDirectionsRendererRef.current = directionsRenderer;
        directionsRenderer.setMap(map);

        const directionsService = new g.maps.DirectionsService();
        const routeResult = await new Promise<GoogleMapsDirectionsResult | null>(
          (resolve) => {
          directionsService.route(
            {
              origin: originLoc,
              destination: destinationLoc,
              travelMode: g.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === "OK" && result) {
                directionsRenderer.setDirections(result);
                resolve(result as GoogleMapsDirectionsResult);
                return;
              }
              resolve(null);
            },
          );
          },
        );

        const leg = routeResult?.routes?.[0]?.legs?.[0];
        setRouteDistance(leg?.distance?.text ?? "");
        setRouteDuration(leg?.duration?.text ?? "");

        const originNumbers = latLngToNumbers(originLoc);
        const destinationNumbers = latLngToNumbers(destinationLoc);
        if (originNumbers && destinationNumbers) {
          setRouteTolls("Calculando casetas...");
          void (async () => {
            try {
              const res = await fetch("/api/tolls", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  origin: originNumbers,
                  destination: destinationNumbers,
                }),
              });
              const json = (await res.json()) as unknown;
              const parsed = parseTollsResponse(json);
              if (!cancelled && parsed.ok) {
                const cost = parsed.formatted.join(" + ");
                setRouteTolls(cost ? `Costo estimado: ${cost}` : "Sin costo estimado.");
              } else if (!cancelled) {
                setRouteTolls("Sin información de casetas.");
              }
            } catch {
              if (!cancelled) setRouteTolls("Sin información de casetas.");
            }
          })();
        } else {
          setRouteTolls("Sin información de casetas.");
        }

        routeMarkersRef.current = [
          new g.maps.Marker({
            position: originLoc,
            map,
            title: originLabel,
            label: { text: "O", color: "white" },
          }),
          new g.maps.Marker({
            position: destinationLoc,
            map,
            title: destinationLabel,
            label: { text: "D", color: "white" },
          }),
        ];

        setRouteMapMessage("");

        setTimeout(() => {
          try {
            g.maps.event.trigger(map, "resize");
            map.fitBounds(bounds, 64);
          } catch {}
        }, 0);
      } catch {
        if (cancelled) return;
        setRouteMapStatus("error");
        setRouteMapMessage(
          "No se pudo cargar la ruta. Revisa que tu API Key tenga habilitado Maps JavaScript API (y Geocoding/Directions si aplica).",
        );
      }
    }

    void update();

    return () => {
      cancelled = true;
    };
  }, [destino, googleMapId, googleMapsApiKey, step, tarifaBaseLabel]);

  useEffect(() => {
    let cancelled = false;

    async function loadFolio() {
      setFolioError("");
      setFolio("");

      if (!folioPrefix || !emisionYear || !destino.trim()) return;

      setFolioLoading(true);

      const year = Number(emisionYear);
      const { data, error } = await supabase.rpc("next_cotizacion_folio", {
        p_base: tarifaBaseLabel,
        p_prefix: folioPrefix,
        p_year: year,
      });

      if (cancelled) return;

      if (error) {
        setFolioLoading(false);
        setFolioError(
          "No se pudo calcular el folio automáticamente (revisa la función next_cotizacion_folio y la tabla cotizacion_folios).",
        );
        const seq = 1;
        setFolio(`${folioPrefix}${emisionYear}${String(seq).padStart(4, "0")}`);
        return;
      }

      const row = (Array.isArray(data) ? data[0] : data) as
        | { folio?: unknown }
        | null;
      const nextFolio = typeof row?.folio === "string" ? row.folio : "";
      if (!nextFolio) {
        setFolioLoading(false);
        setFolioError(
          "No se pudo calcular el folio automáticamente (respuesta inválida).",
        );
        return;
      }

      setFolio(nextFolio);
      setFolioLoading(false);
    }

    if (step === 2) void loadFolio();

    return () => {
      cancelled = true;
    };
  }, [destino, emisionYear, folioPrefix, step, tarifaBaseLabel]);

  useEffect(() => {
    let cancelled = false;

    async function loadDestinosForBase() {
      setTarifasError("");
      setTarifa(null);
      setDestino("");
      setDestinos([]);
      setTarifaOrigen("");

      if (!tarifasTable) return;
      setTarifasLoading(true);

      const preferredOrigen = tarifaBaseLabel;
      const { data: destinosByOrigen, error: destinosByOrigenError } =
        await supabase
          .from(tarifasTable)
          .select("destino")
          .eq("origen", preferredOrigen)
          .limit(5000);

      if (cancelled) return;

      if (destinosByOrigenError) {
        setTarifasLoading(false);
        setTarifasError(destinosByOrigenError.message);
        return;
      }

      const preferRows =
        (destinosByOrigen as { destino: string }[] | null) ?? [];

      const rowsToUse =
        preferRows.length > 0
          ? preferRows
          : (((await supabase
              .from(tarifasTable)
              .select("destino")
              .limit(8000))
              .data as { destino: string }[] | null) ?? []);

      if (cancelled) return;

      const destinoSet = new Set<string>();
      for (const r of rowsToUse) {
        if (r.destino) destinoSet.add(r.destino);
      }
      setDestinos(Array.from(destinoSet).sort((a, b) => a.localeCompare(b)));
      setTarifasLoading(false);
    }

    void loadDestinosForBase();

    return () => {
      cancelled = true;
    };
  }, [servicio, tarifaBaseLabel, tarifasTable]);

  useEffect(() => {
    let cancelled = false;

    async function loadTarifa() {
      setTarifasError("");
      setTarifa(null);
      setTarifaOrigen("");

      if (!tarifasTable || !tarifaBaseLabel || !destino) return;
      setTarifasLoading(true);

      const selectCols =
        "origen,destino,precio_rabon,precio_sencillo,precio_sencillo_sp,precio_full,precio_full_sp,moneda";

      const { data: preferred, error: preferredError } = await supabase
        .from(tarifasTable)
        .select(selectCols)
        .eq("origen", tarifaBaseLabel)
        .eq("destino", destino)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (preferredError) {
        setTarifasLoading(false);
        setTarifasError(preferredError.message);
        return;
      }

      if (preferred) {
        const row = (preferred as TarifaRow | null) ?? null;
        setTarifa(row);
        setTarifaOrigen(row?.origen ?? "");
        setTarifasLoading(false);
        return;
      }

      const { data: fallback, error: fallbackError } = await supabase
        .from(tarifasTable)
        .select(selectCols)
        .eq("destino", destino)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (fallbackError) {
        setTarifasLoading(false);
        setTarifasError(fallbackError.message);
        return;
      }

      const row = (fallback as TarifaRow | null) ?? null;
      setTarifa(row);
      setTarifaOrigen(row?.origen ?? "");
      setTarifasLoading(false);
    }

    void loadTarifa();

    return () => {
      cancelled = true;
    };
  }, [destino, servicio, tarifaBaseLabel, tarifasTable]);

  const moneda = divisa;

  const montosServicios = useMemo(() => {
    const blocks = servicio === "carga_mixta_especializada" ? mixtaBlocks : serviceBlocks;

    return blocks.map((b, idx) => {
      const cargasForService = cargas.filter((c) => c.serviceId === b.id);
      const cantidadTotal = cargasForService.reduce((acc, c) => {
        const qty = Number(c.cantidad);
        if (!Number.isFinite(qty) || qty <= 0) return acc;
        return acc + qty;
      }, 0);

      const tipoTarifa =
        servicio === "carga_mixta_especializada"
          ? ""
          : ((b as ServiceBlock).tariffType as QuoteType | "");

      const unitPrice =
        servicio === "carga_mixta_especializada"
          ? parseMoneyInput((b as MixtaBlock).precioUnitario || "")
          : (() => {
              const sb = b as ServiceBlock;
              const manual = parseMoneyInput(sb.unitarioManual || "");
              if (manual > 0) return manual;
              if (
                servicio === "carga_general" &&
                sb.servicioEquipo.startsWith("Tolva: ")
              ) {
                return parseMoneyInput(sb.tolvaPrecio || "");
              }
              return tarifaPriceForType(tarifa, tipoTarifa);
            })();
      const base = unitPrice * cantidadTotal;

      const extraMixta =
        servicio === "carga_mixta_especializada"
          ? parseMoneyInput((b as MixtaBlock).paqueteIngreso || "") +
            parseMoneyInput((b as MixtaBlock).paqueteTrincaje || "") +
            parseMoneyInput((b as MixtaBlock).paqueteAlmacenaje || "")
          : 0;

      const subtotal = base + extraMixta;

      const label =
        servicio === "carga_mixta_especializada"
          ? ((b as MixtaBlock).tipoServicio || "—")
          : ((b as ServiceBlock).servicioEquipo || "—");

      return {
        id: b.id,
        index: idx + 1,
        label,
        tariffType: tipoTarifa,
        cargasCount: cargasForService.length,
        cantidadTotal,
        unitPrice,
        extraMixta,
        subtotal,
      };
    });
  }, [cargas, mixtaBlocks, serviceBlocks, servicio, tarifa]);

  const montosServiciosById = useMemo(() => {
    return new Map(montosServicios.map((r) => [r.id, r]));
  }, [montosServicios]);

  const montosCargas = useMemo(() => {
    const blocks = servicio === "carga_mixta_especializada" ? mixtaBlocks : serviceBlocks;
    return cargas.map((c, idx) => {
      const serviceIndex = blocks.findIndex((b) => b.id === c.serviceId);
      const tipoTarifa =
        servicio === "carga_mixta_especializada"
          ? ""
          : (((blocks[serviceIndex] as ServiceBlock | undefined)?.tariffType ??
              "") as QuoteType | "");
      const tolvaUnitPrice =
        servicio === "carga_general" &&
        (blocks[serviceIndex] as ServiceBlock | undefined)?.servicioEquipo?.startsWith(
          "Tolva: ",
        )
          ? parseMoneyInput(
              ((blocks[serviceIndex] as ServiceBlock | undefined)?.tolvaPrecio as
                | string
                | undefined
                | null) || "",
            )
          : 0;
      const mixtaUnitPrice =
        servicio === "carga_mixta_especializada"
          ? parseMoneyInput(
              ((blocks[serviceIndex] as MixtaBlock | undefined)?.precioUnitario as
                | string
                | undefined
                | null) || "",
            )
          : 0;
      const manualUnitPrice =
        servicio !== "carga_mixta_especializada"
          ? parseMoneyInput(
              ((blocks[serviceIndex] as ServiceBlock | undefined)?.unitarioManual as
                | string
                | undefined
                | null) || "",
            )
          : 0;
      const unitPrice =
        mixtaUnitPrice > 0
          ? mixtaUnitPrice
          : manualUnitPrice > 0
            ? manualUnitPrice
            : tolvaUnitPrice > 0
              ? tolvaUnitPrice
              : tarifaPriceForType(tarifa, tipoTarifa);
      const qty = Number(c.cantidad);
      const cantidad = Number.isFinite(qty) && qty > 0 ? qty : 0;
      return {
        id: c.id,
        index: idx + 1,
        serviceIndex: serviceIndex >= 0 ? serviceIndex + 1 : 0,
        cantidad,
        largo: c.largo,
        ancho: c.ancho,
        alto: c.alto,
        peso: c.peso,
        unitPrice,
        lineTotal: unitPrice * cantidad,
      };
    });
  }, [cargas, mixtaBlocks, serviceBlocks, servicio, tarifa]);

  const montosExtras = useMemo(() => {
    const lonas = lonasAplica ? parseMoneyInput(montoLonas) : 0;
    const seguro = seguroAplica ? parseMoneyInput(montoSeguroCarga) : 0;
    const tolvasTotal =
      servicio === "carga_general"
        ? serviceBlocks.reduce((acc, b) => {
            if (!b.servicioEquipo.startsWith("Tolva: ")) return acc;
            return acc + parseMoneyInput(b.tolvaPrecio || "");
          }, 0)
        : 0;
    return { lonas, seguro, tolvas: tolvasTotal, total: lonas + seguro + tolvasTotal };
  }, [lonasAplica, montoLonas, montoSeguroCarga, seguroAplica, servicio, serviceBlocks]);

  const montosTotal = useMemo(() => {
    const servicios = montosServicios.reduce((acc, r) => acc + r.subtotal, 0);
    return servicios + montosExtras.total;
  }, [montosExtras.total, montosServicios]);

  const pesoTotal = useMemo(() => {
    let total = 0;
    for (const r of cargas) {
      const qty = Number(r.cantidad);
      const peso = Number(r.peso);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (!Number.isFinite(peso) || peso < 0) continue;
      total += qty * peso;
    }
    return total;
  }, [cargas]);

  const volumenTotal = useMemo(() => {
    let total = 0;
    for (const r of cargas) {
      const qty = Number(r.cantidad);
      const l = Number(r.largo);
      const a = Number(r.ancho);
      const h = Number(r.alto);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      if (!Number.isFinite(l) || l <= 0) continue;
      if (!Number.isFinite(a) || a <= 0) continue;
      if (!Number.isFinite(h) || h <= 0) continue;
      total += qty * l * a * h;
    }
    return total;
  }, [cargas]);

  const quoteLabel = useMemo(() => {
    if (tipo === "rabon") return "Rabón";
    if (tipo === "sencillo") return "Sencillo";
    if (tipo === "full") return "Full";
    if (tipo === "sencillo_sp") return "Sencillo SP";
    return "Full SP";
  }, [tipo]);

  async function copyQuote() {
    const origenToUse =
      servicio === "carga_mixta_especializada"
        ? (tarifaOrigen || tarifaBaseLabel).trim()
        : tarifaOrigen.trim();
    if (servicio !== "carga_mixta_especializada" && !tarifa) return;
    if (!origenToUse || !destino) return;

    const cargaLines = cargas.map((c, idx) => {
      const blocks =
        servicio === "carga_mixta_especializada" ? mixtaBlocks : serviceBlocks;
      const serviceIndex = blocks.findIndex((b) => b.id === c.serviceId);
      const serviceLabelText =
        serviceIndex >= 0 ? `Servicio ${serviceIndex + 1}` : "Servicio —";

      const parts = [
        `Carga ${idx + 1}`,
        serviceLabelText,
        `Cantidad: ${c.cantidad || "—"}`,
        `Largo: ${c.largo || "—"}`,
        `Ancho: ${c.ancho || "—"}`,
        `Alto: ${c.alto || "—"}`,
        `Peso: ${c.peso || "—"}`,
      ];
      return parts.join(" · ");
    });

    const serviceLines =
      servicio === "carga_mixta_especializada"
        ? mixtaBlocks.map((b, idx) => {
            const personal = [
              ` · Sobredimensionado: ${b.equipoSobredimensionado === "si" ? "Sí" : "No"}`,
              ` · Precio unitario: ${b.precioUnitario || "—"}`,
              b.pilotosAplica === "si"
                ? ` · Pilotos: ${b.pilotosCantidad || "—"}`
                : "",
              b.maniobristasAplica === "si"
                ? ` · Maniobristas: ${b.maniobristasCantidad || "—"}`
                : "",
              b.camionesAuxiliaresAplica === "si"
                ? ` · Camiones auxiliares: ${b.camionesAuxiliaresCantidad || "—"}`
                : "",
            ].join("");
            return `Servicio ${idx + 1}: Tipo ${b.tipoServicio || "—"} · Tiempo ${b.tiempoCargaDescarga} horas${b.paqueteNombre ? ` · Paquete: ${b.paqueteNombre}` : ""}${personal}`;
          })
          : serviceBlocks.map((b, idx) => {
            const extra =
              servicio === "carga_general"
                ? ` · Cargos extra: ${b.cargoExtraAplica === "si" ? b.cargoExtra || "—" : "No"}`
                : "";
            const tolva =
              servicio === "carga_general" && b.tolvaId
                ? ` · Tolva: ${b.tolvaNombre || "—"} · Precio: ${b.tolvaPrecio || "—"}`
                : "";
            const tt =
              servicio === "carga_contenerizada" ? "" : ` · Tariff type: ${b.tariffType || "—"}`;
            return `Servicio ${idx + 1}: ${b.servicioEquipo || "—"}${tt} · Tiempo ${b.tiempoCargaDescarga} horas${extra}${tolva}`;
          });

    const lines = [
      "COTIZACIÓN",
      folio.trim() ? `Folio: ${folio.trim()}` : null,
      empresa.trim() ? `Empresa: ${empresa.trim()}` : null,
      cliente.trim() ? `Cliente: ${cliente.trim()}` : null,
      emitidaPor.trim() ? `Emite: ${emitidaPor.trim()}` : null,
      correoEmitente.trim() ? `Correo: ${correoEmitente.trim()}` : null,
      fechaEmision ? `Fecha de emisión: ${fechaEmision}` : null,
      fechaCaducidad ? `Fecha de caducidad: ${fechaCaducidad}` : null,
      `Servicio: ${serviceLabel(servicio)}`,
      ...serviceLines,
      divisa ? `Divisa: ${divisa}` : null,
      ...cargaLines,
      `Peso total: ${pesoTotal}`,
      volumenTotal > 0 ? `Volumen total: ${volumenTotal}` : null,
      lonasAplica
        ? `Lona: Metros ${lonaMetros || "—"} · Largo ${lonaLargo || "—"} · Ancho ${lonaAncho || "—"} · Alto ${lonaAlto || "—"}`
        : null,
      `Ruta: ${origenToUse} → ${destino}`,
      servicio !== "carga_mixta_especializada" ? `Unidad: ${quoteLabel}` : null,
      `Precio (sin impuestos): ${formatMoney(montosTotal, divisa)} (${divisa})`,
    ].filter(Boolean) as string[];

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      notifications.add({
        title: "Cotización copiada",
        description: "Se copió al portapapeles.",
        variant: "success",
      });
    } catch {
      notifications.add({
        title: "No se pudo copiar",
        description: "Copia manualmente desde el resumen.",
        variant: "error",
      });
    }
  }

  async function sendPendingQuote() {
    if (sending) return;
    setSending(true);
    setSent(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const origenToSave =
        servicio === "carga_mixta_especializada"
          ? (tarifaOrigen || tarifaBaseLabel).trim()
          : tarifaOrigen.trim();

      // Selección de cliente/empresa: ya no se crea cliente nuevo automáticamente

      const payload = {
        folio,
        empresa,
        cliente,
        emitidaPor,
        correoEmitente,
        fechaEmision,
        fechaCaducidad,
        tarifaOrigen: origenToSave,
        destino,
        servicio,
        divisa,
        serviceBlocks,
        mixtaBlocks,
        cargas,
        lonas: {
          aplica: lonasAplica,
          metros: lonaMetros,
          largo: lonaLargo,
          ancho: lonaAncho,
          alto: lonaAlto,
          monto: montoLonas,
        },
        seguro: {
          aplica: seguroAplica,
          monto: montoSeguroCarga,
        },
        montos: {
          servicios: montosServicios,
          cargas: montosCargas,
          extras: montosExtras,
          total: montosTotal,
        },
      };

      const { error } = await supabase.from("cotizaciones_pendientes").insert({
        folio: folio.trim(),
        origen: origenToSave,
        destino: destino.trim(),
        moneda: divisa,
        total: montosTotal,
        enviado_por: nombreCompleto || emitidaPor || user.email || "—",
        enviado_por_user_id: user.id,
        status: "pendiente",
        payload,
      });

      if (error) {
        notifications.add({
          title: "No se pudo enviar",
          description: error.message,
          variant: "error",
        });
        return;
      }

      setSent(true);
      notifications.add({
        title: "Enviado a administradores",
        description: "La cotización quedó como pendiente de confirmación.",
        variant: "success",
      });
    } catch {
      notifications.add({
        title: "No se pudo enviar",
        description: "Ocurrió un error inesperado.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
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
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Cotizaciones
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Completa los pasos para armar una cotización.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <span
                  className={
                    step === 1
                      ? "rounded-full bg-zinc-950 px-2 py-0.5 text-white"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"
                  }
                >
                  1
                </span>
                <span>Datos</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <span
                  className={
                    step === 2
                      ? "rounded-full bg-zinc-950 px-2 py-0.5 text-white"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"
                  }
                >
                  2
                </span>
                <span>Ruta</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <span
                  className={
                    step === 3
                      ? "rounded-full bg-zinc-950 px-2 py-0.5 text-white"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"
                  }
                >
                  3
                </span>
                <span>Servicio</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <span
                  className={
                    step === 4
                      ? "rounded-full bg-zinc-950 px-2 py-0.5 text-white"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"
                  }
                >
                  4
                </span>
                <span>Detalle</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <span
                  className={
                    step === 5
                      ? "rounded-full bg-zinc-950 px-2 py-0.5 text-white"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"
                  }
                >
                  5
                </span>
                <span>Montos</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/[.08] bg-white px-3 py-2 text-xs font-medium text-zinc-700">
                <span
                  className={
                    step === 6
                      ? "rounded-full bg-zinc-950 px-2 py-0.5 text-white"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-700"
                  }
                >
                  6
                </span>
                <span>Hoja</span>
              </div>
            </div>

            {step === 1 ? (
              <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="text-sm font-semibold text-zinc-900">
                  Paso 1 · Datos
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Empresa
                    </span>
                    <select
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                    >
                      <option value="">Selecciona</option>
                      {empresasCatalog.map((em) => (
                        <option key={em} value={em}>
                          {em}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Cliente
                    </span>
                    <select
                      value={clienteId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setClienteId(v);
                        const selected =
                          clientesCatalog.find((c) => c.id === v) ?? null;
                        if (selected) {
                          setCliente(selected.nombre);
                          if (selected.empresa) setEmpresa(selected.empresa);
                        }
                      }}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                      disabled={clientesCatalogLoading}
                    >
                      <option value="">Selecciona</option>
                      {clientesCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                    {clientesCatalogError ? (
                      <div className="text-xs text-red-600">{clientesCatalogError}</div>
                    ) : null}
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Quién la emite
                    </span>
                    <input
                      value={emitidaPor}
                      onChange={(e) => setEmitidaPor(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      placeholder="Nombre del asesor"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Correo del emitente
                    </span>
                    <input
                      value={correoEmitente}
                      onChange={(e) => setCorreoEmitente(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      placeholder="correo@empresa.com"
                      inputMode="email"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Fecha de emisión
                    </span>
                    <input
                      type="date"
                      value={fechaEmision}
                      onChange={(e) => setFechaEmision(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Fecha de caducidad
                    </span>
                    <input
                      type="date"
                      value={fechaCaducidad}
                      readOnly
                      disabled
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                    />
                  </label>

                  <div className="flex justify-end md:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(2);
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838]"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            ) : step === 2 ? (
              <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Paso 2 · Ruta y folio
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {empresa} · {cliente} · {emitidaPor} · {correoEmitente} ·{" "}
                      {fechaEmision} → {fechaCaducidad}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                  >
                    Regresar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_420px]">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Origen (Base)
                      </span>
                      <SelectPopover
                        value={tarifaBase}
                        onValueChange={(v) => setTarifaBase(v as TarifaBaseKey | "")}
                        options={[
                          { value: "", label: "Selecciona base" },
                          ...tarifaBases.map((b) => ({
                            value: b.key,
                            label: b.label,
                          })),
                        ]}
                        placeholder="Selecciona base"
                        disabled={tarifasLoading}
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Destino
                      </span>
                      <DestinoCombobox
                        value={destino}
                        onValueChange={setDestino}
                        options={destinos}
                        disabled={tarifasLoading || !tarifasTable || !tarifaBase}
                        placeholder={
                          !tarifasTable
                            ? "Selecciona base primero"
                            : tarifasLoading
                              ? "Cargando..."
                              : tarifaBase
                                ? "Escribe para buscar destino"
                                : "Selecciona base primero"
                        }
                      />
                    </label>

                    <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 md:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Folio
                      </div>
                      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-lg font-semibold text-zinc-900">
                          {folioLoading ? "Calculando..." : folio || "—"}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {folioPrefix && emisionYear
                            ? `${folioPrefix} + ${emisionYear} + consecutivo`
                            : "Selecciona origen y destino"}
                        </div>
                      </div>
                      {folioError ? (
                        <div className="mt-2 text-sm text-zinc-700">
                          {folioError}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:col-span-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Distancia
                        </div>
                        <div className="mt-2 text-lg font-semibold text-zinc-900">
                          {routeDistance || "—"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Tiempo
                        </div>
                        <div className="mt-2 text-lg font-semibold text-zinc-900">
                          {routeDuration || "—"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Casetas
                        </div>
                        <div className="mt-2 text-sm font-semibold text-zinc-900">
                          {routeTolls || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between gap-3 md:col-span-2">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-black/[.12] bg-white px-6 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                      >
                        Regresar
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60"
                        disabled={false}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                    <div className="flex items-center justify-between gap-3 border-b border-black/[.08] bg-zinc-50 px-4 py-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Ruta en mapa
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-xs text-zinc-600">
                          {tarifaBaseLabel && destino
                            ? `${tarifaBaseLabel} → ${destino}`
                            : "Selecciona origen y destino"}
                        </div>
                        <div className="shrink-0 rounded-full border border-black/[.08] bg-white px-2 py-1 text-[11px] font-medium text-zinc-700">
                          {googleMapId ? `Map ID: ${googleMapId}` : "Sin Map ID"}
                        </div>
                      </div>
                    </div>
                    <div className="relative">
                      <div
                        ref={routeMapRef}
                        className="h-[340px] w-full bg-zinc-100"
                      />
                      {routeMapStatus === "loading" ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-zinc-700 backdrop-blur-[2px]">
                          Cargando mapa...
                        </div>
                      ) : null}
                      {routeMapStatus === "error" ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 px-6 text-center text-sm font-medium text-zinc-800 backdrop-blur-[2px]">
                          {routeMapMessage || "No se pudo cargar el mapa."}
                        </div>
                      ) : null}
                    </div>
                    {routeMapStatus !== "error" && routeMapMessage ? (
                      <div className="px-4 py-3 text-xs text-zinc-600">
                        {routeMapMessage}
                      </div>
                    ) : null}
                  </div>
                </div>

                {tarifasError ? (
                  <div className="mt-4 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    {tarifasError}
                  </div>
                ) : null}
              </div>
            ) : step === 3 ? (
              <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Paso 3 · Tipo de servicio
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {folio || "—"} ·{" "}
                      {tarifaOrigen && destino ? `${tarifaOrigen} → ${destino}` : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCargas((prev) => [
                          ...prev,
                          {
                            id: generateRowId(),
                            serviceId:
                              (servicio === "carga_mixta_especializada"
                                ? mixtaBlocks[0]?.id
                                : serviceBlocks[0]?.id) ?? "",
                            cantidad: "1",
                            largo: "",
                            ancho: "",
                            alto: "",
                            peso: "",
                          },
                        ])
                      }
                      className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                    >
                      Agregar carga
                    </button>
                    {servicio === "carga_general" ||
                    servicio === "carga_mixta_especializada" ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (servicio === "carga_mixta_especializada") {
                            setMixtaBlocks((prev) => [...prev, newMixtaBlock()]);
                          } else {
                            setServiceBlocks((prev) => [...prev, newServiceBlock()]);
                          }
                        }}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                      >
                        Agregar servicio
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                    >
                      Regresar
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 md:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Tipo de servicio
                    </span>
                    <select
                      value={servicio}
                      onChange={(e) =>
                        setServicioAndReset(e.target.value as ServiceType)
                      }
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      disabled={tarifasLoading}
                    >
                      <option value="carga_general">Carga general</option>
                      <option value="carga_contenerizada">Carga contenerizada</option>
                      <option value="carga_mixta_especializada">
                        Carga mixta / especializada
                      </option>
                      <option value="carga_maritima">Carga marítima</option>
                    </select>
                  </label>

                  {servicio === "carga_mixta_especializada" ? (
                    <>
                      {mixtaBlocks.map((b, idx) => (
                        <div
                          key={b.id}
                          className="md:col-span-2 overflow-hidden rounded-2xl border border-black/[.08] bg-white"
                        >
                          <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Servicio {idx + 1}
                          </div>
                          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1 md:col-span-2">
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Tipo de servicio
                              </span>
                              <select
                                value={b.tipoServicio}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMixtaBlocks((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id ? { ...x, tipoServicio: v } : x,
                                    ),
                                  );
                                }}
                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                disabled={tarifasLoading || servicesCatalogLoading}
                              >
                                <option value="">
                                  {servicesCatalogLoading
                                    ? "Cargando..."
                                    : "Selecciona un tipo de servicio"}
                                </option>
                                {servicioEquipoOptions.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Equipo sobredimensionado
                              </span>
                              <select
                                value={b.equipoSobredimensionado}
                                onChange={(e) => {
                                  const v = e.target.value as YesNo;
                                  setMixtaBlocks((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id
                                        ? { ...x, equipoSobredimensionado: v }
                                        : x,
                                    ),
                                  );
                                }}
                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                disabled={tarifasLoading}
                              >
                                <option value="no">No</option>
                                <option value="si">Sí</option>
                              </select>
                            </label>

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Tiempo Carga/Descarga
                              </span>
                              <select
                                value={b.tiempoCargaDescarga}
                                onChange={(e) => {
                                  const next = Number(e.target.value) as 8 | 12 | 24;
                                  setMixtaBlocks((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id
                                        ? { ...x, tiempoCargaDescarga: next }
                                        : x,
                                    ),
                                  );
                                }}
                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                disabled={tarifasLoading}
                              >
                                <option value={8}>8 horas</option>
                                <option value={12}>12 horas</option>
                                <option value={24}>24 horas</option>
                              </select>
                            </label>

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Precio unitario (manual)
                              </span>
                              <input
                                value={b.precioUnitario}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMixtaBlocks((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id ? { ...x, precioUnitario: v } : x,
                                    ),
                                  );
                                }}
                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                placeholder="0.00"
                                inputMode="decimal"
                              />
                            </label>

                            <div className="md:col-span-2 overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                              <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Personal / Apoyos
                              </div>
                              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Unidades piloto
                                  </span>
                                  <select
                                    value={b.pilotosAplica}
                                    onChange={(e) => {
                                      const next = e.target.value as YesNo;
                                      setMixtaBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? {
                                                ...x,
                                                pilotosAplica: next,
                                                pilotosCantidad:
                                                  next === "si"
                                                    ? x.pilotosCantidad
                                                    : "",
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    disabled={tarifasLoading}
                                  >
                                    <option value="no">No</option>
                                    <option value="si">Sí</option>
                                  </select>
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Cantidad de pilotos
                                  </span>
                                  <input
                                    value={b.pilotosCantidad}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setMixtaBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? { ...x, pilotosCantidad: next }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                                    inputMode="numeric"
                                    placeholder="0"
                                    disabled={b.pilotosAplica !== "si"}
                                  />
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Maniobristas
                                  </span>
                                  <select
                                    value={b.maniobristasAplica}
                                    onChange={(e) => {
                                      const next = e.target.value as YesNo;
                                      setMixtaBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? {
                                                ...x,
                                                maniobristasAplica: next,
                                                maniobristasCantidad:
                                                  next === "si"
                                                    ? x.maniobristasCantidad
                                                    : "",
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    disabled={tarifasLoading}
                                  >
                                    <option value="no">No</option>
                                    <option value="si">Sí</option>
                                  </select>
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Cantidad de maniobristas
                                  </span>
                                  <input
                                    value={b.maniobristasCantidad}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setMixtaBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? { ...x, maniobristasCantidad: next }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                                    inputMode="numeric"
                                    placeholder="0"
                                    disabled={b.maniobristasAplica !== "si"}
                                  />
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Camiones auxiliares
                                  </span>
                                  <select
                                    value={b.camionesAuxiliaresAplica}
                                    onChange={(e) => {
                                      const next = e.target.value as YesNo;
                                      setMixtaBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? {
                                                ...x,
                                                camionesAuxiliaresAplica: next,
                                                camionesAuxiliaresCantidad:
                                                  next === "si"
                                                    ? x.camionesAuxiliaresCantidad
                                                    : "",
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    disabled={tarifasLoading}
                                  >
                                    <option value="no">No</option>
                                    <option value="si">Sí</option>
                                  </select>
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Cantidad de camiones
                                  </span>
                                  <input
                                    value={b.camionesAuxiliaresCantidad}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setMixtaBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? {
                                                ...x,
                                                camionesAuxiliaresCantidad: next,
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                                    inputMode="numeric"
                                    placeholder="0"
                                    disabled={b.camionesAuxiliaresAplica !== "si"}
                                  />
                                </label>
                              </div>
                            </div>

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Paquetes
                              </span>
                              <select
                                value={b.paqueteId}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMixtaBlocks((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id
                                        ? (() => {
                                            const selected =
                                              paquetes.find((p) => p.id === v) ?? null;

                                            if (selected) {
                                              return {
                                                ...x,
                                                paqueteId: selected.id,
                                                paqueteNombre: selected.nombre,
                                                paqueteIngreso:
                                                  selected.ingresoDefault != null
                                                    ? String(selected.ingresoDefault)
                                                    : "",
                                                paqueteTrincaje:
                                                  selected.trincajeDefault != null
                                                    ? String(selected.trincajeDefault)
                                                    : "",
                                                paqueteAlmacenaje:
                                                  selected.almacenajeDefault != null
                                                    ? String(selected.almacenajeDefault)
                                                    : "",
                                              };
                                            }

                                            if (v === "Paquete exportación 1 x 20 DC. 2026") {
                                              return {
                                                ...x,
                                                paqueteId: v,
                                                paqueteNombre: v,
                                                paqueteIngreso: "",
                                                paqueteTrincaje: "",
                                                paqueteAlmacenaje: "25",
                                              };
                                            }

                                            if (
                                              v ===
                                              "Paquete Exportación de automóviles 1 x 40 HC - 1x20 DC"
                                            ) {
                                              return {
                                                ...x,
                                                paqueteId: v,
                                                paqueteNombre: v,
                                                paqueteIngreso: "14500",
                                                paqueteTrincaje: "4500",
                                                paqueteAlmacenaje: "250",
                                              };
                                            }

                                            return {
                                              ...x,
                                              paqueteId: v,
                                              paqueteNombre: v,
                                            };
                                          })()
                                        : x,
                                    ),
                                  );
                                }}
                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                disabled={tarifasLoading}
                              >
                                <option value="">Selecciona un paquete</option>
                                {paquetes.length > 0
                                  ? paquetes.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.nombre}
                                      </option>
                                    ))
                                  : paquetesOptions.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                              </select>
                              {paquetesError ? (
                                <div className="mt-2 text-xs text-red-600">
                                  {paquetesError}
                                </div>
                              ) : paquetesLoading ? (
                                <div className="mt-2 text-xs text-zinc-500">
                                  Cargando paquetes...
                                </div>
                              ) : null}
                            </label>

                            {b.paqueteId ? (
                              <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 md:col-span-2">
                                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                  Detalle del paquete
                                </div>
                                <div className="mt-2 text-sm font-semibold text-zinc-900">
                                  {b.paqueteNombre || "—"}
                                </div>
                                {paquetes.length > 0 ? (
                                  (() => {
                                    const selected =
                                      paquetes.find((p) => p.id === b.paqueteId) ?? null;
                                    if (!selected || selected.items.length === 0) return null;
                                    return (
                                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                                        {selected.items.map((it, itemIdx) => (
                                          <li
                                            key={`${selected.id}-${itemIdx}-${String(it)}`}
                                          >
                                            {String(it)}
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  })()
                                ) : null}
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Ingreso
                                    </span>
                                    <input
                                      value={b.paqueteIngreso}
                                      onChange={(e) => {
                                        const next = e.target.value;
                                        setMixtaBlocks((prev) =>
                                          prev.map((x) =>
                                            x.id === b.id
                                              ? { ...x, paqueteIngreso: next }
                                              : x,
                                          ),
                                        );
                                      }}
                                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                    />
                                  </label>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Trincaje
                                    </span>
                                    <input
                                      value={b.paqueteTrincaje}
                                      onChange={(e) => {
                                        const next = e.target.value;
                                        setMixtaBlocks((prev) =>
                                          prev.map((x) =>
                                            x.id === b.id
                                              ? { ...x, paqueteTrincaje: next }
                                              : x,
                                          ),
                                        );
                                      }}
                                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                    />
                                  </label>

                                  <label className="flex flex-col gap-1">
                                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                      Almacenaje
                                    </span>
                                    <input
                                      value={b.paqueteAlmacenaje}
                                      onChange={(e) => {
                                        const next = e.target.value;
                                        setMixtaBlocks((prev) =>
                                          prev.map((x) =>
                                            x.id === b.id
                                              ? { ...x, paqueteAlmacenaje: next }
                                              : x,
                                          ),
                                        );
                                      }}
                                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                    />
                                  </label>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {serviceBlocks.map((b, idx) => (
                        <div
                          key={b.id}
                          className="md:col-span-2 overflow-hidden rounded-2xl border border-black/[.08] bg-white"
                        >
                          <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Servicio {idx + 1}
                          </div>
                          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Servicio / Equipo
                              </span>
                              <select
                                value={b.servicioEquipo}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const isTolva =
                                    servicio === "carga_general" && v.startsWith("Tolva: ");
                                  const tolvaName = isTolva ? v.replace(/^Tolva:\s*/, "") : "";
                                  const tolva =
                                    isTolva && tolvaName
                                      ? tolvas.find((t) => t.nombre === tolvaName) ?? null
                                      : null;
                                  setServiceBlocks((prev) =>
                                    prev.map((x) => {
                                      if (x.id !== b.id) return x;
                                      return {
                                        ...x,
                                        servicioEquipo: v,
                                        tariffType: "",
                                        tolvaId: tolva ? tolva.id : "",
                                        tolvaNombre: tolva ? tolva.nombre : "",
                                        tolvaPrecio: tolva ? x.tolvaPrecio : "",
                                      };
                                    }),
                                  );
                                }}
                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                disabled={
                                  tarifasLoading ||
                                  servicesCatalogLoading ||
                                  (servicio === "carga_general" && tolvasLoading)
                                }
                              >
                                <option value="">
                                  {servicesCatalogLoading
                                    ? "Cargando..."
                                    : "Selecciona un servicio"}
                                </option>
                                {servicioEquipoOptions.map((o) => (
                                  <option key={o} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                              {servicesCatalogError ? (
                                <div className="mt-2 rounded-xl border border-black/[.08] bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                                  {servicesCatalogError}
                                </div>
                              ) : null}
                              {tolvasError ? (
                                <div className="mt-2 rounded-xl border border-black/[.08] bg-red-50 px-3 py-2 text-sm text-red-800">
                                  {tolvasError}
                                </div>
                              ) : servicesCatalogLoading ? (
                                <div className="mt-2 text-xs text-zinc-500">
                                  Cargando servicios...
                                </div>
                              ) : servicesCatalog.length === 0 ? (
                                <div className="mt-2 text-xs text-zinc-500">
                                  Sin servicios en {servicioTable}.
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-zinc-500">
                                  {servicesCatalog.length} servicios disponibles
                                </div>
                              )}
                            </label>

                            {b.servicioEquipo.startsWith("Tolva: ") ? (
                              <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                  Precio de tolva
                                </span>
                                <input
                                  value={b.tolvaPrecio}
                                  onChange={(e) => {
                                    const next = e.target.value;
                                    setServiceBlocks((prev) =>
                                      prev.map((x) =>
                                        x.id === b.id ? { ...x, tolvaPrecio: next } : x,
                                      ),
                                    );
                                  }}
                                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  disabled={!b.servicioEquipo}
                                />
                              </label>
                            ) : servicio === "carga_contenerizada" ? null : (
                              <label className="flex flex-col gap-1">
                                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                  Tariff type
                                </span>
                                <select
                                  value={b.tariffType}
                                  onChange={(e) => {
                                    const next = e.target.value as TariffType;
                                    setServiceBlocks((prev) =>
                                      prev.map((x) =>
                                        x.id === b.id ? { ...x, tariffType: next } : x,
                                      ),
                                    );
                                    if (next) setTipo(next);
                                  }}
                                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                                  disabled={tarifasLoading || !b.servicioEquipo}
                                >
                                  <option value="">
                                    {b.servicioEquipo
                                      ? "Selecciona un tariff type"
                                      : "Selecciona un servicio primero"}
                                  </option>
                                  <option value="sencillo">Sencillo</option>
                                  <option value="sencillo_sp">Sencillo SP</option>
                                  <option value="full">Full</option>
                                  <option value="full_sp">Full SP</option>
                                  <option value="rabon">Rabón</option>
                                </select>
                              </label>
                            )}

                            <label className="flex flex-col gap-1">
                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                Tiempo Carga/Descarga
                              </span>
                              <select
                                value={b.tiempoCargaDescarga}
                                onChange={(e) => {
                                  const next = Number(e.target.value) as 8 | 12 | 24;
                                  setServiceBlocks((prev) =>
                                    prev.map((x) =>
                                      x.id === b.id
                                        ? { ...x, tiempoCargaDescarga: next }
                                        : x,
                                    ),
                                  );
                                }}
                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                disabled={tarifasLoading}
                              >
                                <option value={8}>8 horas</option>
                                <option value={12}>12 horas</option>
                                <option value={24}>24 horas</option>
                              </select>
                            </label>

                            {servicio === "carga_general" ? (
                              <>
                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Cargos extras
                                  </span>
                                  <select
                                    value={b.cargoExtraAplica}
                                    onChange={(e) => {
                                      const next = e.target.value as YesNo;
                                      setServiceBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? {
                                                ...x,
                                                cargoExtraAplica: next,
                                                cargoExtra:
                                                  next === "si" ? "LONAS" : "",
                                              }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                    disabled={tarifasLoading}
                                  >
                                    <option value="no">No</option>
                                    <option value="si">Sí</option>
                                  </select>
                                </label>

                                <label className="flex flex-col gap-1">
                                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                    Selecciona un cargo
                                  </span>
                                  <select
                                    value={b.cargoExtra}
                                    onChange={(e) => {
                                      const next = e.target.value;
                                      setServiceBlocks((prev) =>
                                        prev.map((x) =>
                                          x.id === b.id
                                            ? { ...x, cargoExtra: next }
                                            : x,
                                        ),
                                      );
                                    }}
                                    className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                                    disabled={
                                      tarifasLoading || b.cargoExtraAplica !== "si"
                                    }
                                  >
                                    <option value="">
                                      {b.cargoExtraAplica === "si"
                                        ? "Selecciona un cargo"
                                        : "Selecciona Sí primero"}
                                    </option>
                                    {cargoExtraOptions.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                                  </select>
                                </label>

                              </>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  <div className="flex justify-between gap-3 md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-black/[.12] bg-white px-6 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                    >
                      Regresar
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838]"
                      disabled={false}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            ) : step === 4 ? (
              <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Paso 4 · Detalle de carga
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {folio || "—"} ·{" "}
                      {tarifaOrigen && destino ? `${tarifaOrigen} → ${destino}` : "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                  >
                    Regresar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        Detalles de la carga
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        Captura solo números
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Divisa
                      </div>
                      <select
                        value={divisa}
                        onChange={(e) => setDivisa(e.target.value as Currency)}
                        className="h-10 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      >
                        <option value="MXN">MXN</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  <div className="md:col-span-2 overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                    <div className="flex items-center justify-between gap-4 border-b border-black/[.08] bg-zinc-50 px-4 py-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Cargas
                      </div>
                    </div>

                    <div className="divide-y divide-black/[.08]">
                      {(servicio === "carga_mixta_especializada" ? mixtaBlocks : serviceBlocks)
                        .map((b, serviceIdx) => {
                          const cargasForService = cargas.filter((c) => c.serviceId === b.id);
                          const serviceTitle =
                            servicio === "carga_mixta_especializada"
                              ? `Servicio ${serviceIdx + 1} · ${(b as MixtaBlock).tipoServicio || "—"}`
                              : `Servicio ${serviceIdx + 1} · ${(b as ServiceBlock).servicioEquipo || "—"}`;

                          return (
                            <div key={b.id} className={serviceIdx % 2 === 0 ? "bg-white" : "bg-zinc-50"}>
                              <div className="flex items-center justify-between gap-4 border-b border-black/[.08] px-4 py-3">
                                <div className="text-sm font-semibold text-zinc-900">
                                  {serviceTitle}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCargas((prev) => [
                                      ...prev,
                                      {
                                        id: generateRowId(),
                                        serviceId: b.id,
                                        cantidad: "1",
                                        largo: "",
                                        ancho: "",
                                        alto: "",
                                        peso: "",
                                      },
                                    ])
                                  }
                                  className="inline-flex h-9 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                                >
                                  Agregar carga
                                </button>
                              </div>

                              {cargasForService.length === 0 ? (
                                <div className="px-4 py-4 text-sm text-zinc-600">
                                  Sin cargas en este servicio.
                                </div>
                              ) : (
                                <div className="divide-y divide-black/[.08]">
                                  {cargasForService.map((r, cargaIdx) => (
                                    <div key={r.id} className="px-4 py-4">
                                      <div className="mb-3 text-sm font-semibold text-zinc-900">
                                        Carga {cargaIdx + 1}
                                      </div>

                                      <div
                                        className={
                                          (servicio === "carga_general" &&
                                            (b as ServiceBlock).servicioEquipo.startsWith(
                                              "Tolva: ",
                                            )) ||
                                          servicio === "carga_contenerizada"
                                            ? "grid grid-cols-1 gap-4"
                                            : "grid grid-cols-1 gap-4 md:grid-cols-2"
                                        }
                                      >
                                        <label className="flex flex-col gap-1">
                                          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                            Cantidad
                                          </span>
                                          <input
                                            value={r.cantidad}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setCargas((prev) =>
                                                prev.map((x) =>
                                                  x.id === r.id ? { ...x, cantidad: v } : x,
                                                ),
                                              );
                                            }}
                                            className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                            inputMode="numeric"
                                            placeholder="1"
                                          />
                                        </label>

                                        {servicio === "carga_contenerizada" ||
                                        (servicio === "carga_general" &&
                                          (b as ServiceBlock).servicioEquipo.startsWith(
                                            "Tolva: ",
                                          )) ? null : (
                                          <>
                                            <label className="flex flex-col gap-1">
                                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Peso
                                              </span>
                                              <input
                                                value={r.peso}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  setCargas((prev) =>
                                                    prev.map((x) =>
                                                      x.id === r.id
                                                        ? { ...x, peso: v }
                                                        : x,
                                                    ),
                                                  );
                                                }}
                                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                                inputMode="decimal"
                                                placeholder="0"
                                              />
                                            </label>

                                            <label className="flex flex-col gap-1">
                                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Largo
                                              </span>
                                              <input
                                                value={r.largo}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  setCargas((prev) =>
                                                    prev.map((x) =>
                                                      x.id === r.id
                                                        ? { ...x, largo: v }
                                                        : x,
                                                    ),
                                                  );
                                                }}
                                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                                inputMode="decimal"
                                                placeholder="0"
                                              />
                                            </label>

                                            <label className="flex flex-col gap-1">
                                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Ancho
                                              </span>
                                              <input
                                                value={r.ancho}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  setCargas((prev) =>
                                                    prev.map((x) =>
                                                      x.id === r.id
                                                        ? { ...x, ancho: v }
                                                        : x,
                                                    ),
                                                  );
                                                }}
                                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                                inputMode="decimal"
                                                placeholder="0"
                                              />
                                            </label>

                                            <label className="flex flex-col gap-1 md:col-span-2">
                                              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                                                Alto
                                              </span>
                                              <input
                                                value={r.alto}
                                                onChange={(e) => {
                                                  const v = e.target.value;
                                                  setCargas((prev) =>
                                                    prev.map((x) =>
                                                      x.id === r.id
                                                        ? { ...x, alto: v }
                                                        : x,
                                                    ),
                                                  );
                                                }}
                                                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                                inputMode="decimal"
                                                placeholder="0"
                                              />
                                            </label>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {servicio === "carga_contenerizada" ? null : (
                      <>
                        <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Peso total
                          </div>
                          <div className="mt-2 text-lg font-semibold text-zinc-900">
                            {pesoTotal}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Volumen total
                          </div>
                          <div className="mt-2 text-lg font-semibold text-zinc-900">
                            {volumenTotal || 0}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {servicio === "carga_general" ? (
                    <div className="md:col-span-2 overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                      <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Lonas
                      </div>
                      <div className="px-4 py-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Metros
                            </span>
                            <input
                              value={lonaMetros}
                              onChange={(e) => setLonaMetros(e.target.value)}
                              className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                              inputMode="decimal"
                              placeholder="0"
                              disabled={!lonasAplica}
                            />
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Largo
                            </span>
                            <input
                              value={lonaLargo}
                              onChange={(e) => setLonaLargo(e.target.value)}
                              className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                              inputMode="decimal"
                              placeholder="0"
                              disabled={!lonasAplica}
                            />
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Ancho
                            </span>
                            <input
                              value={lonaAncho}
                              onChange={(e) => setLonaAncho(e.target.value)}
                              className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                              inputMode="decimal"
                              placeholder="0"
                              disabled={!lonasAplica}
                            />
                          </label>

                          <label className="flex flex-col gap-1">
                            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                              Alto
                            </span>
                            <input
                              value={lonaAlto}
                              onChange={(e) => setLonaAlto(e.target.value)}
                              className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                              inputMode="decimal"
                              placeholder="0"
                              disabled={!lonasAplica}
                            />
                          </label>
                        </div>
                        {!lonasAplica ? (
                          <div className="mt-2 text-xs text-zinc-500">
                            Activa Cargos extras = Sí y selecciona una opción que incluya
                            LONAS para habilitar.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-between gap-3 md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-black/[.12] bg-white px-6 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                    >
                      Regresar
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838]"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </div>
            ) : step === 5 ? (
              <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Paso 5 · Montos
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {folio || "—"} ·{" "}
                      {tarifaOrigen && destino ? `${tarifaOrigen} → ${destino}` : "—"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                  >
                    Regresar
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 md:col-span-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Tipo de Servicio
                    </div>
                    <div className="mt-2 text-sm font-semibold text-zinc-900">
                      {serviceLabel(servicio)}
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {servicio === "carga_mixta_especializada"
                        ? mixtaBlocks.map((b, idx) => (
                            <div key={b.id} className={idx === 0 ? "" : "mt-1"}>
                              {`Servicio ${idx + 1}: Tipo ${b.tipoServicio || "—"} · Tiempo ${b.tiempoCargaDescarga} horas · Precio unitario: ${b.precioUnitario || "—"}${b.paqueteNombre ? ` · Paquete: ${b.paqueteNombre}` : ""} · Sobredimensionado: ${b.equipoSobredimensionado === "si" ? "Sí" : "No"}${b.pilotosAplica === "si" ? ` · Pilotos: ${b.pilotosCantidad || "—"}` : ""}${b.maniobristasAplica === "si" ? ` · Maniobristas: ${b.maniobristasCantidad || "—"}` : ""}${b.camionesAuxiliaresAplica === "si" ? ` · Camiones auxiliares: ${b.camionesAuxiliaresCantidad || "—"}` : ""}`}
                            </div>
                          ))
                        : serviceBlocks.map((b, idx) => (
                            <div key={b.id} className={idx === 0 ? "" : "mt-1"}>
                              {`Servicio ${idx + 1}: ${b.servicioEquipo || "—"}${servicio === "carga_contenerizada" ? "" : ` · Tariff type: ${b.tariffType || "—"}`} · Tiempo ${b.tiempoCargaDescarga} horas${servicio === "carga_general" ? ` · Cargos extra: ${b.cargoExtraAplica === "si" ? b.cargoExtra || "—" : "No"}` : ""}${servicio === "carga_general" && b.tolvaId ? ` · Tolva: ${b.tolvaNombre || "—"} · Precio: ${b.tolvaPrecio || "—"}` : ""}`}
                            </div>
                          ))}
                    </div>
                  </div>

                  {servicio === "carga_mixta_especializada" ? (
                    <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Precio
                      </div>
                      <div className="mt-2 text-sm text-zinc-700">
                        Manual por servicio (configurado en Paso 3).
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Tarifa (según servicio)
                      </div>
                      <div className="mt-2 text-sm text-zinc-700">
                        Configurada en Paso 3 por cada servicio.
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-black/[.08] bg-white p-4 md:col-span-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Total (sin impuestos)
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-zinc-900">
                          {formatMoney(montosTotal, moneda)}
                        </div>
                        <div className="mt-1 text-sm text-zinc-600">{moneda} · Sin impuestos</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyQuote()}
                        disabled={
                          servicio === "carga_mixta_especializada"
                            ? !(tarifaOrigen || tarifaBaseLabel) || !destino
                            : !tarifa || !tarifaOrigen || !destino
                        }
                        className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60"
                      >
                        Copiar cotización
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white md:col-span-2">
                    <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Servicios
                    </div>
                    <div className="overflow-x-auto">
                      {servicio === "carga_mixta_especializada" ? (
                        <table className="w-full border-separate border-spacing-0 text-sm">
                          <thead>
                            <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                              <th className="px-4 py-3">Servicio</th>
                              <th className="px-4 py-3">Tipo</th>
                              <th className="px-4 py-3">Cargas</th>
                              <th className="px-4 py-3">Cantidad</th>
                              <th className="px-4 py-3">Unitario</th>
                              <th className="px-4 py-3">Ingreso</th>
                              <th className="px-4 py-3">Trincaje</th>
                              <th className="px-4 py-3">Almacenaje</th>
                              <th className="px-4 py-3">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[.08]">
                            {mixtaBlocks.map((b, idx) => {
                              const r = montosServiciosById.get(b.id);
                              return (
                                <tr
                                  key={b.id}
                                  className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                                >
                                  <td className="px-4 py-3 font-medium text-zinc-900">
                                    {idx + 1}
                                  </td>
                                  <td className="px-4 py-3">{b.tipoServicio || "—"}</td>
                                  <td className="px-4 py-3">{r?.cargasCount ?? 0}</td>
                                  <td className="px-4 py-3">{r?.cantidadTotal ?? 0}</td>
                                  <td className="px-4 py-3">
                                    <input
                                      value={b.precioUnitario}
                                      onChange={(e) => {
                                        const next = e.target.value;
                                        setMixtaBlocks((prev) =>
                                          prev.map((x) =>
                                            x.id === b.id
                                              ? { ...x, precioUnitario: next }
                                              : x,
                                          ),
                                        );
                                      }}
                                      className="h-10 w-28 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      value={b.paqueteIngreso}
                                      onChange={(e) => {
                                        const next = e.target.value;
                                        setMixtaBlocks((prev) =>
                                          prev.map((x) =>
                                            x.id === b.id
                                              ? { ...x, paqueteIngreso: next }
                                              : x,
                                          ),
                                        );
                                      }}
                                      className="h-10 w-28 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      value={b.paqueteTrincaje}
                                      onChange={(e) => {
                                        const next = e.target.value;
                                        setMixtaBlocks((prev) =>
                                          prev.map((x) =>
                                            x.id === b.id
                                              ? { ...x, paqueteTrincaje: next }
                                              : x,
                                          ),
                                        );
                                      }}
                                      className="h-10 w-28 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      value={b.paqueteAlmacenaje}
                                      onChange={(e) => {
                                        const next = e.target.value;
                                        setMixtaBlocks((prev) =>
                                          prev.map((x) =>
                                            x.id === b.id
                                              ? { ...x, paqueteAlmacenaje: next }
                                              : x,
                                          ),
                                        );
                                      }}
                                      className="h-10 w-28 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-semibold text-zinc-900">
                                    {formatMoney(r?.subtotal ?? 0, moneda)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full border-separate border-spacing-0 text-sm">
                          <thead>
                            <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                              <th className="px-4 py-3">Servicio</th>
                              <th className="px-4 py-3">Nombre</th>
                              {servicio === "carga_contenerizada" ? null : (
                                <th className="px-4 py-3">Tarifa</th>
                              )}
                              <th className="px-4 py-3">Cargas</th>
                              <th className="px-4 py-3">Cantidad</th>
                              <th className="px-4 py-3">Unitario</th>
                              <th className="px-4 py-3">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[.08]">
                                {montosServicios.map((r, idx) => {
                                  const sb =
                                    serviceBlocks.find((x) => x.id === r.id) ?? null;
                                  return (
                                    <tr
                                      key={r.id}
                                      className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                                    >
                                      <td className="px-4 py-3 font-medium text-zinc-900">
                                        {r.index}
                                      </td>
                                      <td className="px-4 py-3">{r.label}</td>
                                      {servicio === "carga_contenerizada" ? null : (
                                        <td className="px-4 py-3">{r.tariffType || "—"}</td>
                                      )}
                                      <td className="px-4 py-3">{r.cargasCount}</td>
                                      <td className="px-4 py-3">{r.cantidadTotal}</td>
                                      <td className="px-4 py-3">
                                        <input
                                          value={sb?.unitarioManual || ""}
                                          onChange={(e) => {
                                            const next = e.target.value;
                                            setServiceBlocks((prev) =>
                                              prev.map((x) =>
                                                x.id === r.id
                                                  ? { ...x, unitarioManual: next }
                                                  : x,
                                              ),
                                            );
                                          }}
                                          className="h-10 w-28 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                                          inputMode="decimal"
                                          placeholder={formatMoney(r.unitPrice, moneda)}
                                        />
                                      </td>
                                      <td className="px-4 py-3 font-semibold text-zinc-900">
                                        {formatMoney(r.subtotal, moneda)}
                                      </td>
                                    </tr>
                                  );
                                })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white md:col-span-2">
                    <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Cargas
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-separate border-spacing-0 text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                            <th className="px-4 py-3">Carga</th>
                            <th className="px-4 py-3">Servicio</th>
                            <th className="px-4 py-3">Cantidad</th>
                            <th className="px-4 py-3">Largo</th>
                            <th className="px-4 py-3">Ancho</th>
                            <th className="px-4 py-3">Alto</th>
                            <th className="px-4 py-3">Peso</th>
                            <th className="px-4 py-3">Importe</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[.08]">
                          {montosCargas.map((r, idx) => (
                            <tr
                              key={r.id}
                              className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                            >
                              <td className="px-4 py-3 font-medium text-zinc-900">
                                {r.index}
                              </td>
                              <td className="px-4 py-3">
                                {r.serviceIndex ? `Servicio ${r.serviceIndex}` : "—"}
                              </td>
                              <td className="px-4 py-3">{r.cantidad || "—"}</td>
                              <td className="px-4 py-3">{r.largo || "—"}</td>
                              <td className="px-4 py-3">{r.ancho || "—"}</td>
                              <td className="px-4 py-3">{r.alto || "—"}</td>
                              <td className="px-4 py-3">{r.peso || "—"}</td>
                              <td className="px-4 py-3 font-semibold text-zinc-900">
                                {formatMoney(r.lineTotal, moneda)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white md:col-span-2">
                    <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Extras
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                      {servicio === "carga_general" ? (
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Lonas (manual)
                          </span>
                          <input
                            value={montoLonas}
                            onChange={(e) => setMontoLonas(e.target.value)}
                            className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                            inputMode="decimal"
                            placeholder="0.00"
                            disabled={!lonasAplica}
                          />
                          {!lonasAplica ? (
                            <div className="text-xs text-zinc-500">
                              No hay lonas seleccionadas en los servicios.
                            </div>
                          ) : null}
                        </label>
                      ) : null}

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Seguro de carga (manual)
                        </span>
                        <input
                          value={montoSeguroCarga}
                          onChange={(e) => setMontoSeguroCarga(e.target.value)}
                          className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10 disabled:opacity-60"
                          inputMode="decimal"
                          placeholder="0.00"
                          disabled={!seguroAplica}
                        />
                        {!seguroAplica ? (
                          <div className="text-xs text-zinc-500">
                            No hay seguro seleccionado en los servicios.
                          </div>
                        ) : null}
                      </label>

                      <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 md:col-span-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Tolvas total
                        </div>
                        <div className="mt-2 text-lg font-semibold text-zinc-900">
                          {formatMoney(montosExtras.tolvas || 0, moneda)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 md:col-span-2">
                        <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Extras total
                        </div>
                        <div className="mt-2 text-lg font-semibold text-zinc-900">
                          {formatMoney(montosExtras.total, moneda)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(6)}
                    disabled={false}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60"
                  >
                    Siguiente
                  </button>
                </div>

                {tarifasError ? (
                  <div className="mt-4 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    {tarifasError}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      Paso 6 · Hoja de cotización
                    </div>
                    <div className="mt-1 text-sm text-zinc-600">
                      {folio || "—"} ·{" "}
                      {tarifaOrigen && destino ? `${tarifaOrigen} → ${destino}` : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                    >
                      Regresar
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendPendingQuote()}
                      disabled={sending || sent}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60"
                    >
                      {sent ? "Enviado" : sending ? "Enviando..." : "Enviar"}
                    </button>
                        <button
                          type="button"
                          onClick={() => {
                            const payload = {
                              folio,
                              empresa,
                              cliente,
                              emitidaPor,
                              correoEmitente,
                              fechaEmision,
                              fechaCaducidad,
                              tarifaOrigen,
                              destino,
                              servicio,
                              divisa,
                              serviceBlocks,
                              mixtaBlocks,
                              cargas,
                              lonas: {
                                aplica: lonasAplica,
                                metros: lonaMetros,
                                largo: lonaLargo,
                                ancho: lonaAncho,
                                alto: lonaAlto,
                                monto: montoLonas,
                              },
                              seguro: {
                                aplica: seguroAplica,
                                monto: montoSeguroCarga,
                              },
                              montos: {
                                servicios: montosServicios,
                                cargas: montosCargas,
                                extras: montosExtras,
                                total: montosTotal,
                              },
                            };
                            const json = JSON.stringify(payload);
                            const b64 = btoa(unescape(encodeURIComponent(json)));
                            const url = `/platf/cotizaciones/ticket?d=${encodeURIComponent(b64)}&auto=1`;
                            window.open(url, "_blank");
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-5 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                        >
                          Descargar ticket PDF
                        </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Empresa
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {empresa || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Cliente
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {cliente || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Emite
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {emitidaPor || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Correo
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {correoEmitente || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Fecha emisión
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {fechaEmision || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                            Fecha caducidad
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-900">
                            {fechaCaducidad || "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                      <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Servicios
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0 text-sm">
                          <thead>
                            <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                              <th className="px-4 py-3">Servicio</th>
                              <th className="px-4 py-3">Nombre</th>
                              <th className="px-4 py-3">Tarifa</th>
                              <th className="px-4 py-3">Cantidad</th>
                              <th className="px-4 py-3">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[.08]">
                            {montosServicios.map((r, idx) => (
                              <tr
                                key={r.id}
                                className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                              >
                                <td className="px-4 py-3 font-medium text-zinc-900">
                                  {r.index}
                                </td>
                                <td className="px-4 py-3">{r.label}</td>
                                <td className="px-4 py-3">{r.tariffType || "—"}</td>
                                <td className="px-4 py-3">{r.cantidadTotal}</td>
                                <td className="px-4 py-3 font-semibold text-zinc-900">
                                  {formatMoney(r.subtotal, moneda)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                      <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Cargas
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-separate border-spacing-0 text-sm">
                          <thead>
                            <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                              <th className="px-4 py-3">Carga</th>
                              <th className="px-4 py-3">Servicio</th>
                              <th className="px-4 py-3">Cantidad</th>
                              <th className="px-4 py-3">L×A×H</th>
                              <th className="px-4 py-3">Peso</th>
                              <th className="px-4 py-3">Importe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[.08]">
                            {montosCargas.map((r, idx) => (
                              <tr
                                key={r.id}
                                className={idx % 2 === 0 ? "bg-white" : "bg-zinc-50"}
                              >
                                <td className="px-4 py-3 font-medium text-zinc-900">
                                  {r.index}
                                </td>
                                <td className="px-4 py-3">
                                  {r.serviceIndex ? `Servicio ${r.serviceIndex}` : "—"}
                                </td>
                                <td className="px-4 py-3">{r.cantidad || "—"}</td>
                                <td className="px-4 py-3">{`${r.largo || "—"}×${r.ancho || "—"}×${r.alto || "—"}`}</td>
                                <td className="px-4 py-3">{r.peso || "—"}</td>
                                <td className="px-4 py-3 font-semibold text-zinc-900">
                                  {formatMoney(r.lineTotal, moneda)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Ruta
                      </div>
                      <div className="mt-2 text-sm font-semibold text-zinc-900">
                        {tarifaOrigen && destino ? `${tarifaOrigen} → ${destino}` : "—"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Extras
                      </div>
                      <div className="mt-2 space-y-2 text-sm text-zinc-700">
                        {servicio === "carga_general" ? (
                          <div>
                            Lonas:{" "}
                            {lonasAplica
                              ? `${formatMoney(parseMoneyInput(montoLonas), moneda)} · Metros ${lonaMetros || "—"} · ${lonaLargo || "—"}×${lonaAncho || "—"}×${lonaAlto || "—"}`
                              : "—"}
                          </div>
                        ) : null}
                        <div>
                          Seguro de carga:{" "}
                          {seguroAplica
                            ? formatMoney(parseMoneyInput(montoSeguroCarga), moneda)
                            : "—"}
                        </div>
                        <div className="pt-2 text-sm font-semibold text-zinc-900">
                          Extras total: {formatMoney(montosExtras.total, moneda)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Total (sin impuestos)
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-zinc-900">
                        {formatMoney(montosTotal, moneda)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-600">{moneda} · Sin impuestos</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
