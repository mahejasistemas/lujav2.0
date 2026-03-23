"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";
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

type Priority = "baja" | "media" | "alta";

export default function SoportePage() {
  const router = useRouter();
  const notifications = useNotifications();

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState<string>("");
  const [puesto, setPuesto] = useState<string>("");
  const [rol, setRol] = useState<string>("");
  const [nombreCompleto, setNombreCompleto] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");

  const [asunto, setAsunto] = useState("");
  const [prioridad, setPrioridad] = useState<Priority>("media");
  const [mensaje, setMensaje] = useState("");
  const [sending, setSending] = useState(false);

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

  const mailtoHref = useMemo(() => {
    const subject = `[Soporte] ${asunto || "Solicitud"} (${prioridad.toUpperCase()})`;
    const bodyLines = [
      `Usuario: ${nombreCompleto || "—"}`,
      `Base: ${base || "—"}`,
      `Puesto: ${puesto || "—"}`,
      "",
      "Detalle:",
      mensaje,
    ];
    const body = bodyLines.join("\n");
    return `mailto:metawebdevsolutions@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [asunto, base, mensaje, nombreCompleto, prioridad, puesto]);

  async function submit() {
    if (!asunto.trim() || !mensaje.trim()) {
      notifications.add({
        title: "Completa el formulario",
        description: "Asunto y mensaje son obligatorios.",
        variant: "error",
      });
      return;
    }

    setSending(true);
    try {
      window.location.href = mailtoHref;
      notifications.add({
        title: "Soporte",
        description: "Se abrió tu correo para enviar la solicitud.",
        variant: "success",
      });
      setAsunto("");
      setPrioridad("media");
      setMensaje("");
    } catch {
      notifications.add({
        title: "Soporte",
        description: "No se pudo abrir el correo. Intenta de nuevo.",
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
                <h1 className="text-2xl font-semibold text-zinc-900">Soporte</h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Envía una solicitud a Sistemas / Soporte.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-black/[.08] bg-white p-6">
                  <div className="text-sm font-semibold text-zinc-900">
                    Crear solicitud
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Asunto
                      </span>
                      <input
                        value={asunto}
                        onChange={(e) => setAsunto(e.target.value)}
                        className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        placeholder="Ej. Error al cargar tarifas"
                        disabled={sending}
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Prioridad
                      </span>
                      <select
                        value={prioridad}
                        onChange={(e) => setPrioridad(e.target.value as Priority)}
                        className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        disabled={sending}
                      >
                        <option value="baja">Baja</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </label>

                    <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4 sm:col-span-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Se enviará con
                      </div>
                      <div className="mt-2 text-sm text-zinc-700">
                        {nombreCompleto || "—"} · {base || "—"} · {puesto || "—"}
                      </div>
                    </div>

                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Mensaje
                      </span>
                      <textarea
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        className="min-h-40 resize-y rounded-xl border border-black/[.12] bg-white px-3 py-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        placeholder="Describe el problema y pasos para reproducirlo."
                        disabled={sending}
                      />
                    </label>

                    <div className="flex sm:col-span-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={sending}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
                      >
                        Enviar correo
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-black/[.08] bg-white p-6">
                  <div className="text-sm font-semibold text-zinc-900">
                    Ayuda rápida
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-zinc-700">
                    <div className="rounded-xl border border-black/[.08] bg-zinc-50 p-4">
                      <div className="font-medium text-zinc-900">
                        No veo datos de tarifas
                      </div>
                      <div className="mt-1 text-zinc-600">
                        Revisa que existan registros en la tabla y que haya permisos de lectura (RLS).
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/[.08] bg-zinc-50 p-4">
                      <div className="font-medium text-zinc-900">
                        No puedo subir mi avatar
                      </div>
                      <div className="mt-1 text-zinc-600">
                        Verifica el bucket <span className="font-medium">avatars</span> y sus políticas.
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/[.08] bg-zinc-50 p-4">
                      <div className="font-medium text-zinc-900">
                        Error de acceso
                      </div>
                      <div className="mt-1 text-zinc-600">
                        Cierra sesión y vuelve a iniciar. Si persiste, envía captura y tu correo.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
