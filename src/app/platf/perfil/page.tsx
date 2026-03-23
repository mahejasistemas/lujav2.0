"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "@/platf/Sidebar";
import { Topbar } from "@/platf/Topbar";
import { useNotifications } from "@/platf/notifications";

type BaseRow = { id: number; nombre: string };
type PuestoRow = { id: number; nombre: string };

type ProfileRow = {
  user_id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  base_id: number | null;
  puesto_id: number | null;
  avatar_url?: string | null;
  base?: { nombre: string } | null;
  puesto?: { nombre: string; rol?: { nombre: string } | null } | null;
};

export default function PerfilPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { add } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [bases, setBases] = useState<BaseRow[]>([]);
  const [puestos, setPuestos] = useState<PuestoRow[]>([]);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [baseId, setBaseId] = useState<string>("");
  const [puestoId, setPuestoId] = useState<string>("");
  const [initialBaseId, setInitialBaseId] = useState<string>("");
  const [initialPuestoId, setInitialPuestoId] = useState<string>("");
  const [rol, setRol] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [avatarVersion, setAvatarVersion] = useState<number>(0);

  const canSave = useMemo(() => {
    return Boolean(nombre.trim() && apellido.trim() && telefono.trim());
  }, [apellido, nombre, telefono]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const metadata = user.user_metadata as Partial<{
        nombre: string;
        apellido: string;
        telefono: string;
        base_id: number;
        puesto_id: number;
        avatar_url: string;
      }>;

      setEmail(user.email ?? "");

      const [{ data: basesData }, { data: puestosData }] = await Promise.all([
        supabase.from("bases").select("id,nombre").order("nombre"),
        supabase.from("puestos").select("id,nombre").order("nombre"),
      ]);

      if (cancelled) return;

      setBases((basesData as BaseRow[] | null) ?? []);
      setPuestos((puestosData as PuestoRow[] | null) ?? []);

      const { data: profileWithAvatar, error: avatarErr } = await supabase
        .from("profiles")
        .select(
          "user_id,nombre,apellido,telefono,base_id,puesto_id,avatar_url,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      let profile: ProfileRow | null = profileWithAvatar as ProfileRow | null;

      if (avatarErr) {
        const { data: profileNoAvatar } = await supabase
          .from("profiles")
          .select(
            "user_id,nombre,apellido,telefono,base_id,puesto_id,base:bases(nombre),puesto:puestos(nombre,rol:roles(nombre))",
          )
          .eq("user_id", user.id)
          .maybeSingle();
        profile = profileNoAvatar as ProfileRow | null;
      }

      if (cancelled) return;

      setNombre(profile?.nombre ?? metadata.nombre ?? "");
      setApellido(profile?.apellido ?? metadata.apellido ?? "");
      setTelefono(profile?.telefono ?? metadata.telefono ?? "");
      setBaseId(
        String(profile?.base_id ?? metadata.base_id ?? "") || "",
      );
      setPuestoId(
        String(profile?.puesto_id ?? metadata.puesto_id ?? "") || "",
      );
      setInitialBaseId(String(profile?.base_id ?? metadata.base_id ?? "") || "");
      setInitialPuestoId(String(profile?.puesto_id ?? metadata.puesto_id ?? "") || "");
      setRol(profile?.puesto?.rol?.nombre ?? "");
      setAvatarUrl(profile?.avatar_url ?? metadata.avatar_url ?? "");
      setAvatarVersion(Date.now());
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const nombreCompleto = `${nombre} ${apellido}`.trim();
  const initials = nombreCompleto
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const avatarDisplayUrl = avatarUrl
    ? `${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}v=${avatarVersion}`
    : "";

  async function saveProfile() {
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!canSave) {
      setSaving(false);
      add({
        title: "Faltan datos",
        description: "Completa nombre, apellido y teléfono.",
        variant: "error",
      });
      return;
    }

    const personalPayload = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono.trim(),
    };

    const requested_base_id = baseId ? Number(baseId) : null;
    const requested_puesto_id = puestoId ? Number(puestoId) : null;

    const orgChanged = baseId !== initialBaseId || puestoId !== initialPuestoId;
    const isAdmin = (rol || "").toLowerCase() === "administrador";

    const { error } = await supabase
      .from("profiles")
      .update(
        isAdmin
          ? {
              ...personalPayload,
              base_id: requested_base_id,
              puesto_id: requested_puesto_id,
            }
          : personalPayload,
      )
      .eq("user_id", user.id);

    await supabase.auth.updateUser({
      data: {
        ...personalPayload,
        avatar_url: avatarUrl || undefined,
      },
    });

    if (error) {
      setSaving(false);
      add({
        title: "No se pudo guardar",
        description: "Revisa columnas y RLS en profiles.",
        variant: "error",
      });
      return;
    }

    if (orgChanged && !isAdmin) {
      const { error: requestError } = await supabase.rpc("request_org_change", {
        requested_base_id,
        requested_puesto_id,
      });

      setSaving(false);

      if (requestError) {
        add({
          title: "No se pudo enviar la solicitud",
          description: "Revisa la función request_org_change.",
          variant: "error",
        });
        return;
      }

      setBaseId(initialBaseId);
      setPuestoId(initialPuestoId);
      add({
        title: "Solicitud enviada",
        description: "Tu solicitud de cambio se mando a los administradores.",
        variant: "info",
      });
      return;
    }

    setSaving(false);
    add({
      title: "Perfil actualizado",
      variant: "success",
    });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      router.replace("/login");
      return;
    }

    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setUploading(false);
      add({
        title: "No se pudo subir la foto",
        description: uploadError.message,
        variant: "error",
      });
      return;
    }

    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const newUrl = publicData.publicUrl;
    setAvatarUrl(newUrl);
    setAvatarVersion(Date.now());

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: newUrl })
      .eq("user_id", user.id);

    await supabase.auth.updateUser({ data: { avatar_url: newUrl } });

    setUploading(false);

    if (updateError) {
      add({
        title: "Foto subida",
        description: "No se pudo guardar en el perfil (avatar_url/RLS).",
        variant: "error",
      });
      return;
    }

    add({
      title: "Foto actualizada",
      variant: "success",
    });
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
          base={bases.find((b) => String(b.id) === baseId)?.nombre ?? ""}
          puesto={puestos.find((p) => String(p.id) === puestoId)?.nombre ?? ""}
          rol={rol}
          nombreCompleto={nombreCompleto}
          avatarUrl={avatarDisplayUrl}
        />

        <div className="flex-1 bg-zinc-50 p-6">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-zinc-900">Perfil</h1>
                <p className="mt-1 text-sm text-zinc-600">
                  Edita tus datos y tu foto de perfil.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={!canSave || saving}
                className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
              <div className="rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="text-sm font-semibold text-zinc-900">
                  Información personal
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Nombre
                    </span>
                    <input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Apellido
                    </span>
                    <input
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                    />
                  </label>

                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Teléfono
                    </span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="Ej. 5551234567"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      required
                    />
                  </label>
                </div>

                <div className="mt-6 border-t border-black/[.08] pt-6">
                  <div className="text-sm font-semibold text-zinc-900">
                    Cuenta
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Correo / Email
                      </span>
                      <input
                        value={email}
                        readOnly
                        className="h-11 rounded-xl border border-black/[.12] bg-zinc-50 px-3 text-sm text-zinc-700 outline-none"
                      />
                    </label>
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Rol
                      </div>
                      <div className="flex h-11 items-center">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                          {rol || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 border-t border-black/[.08] pt-6">
                  <div className="text-sm font-semibold text-zinc-900">
                    Organización
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Base
                      </span>
                      <select
                        value={baseId}
                        onChange={(e) => setBaseId(e.target.value)}
                        className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      >
                        <option value="">Selecciona una base</option>
                        {bases.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.nombre}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        Puesto
                      </span>
                      <select
                        value={puestoId}
                        onChange={(e) => setPuestoId(e.target.value)}
                        className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      >
                        <option value="">Selecciona un puesto</option>
                        {puestos.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-black/[.08] bg-white p-6">
                <div className="text-sm font-semibold text-zinc-900">
                  Foto de perfil
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border border-black/[.08] bg-white">
                    {avatarUrl ? (
                      <div className="relative h-full w-full">
                        <div className="absolute inset-1">
                        <Image
                          src={avatarDisplayUrl}
                          alt="Foto de perfil"
                          fill
                          sizes="64px"
                          className="object-contain"
                        />
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-emerald-600 text-sm font-semibold text-white">
                        {initials || "ME"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900">
                      {nombreCompleto || "—"}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      PNG, JPG o WEBP.
                    </div>
                  </div>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
                  disabled={uploading}
                >
                  {uploading ? "Subiendo..." : "Cambiar foto"}
                </button>

                <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
                  La foto se guarda en el bucket <span className="font-semibold">avatars</span> de Supabase.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
