export const runtime = "nodejs";

type LatLng = { lat: number; lng: number };
type Money = { currencyCode?: unknown; units?: unknown; nanos?: unknown };
type TollInfo = { estimatedPrice?: unknown };
type TravelAdvisory = { tollInfo?: unknown };
type Route = { travelAdvisory?: unknown };
type ComputeRoutesResponse = { routes?: unknown };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function safeLatLng(input: unknown): LatLng | null {
  const obj = input as Partial<LatLng> | null;
  if (!obj) return null;
  if (!isFiniteNumber(obj.lat) || !isFiniteNumber(obj.lng)) return null;
  return { lat: obj.lat, lng: obj.lng };
}

function moneyToNumber(m: unknown) {
  const obj = (m as Money | null) ?? null;
  const units = typeof obj?.units === "string" ? Number(obj.units) : obj?.units;
  const nanos = typeof obj?.nanos === "string" ? Number(obj.nanos) : obj?.nanos;
  const u = typeof units === "number" && Number.isFinite(units) ? units : 0;
  const n = typeof nanos === "number" && Number.isFinite(nanos) ? nanos : 0;
  return u + n / 1_000_000_000;
}

function asComputeRoutesResponse(input: unknown): ComputeRoutesResponse | null {
  const obj = input as Record<string, unknown> | null;
  if (!obj) return null;
  return obj as ComputeRoutesResponse;
}

function firstRoute(input: unknown): Route | null {
  const res = asComputeRoutesResponse(input);
  const routes = res?.routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  return (routes[0] as Route | null) ?? null;
}

function getTollInfo(input: unknown): TollInfo | null {
  const route = firstRoute(input);
  const advisory = (route?.travelAdvisory as TravelAdvisory | null) ?? null;
  const tollInfo = advisory?.tollInfo;
  if (!tollInfo || typeof tollInfo !== "object") return null;
  return tollInfo as TollInfo;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      origin?: unknown;
      destination?: unknown;
    };

    const origin = safeLatLng(body.origin);
    const destination = safeLatLng(body.destination);

    if (!origin || !destination) {
      return Response.json(
        { ok: false, error: "origin/destination inválidos" },
        { status: 400 },
      );
    }

    const apiKey =
      process.env.GOOGLE_ROUTES_API_KEY ??
      process.env.GOOGLE_MAPS_SERVER_API_KEY ??
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
      "";

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "API key no configurada" },
        { status: 500 },
      );
    }

    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
        "x-goog-fieldmask": "routes.travelAdvisory.tollInfo",
      },
      body: JSON.stringify({
        origin: {
          location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
        },
        destination: {
          location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        routeModifiers: { avoidTolls: false },
        languageCode: "es-MX",
        units: "METRIC",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { ok: false, error: "Error de Google Routes API", details: text },
        { status: 502 },
      );
    }

    const data = (await res.json()) as unknown;
    const tollInfo = getTollInfo(data);
    const estimatedPriceRaw = tollInfo?.estimatedPrice;
    const estimatedPrice = Array.isArray(estimatedPriceRaw) ? estimatedPriceRaw : [];

    const totalsByCurrency = new Map<string, number>();
    for (const p of estimatedPrice) {
      const currencyCode = (p as Money | null)?.currencyCode;
      if (typeof currencyCode !== "string" || !currencyCode) continue;
      const amount = moneyToNumber(p);
      totalsByCurrency.set(currencyCode, (totalsByCurrency.get(currencyCode) ?? 0) + amount);
    }

    const totals = Array.from(totalsByCurrency.entries()).map(([currencyCode, amount]) => {
      const formatted = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(amount);
      return { currencyCode, amount, formatted };
    });

    return Response.json({
      ok: true,
      tollInfo: {
        hasTolls: Boolean(tollInfo),
        estimatedPrice: totals,
      },
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: "Error inesperado", details: String(e) },
      { status: 500 },
    );
  }
}
