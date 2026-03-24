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
  formatted_address?: string;
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

function normalizeCp(value: string) {
  return value.replace(/[^\d]/g, "").slice(0, 5);
}

export default function CpPage() {
  const router = useRouter();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const googleMapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "";

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState("");
  const [puesto, setPuesto] = useState("");
  const [rol, setRol] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<GoogleMapsMap | null>(null);
  const directionsRendererRef = useRef<GoogleMapsDirectionsRenderer | null>(
    null,
  );
  const markersRef = useRef<GoogleMapsMarker[]>([]);

  const [origenCp, setOrigenCp] = useState("");
  const [destinoCp, setDestinoCp] = useState("");
  const [mapStatus, setMapStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [mapMessage, setMapMessage] = useState("");
  const [routeDistance, setRouteDistance] = useState("");
  const [routeDuration, setRouteDuration] = useState("");
  const [resolvedOrigin, setResolvedOrigin] = useState("");
  const [resolvedDestination, setResolvedDestination] = useState("");

  const isBusy = mapStatus === "loading";
  const canSearch = useMemo(() => {
    return origenCp.length === 5 && destinoCp.length === 5 && !isBusy;
  }, [destinoCp.length, isBusy, origenCp.length]);

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
      setRol(profileRow?.puesto?.rol?.nombre ?? "");
      setNombreCompleto(fullName);
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

  async function runSearch() {
    const originValue = normalizeCp(origenCp);
    const destinationValue = normalizeCp(destinoCp);
    setOrigenCp(originValue);
    setDestinoCp(destinationValue);

    if (originValue.length !== 5 || destinationValue.length !== 5) {
      setMapStatus("error");
      setMapMessage("Ingresa CP origen y destino (5 dígitos).");
      return;
    }

    const el = mapRef.current;
    if (!el) return;

    if (!googleMapsApiKey) {
      setMapStatus("error");
      setMapMessage(
        "Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en tu .env.local para ver el mapa.",
      );
      return;
    }

    function geocode(geocoder: GoogleMapsGeocoder, address: string) {
      return new Promise<GoogleMapsGeocodeResult>((resolve, reject) => {
        geocoder.geocode({ address }, (results, status) => {
          const first =
            (results?.[0] as GoogleMapsGeocodeResult | undefined) ?? null;
          if (status === "OK" && first) resolve(first);
          else reject(new Error(status || "ERROR"));
        });
      });
    }

    try {
      setMapStatus("loading");
      setMapMessage("");
      setRouteDistance("");
      setRouteDuration("");
      setResolvedOrigin("");
      setResolvedDestination("");

      await loadGoogleMapsScript(googleMapsApiKey);
      const g = window.google;
      if (!g?.maps) throw new Error("Google Maps no disponible.");

      const map =
        mapInstanceRef.current ??
        new g.maps.Map(el, {
          center: { lat: 23.6345, lng: -102.5528 },
          zoom: 5,
          mapId: googleMapId || undefined,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
        });

      mapInstanceRef.current = map;
      map.setOptions({ mapId: googleMapId || undefined });

      for (const m of markersRef.current) {
        try {
          m.setMap(null);
        } catch {}
      }
      markersRef.current = [];

      if (directionsRendererRef.current) {
        try {
          directionsRendererRef.current.setMap(null);
        } catch {}
      }

      const geocoder = new g.maps.Geocoder();
      const [origin, destination] = await Promise.all([
        geocode(geocoder, `${originValue}, México`),
        geocode(geocoder, `${destinationValue}, México`),
      ]);

      const originLoc = origin.geometry.location;
      const destinationLoc = destination.geometry.location;

      const bounds = new g.maps.LatLngBounds();
      bounds.extend(originLoc);
      bounds.extend(destinationLoc);
      map.fitBounds(bounds, 64);

      const directionsRenderer = new g.maps.DirectionsRenderer({
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: "#111827",
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
      directionsRendererRef.current = directionsRenderer;
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
      setResolvedOrigin(origin.formatted_address ?? `CP ${originValue}`);
      setResolvedDestination(destination.formatted_address ?? `CP ${destinationValue}`);

      markersRef.current = [
        new g.maps.Marker({
          position: originLoc,
          map,
          title: `Origen CP ${originValue}`,
          label: { text: "O", color: "white" },
        }),
        new g.maps.Marker({
          position: destinationLoc,
          map,
          title: `Destino CP ${destinationValue}`,
          label: { text: "D", color: "white" },
        }),
      ];

      setMapStatus("ready");
      setMapMessage("");

      setTimeout(() => {
        try {
          g.maps.event.trigger(map, "resize");
          map.fitBounds(bounds, 64);
        } catch {}
      }, 0);
    } catch {
      setMapStatus("error");
      setMapMessage(
        "No se pudo cargar la ruta. Revisa que tu API Key tenga habilitado Maps JavaScript API (y Geocoding/Directions si aplica).",
      );
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
          <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">
                  CP (Códigos postales)
                </h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Consulta ruta por CP (origen y destino).
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-black/[.08] bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                {googleMapId ? `Map ID: ${googleMapId}` : "Sin Map ID"}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
              <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Consulta
                </div>
                <div className="mt-3 space-y-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      CP Origen
                    </span>
                    <input
                      value={origenCp}
                      onChange={(e) => setOrigenCp(normalizeCp(e.target.value))}
                      inputMode="numeric"
                      placeholder="Ej. 28000"
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      disabled={isBusy}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      CP Destino
                    </span>
                    <input
                      value={destinoCp}
                      onChange={(e) => setDestinoCp(normalizeCp(e.target.value))}
                      inputMode="numeric"
                      placeholder="Ej. 64000"
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      disabled={isBusy}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void runSearch()}
                    disabled={!canSearch}
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-60"
                  >
                    Buscar ruta
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-black/[.08] bg-zinc-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Resultado
                  </div>
                  <div className="mt-2 space-y-2 text-sm text-zinc-700">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Origen
                      </div>
                      <div className="font-medium text-zinc-900">
                        {resolvedOrigin || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Destino
                      </div>
                      <div className="font-medium text-zinc-900">
                        {resolvedDestination || "—"}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Distancia
                        </div>
                        <div className="font-semibold text-zinc-900">
                          {routeDistance || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Duración
                        </div>
                        <div className="font-semibold text-zinc-900">
                          {routeDuration || "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {mapMessage ? (
                    <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                      {mapMessage}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Mapa
                </div>
                <div className="relative">
                  <div ref={mapRef} className="h-[520px] w-full" />
                  {mapStatus === "idle" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 p-6 text-center text-sm text-zinc-600">
                      Ingresa CP origen y destino para ver la ruta.
                    </div>
                  ) : mapStatus === "loading" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 p-6 text-center text-sm text-zinc-600">
                      Calculando ruta…
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
