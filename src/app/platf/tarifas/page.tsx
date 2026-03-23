"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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

type TarifaCardKey = "rabon" | "sencillo" | "full" | "sencillo_sp" | "full_sp";
type TarifaBaseKey = "manzanillo" | "altamira" | "veracruz";

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
  const listboxId = "tarifa-base-listbox";

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
  const listboxId = "destino-listbox";

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

export default function TarifasPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<string>("");
  const [puesto, setPuesto] = useState<string>("");
  const [rol, setRol] = useState<string>("");
  const [nombreCompleto, setNombreCompleto] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const [tarifasLoading, setTarifasLoading] = useState(false);
  const [tarifasError, setTarifasError] = useState("");
  const [destinos, setDestinos] = useState<string[]>([]);
  const [tarifaBase, setTarifaBase] = useState<TarifaBaseKey | "">("");
  const [destino, setDestino] = useState("");
  const [tarifa, setTarifa] = useState<TarifaRow | null>(null);
  const [tarifaOrigen, setTarifaOrigen] = useState<string>("");
  const [selected, setSelected] = useState<TarifaCardKey>("rabon");

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

      const baseName = profileRow?.base?.nombre ?? "";
      setBase(baseName);
      setPuesto(profileRow?.puesto?.nombre ?? "");
      setRol(profileRow?.puesto?.rol?.nombre ?? "");
      setNombreCompleto(fullName);
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

  const tarifasTable = useMemo(() => {
    if (!tarifaBase) return "";
    return tarifaBases.find((b) => b.key === tarifaBase)?.table ?? "";
  }, [tarifaBase]);

  const tarifaBaseLabel = useMemo(() => {
    if (!tarifaBase) return "";
    return tarifaBases.find((b) => b.key === tarifaBase)?.label ?? "";
  }, [tarifaBase]);

  useEffect(() => {
    let cancelled = false;

    async function loadDestinosForBase() {
      setTarifasError("");
      setTarifa(null);
      setDestino("");
      setDestinos([]);
      setTarifaOrigen("");

      if (!tarifasTable) {
        if (tarifaBase || base) {
          setTarifasError(
            `Selecciona una base de tarifario. Bases soportadas: Manzanillo, Altamira, Veracruz.`,
          );
        }
        return;
      }

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

      if (preferRows.length > 0) {
        const destinoSet = new Set<string>();
        for (const r of preferRows) {
          if (r.destino) destinoSet.add(r.destino);
        }
        setDestinos(Array.from(destinoSet).sort((a, b) => a.localeCompare(b)));
        setTarifasLoading(false);
        return;
      }

      const { data: allDestinos, error: allError } = await supabase
        .from(tarifasTable)
        .select("destino")
        .limit(8000);

      if (cancelled) return;

      if (allError) {
        setTarifasLoading(false);
        setTarifasError(allError.message);
        return;
      }

      const rows = (allDestinos as { destino: string }[] | null) ?? [];
      const destinoSet = new Set<string>();
      for (const r of rows) {
        if (r.destino) destinoSet.add(r.destino);
      }
      setDestinos(Array.from(destinoSet).sort((a, b) => a.localeCompare(b)));
      setTarifasLoading(false);
    }

    void loadDestinosForBase();

    return () => {
      cancelled = true;
    };
  }, [base, tarifaBase, tarifaBaseLabel, tarifasTable]);

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
  }, [destino, tarifaBaseLabel, tarifasTable]);

  const moneda = tarifa?.moneda ?? "MXN";

  const cards = useMemo(() => {
    return [
      {
        key: "rabon" as const,
        title: "Rabón",
        subtitle: "Precio",
        value: tarifa ? formatMoney(tarifa.precio_rabon ?? 0, moneda) : "—",
      },
      {
        key: "sencillo" as const,
        title: "Sencillo",
        subtitle: "Precio",
        value: tarifa ? formatMoney(tarifa.precio_sencillo ?? 0, moneda) : "—",
      },
      {
        key: "full" as const,
        title: "Full",
        subtitle: "Precio",
        value: tarifa ? formatMoney(tarifa.precio_full ?? 0, moneda) : "—",
      },
      {
        key: "sencillo_sp" as const,
        title: "Sencillo SP",
        subtitle: "Precio",
        value: tarifa ? formatMoney(tarifa.precio_sencillo_sp ?? 0, moneda) : "—",
      },
      {
        key: "full_sp" as const,
        title: "Full SP",
        subtitle: "Precio",
        value: tarifa ? formatMoney(tarifa.precio_full_sp ?? 0, moneda) : "—",
      },
    ];
  }, [moneda, tarifa]);

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
                  Tarifas
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Selecciona base y destino para ver precios.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-6">
              <div className="flex flex-col gap-1 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  Base de usuario:{" "}
                  <span className="font-semibold text-zinc-800">
                    {base || "—"}
                  </span>
                </div>
                <div>
                  Tarifario:{" "}
                  <span className="font-semibold text-zinc-800">
                    {tarifaBaseLabel || "—"}
                  </span>{" "}
                  · Tabla:{" "}
                  <span className="font-semibold text-zinc-800">
                    {tarifasTable || "—"}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
              </div>

              {tarifasError ? (
                <div className="mt-4 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  {tarifasError}
                </div>
              ) : null}
              {!tarifasLoading && tarifasTable && destinos.length === 0 && !tarifasError ? (
                <div className="mt-4 rounded-xl border border-black/[.08] bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  No se encontraron registros en {tarifasTable}. Importa tarifas o revisa permisos.
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {cards.map((c) => {
                const active = selected === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setSelected(c.key)}
                    className={
                      active
                        ? "rounded-2xl border border-black/[.12] bg-white p-5 text-left ring-2 ring-black/10"
                        : "rounded-2xl border border-black/[.08] bg-white p-5 text-left hover:border-black/[.14]"
                    }
                    disabled={!tarifa || tarifasLoading}
                    aria-pressed={active}
                  >
                    <div className="text-sm font-semibold text-zinc-900">
                      {c.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {c.subtitle}
                    </div>
                    <div className="mt-3 text-lg font-semibold text-zinc-900">
                      {c.value}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-zinc-900">
                  Tarifas seleccionadas
                </div>
                <div className="text-sm text-zinc-600">
                  {tarifaOrigen && destino ? `${tarifaOrigen} → ${destino}` : "—"}
                </div>
              </div>

              {!tarifa ? (
                <div className="mt-4 text-sm text-zinc-600">
                  Selecciona una base y un destino para ver los precios.
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-zinc-50 px-4 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Tipo
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                      {selected === "rabon"
                        ? "Rabón"
                        : selected === "sencillo"
                          ? "Sencillo"
                          : selected === "full"
                            ? "Full"
                            : selected === "sencillo_sp"
                              ? "Sencillo SP"
                              : "Full SP"}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 px-4 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Precio (MXN)
                    </div>
                    <div className="mt-1 text-sm font-semibold text-zinc-900">
                      {selected === "rabon"
                        ? formatMoney(tarifa.precio_rabon ?? 0, moneda)
                        : selected === "sencillo"
                          ? formatMoney(tarifa.precio_sencillo ?? 0, moneda)
                          : selected === "full"
                            ? formatMoney(tarifa.precio_full ?? 0, moneda)
                            : selected === "sencillo_sp"
                              ? formatMoney(tarifa.precio_sencillo_sp ?? 0, moneda)
                              : formatMoney(tarifa.precio_full_sp ?? 0, moneda)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
