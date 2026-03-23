export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

type PendingQuoteInsert = {
  folio: string;
  origen: string;
  destino: string;
  moneda: string;
  total: number;
  enviado_por: string;
  enviado_por_user_id: string;
  status: "pendiente";
  payload: unknown;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.SUPABASE_ADMIN_KEY ??
    "";

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeBearerToken(authorizationHeader: string) {
  const raw = authorizationHeader.trim();
  if (!raw) return "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] ?? raw).trim();
}

function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function getSupabaseAuthed(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!url || !key) return null;
  if (!token) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const adminClient = getSupabaseAdmin();
  const token = normalizeBearerToken(authHeader);
  const anonClient = adminClient ? null : getSupabaseAnon();
  const client = adminClient ?? anonClient;
  if (!client) {
    return Response.json(
      {
        ok: false,
        error:
          "Falta configurar SUPABASE_SERVICE_ROLE_KEY (recomendado) o enviar un token de usuario para insertar con RLS.",
      },
      { status: 500 },
    );
  }

  try {
    const body = (await req.json()) as Partial<PendingQuoteInsert> | null;
    const folio = String(body?.folio ?? "").trim();
    const origen = String(body?.origen ?? "").trim();
    const destino = String(body?.destino ?? "").trim();
    const moneda = String(body?.moneda ?? "").trim();
    const total = body?.total;
    const enviadoPor = String(body?.enviado_por ?? "").trim();
    let enviadoPorUserId = String(body?.enviado_por_user_id ?? "").trim();
    const payload = body?.payload ?? null;

    if (!folio || !origen || !destino || !moneda) {
      return Response.json(
        { ok: false, error: "Faltan campos requeridos." },
        { status: 400 },
      );
    }

    if (!isFiniteNumber(total)) {
      return Response.json(
        { ok: false, error: "Total inválido." },
        { status: 400 },
      );
    }

    if (anonClient) {
      if (!token) {
        return Response.json(
          { ok: false, error: "No autorizado (falta token)." },
          { status: 401 },
        );
      }

      const { data, error } = await anonClient.auth.getUser(token);
      if (error || !data.user) {
        return Response.json(
          { ok: false, error: "No autorizado (token inválido)." },
          { status: 401 },
        );
      }

      enviadoPorUserId = data.user.id;
    }

    if (!enviadoPor || !enviadoPorUserId) {
      return Response.json(
        { ok: false, error: "Información de usuario inválida." },
        { status: 400 },
      );
    }

    const row: PendingQuoteInsert = {
      folio,
      origen,
      destino,
      moneda,
      total,
      enviado_por: enviadoPor,
      enviado_por_user_id: enviadoPorUserId,
      status: "pendiente",
      payload,
    };

    const insertClient =
      adminClient ??
      (anonClient && token ? getSupabaseAuthed(token) : null);

    if (!insertClient) {
      return Response.json(
        {
          ok: false,
          error:
            "No se pudo crear cliente autenticado para insertar (revisa token o usa SUPABASE_SERVICE_ROLE_KEY).",
        },
        { status: 500 },
      );
    }

    const { data, error } = await insertClient
      .from("cotizaciones_pendientes")
      .insert(row)
      .select("id")
      .maybeSingle();

    if (error) {
      return Response.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    return Response.json({ ok: true, id: (data as { id?: unknown } | null)?.id ?? null });
  } catch (e) {
    return Response.json(
      { ok: false, error: "Error inesperado", details: String(e) },
      { status: 500 },
    );
  }
}
