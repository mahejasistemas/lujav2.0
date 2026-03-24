"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  id: string;
  created_at: string;
  owner_user_id: string;
  avatar_url: string | null;
  nombre_completo: string | null;
  empresa: string | null;
  telefono: string | null;
  correo: string | null;
  pais: string | null;
  region: string | null;
};

export default function ClientesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [base, setBase] = useState("");
  const [puesto, setPuesto] = useState("");
  const [rol, setRol] = useState("");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [viewerUserId, setViewerUserId] = useState("");

  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [search, setSearch] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadAvatarError, setUploadAvatarError] = useState("");
  const [formAvatarVersion, setFormAvatarVersion] = useState(0);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);

  const [formAvatarUrl, setFormAvatarUrl] = useState("");
  const [formNombreCompleto, setFormNombreCompleto] = useState("");
  const [formEmpresa, setFormEmpresa] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formCorreo, setFormCorreo] = useState("");
  const [formPais, setFormPais] = useState("");
  const [formRegion, setFormRegion] = useState("");

  const reload = useCallback(async () => {
    if (!viewerUserId) return;
    setRowsError("");
    setRowsLoading(true);

    const query = supabase
      .from("clientes")
      .select(
        "id,created_at,owner_user_id,avatar_url,nombre_completo,empresa,telefono,correo,pais,region",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    const { data, error } = await query;
    if (error) {
      setClientes([]);
      const err = error as { code?: string; message?: string };
      const msg = String(err.message ?? "");
      if (err.code === "42P01" || /relation\s+\"clientes\"\s+does not exist/i.test(msg)) {
        setRowsError(
          'Falta la tabla "clientes" en la base de datos. Crea la tabla y sus policies (RLS) en Supabase y vuelve a intentar.',
        );
      } else {
        setRowsError(
          error.message ||
            "No se pudieron cargar clientes (revisa permisos/RLS de la tabla clientes).",
        );
      }
      setRowsLoading(false);
      return;
    }

    setClientes((data as ClienteRow[] | null) ?? []);
    setRowsLoading(false);
  }, [viewerUserId]);

  async function onPickAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!viewerUserId) return;

    setUploadAvatarError("");
    setUploadingAvatar(true);

    const ext = file.name.split(".").pop() || "png";
    const fileId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now());
    const path = `${viewerUserId}/clientes/${fileId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      setUploadingAvatar(false);
      setUploadAvatarError(uploadError.message);
      return;
    }

    const { data: publicData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    setFormAvatarUrl(publicData.publicUrl);
    setFormAvatarVersion(Date.now());
    setUploadingAvatar(false);
  }

  const createCliente = useCallback(async () => {
    setSaveMessage("");
    setSaveError("");

    const nombreCompletoValue = formNombreCompleto.trim();
    if (!nombreCompletoValue) {
      setSaveError("El nombre completo es obligatorio.");
      return;
    }

    const correoValue = formCorreo.trim();
    if (correoValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoValue)) {
      setSaveError("El correo no tiene un formato válido.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        owner_user_id: viewerUserId,
        avatar_url: formAvatarUrl.trim() || null,
        nombre_completo: nombreCompletoValue,
        empresa: formEmpresa.trim() || null,
        telefono: formTelefono.trim() || null,
        correo: correoValue || null,
        pais: formPais.trim() || null,
        region: formRegion.trim() || null,
      })
      .select(
        "id,created_at,owner_user_id,avatar_url,nombre_completo,empresa,telefono,correo,pais,region",
      )
      .maybeSingle();

    if (error) {
      setSaving(false);
      const err = error as { code?: string; message?: string };
      const msg = String(err.message ?? "");
      if (err.code === "42P01" || /relation\s+\"clientes\"\s+does not exist/i.test(msg)) {
        setSaveError(
          'Falta la tabla "clientes" en la base de datos. Crea la tabla y sus policies (RLS) en Supabase y vuelve a intentar.',
        );
      } else {
        setSaveError(
          error.message ||
            "No se pudo guardar el cliente (revisa permisos/RLS de la tabla clientes).",
        );
      }
      return;
    }

    setSaving(false);
    setSaveMessage("Cliente guardado.");
    setFormAvatarUrl("");
    setFormNombreCompleto("");
    setFormEmpresa("");
    setFormTelefono("");
    setFormCorreo("");
    setFormPais("");
    setFormRegion("");
    setIsFormOpen(false);
    if (data) {
      setClientes((prev) => [data as ClienteRow, ...prev]);
    } else {
      await reload();
    }
  }, [
    formAvatarUrl,
    formCorreo,
    formEmpresa,
    formNombreCompleto,
    formPais,
    formRegion,
    formTelefono,
    reload,
    viewerUserId,
  ]);

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
    async function run() {
      if (!loading && viewerUserId) await reload();
    }

    void run();
  }, [loading, reload, viewerUserId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      return (
        (c.nombre_completo ?? "").toLowerCase().includes(q) ||
        (c.empresa ?? "").toLowerCase().includes(q) ||
        (c.correo ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q) ||
        (c.pais ?? "").toLowerCase().includes(q) ||
        (c.region ?? "").toLowerCase().includes(q)
      );
    });
  }, [clientes, search]);

  const formAvatarPreview = useMemo(() => {
    const v = formAvatarUrl.trim();
    if (!v) return "";
    const sep = v.includes("?") ? "&" : "?";
    return `${v}${sep}v=${formAvatarVersion || 0}`;
  }, [formAvatarUrl, formAvatarVersion]);

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
                  Clientes
                </h1>
                <p className="mt-1 text-sm text-zinc-600">Todos los clientes.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSaveMessage("");
                    setSaveError("");
                    setUploadAvatarError("");
                    setIsFormOpen((v) => !v);
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-900"
                >
                  Agregar cliente
                </button>
                <button
                  type="button"
                  onClick={() => void reload()}
                  disabled={rowsLoading}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
                >
                  {rowsLoading ? "Cargando..." : "Actualizar"}
                </button>
              </div>
            </div>

            {isFormOpen ? (
              <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        ref={avatarFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => void onPickAvatarFile(e)}
                      />

                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Avatar
                        </span>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            onClick={() => avatarFileRef.current?.click()}
                            disabled={uploadingAvatar || !viewerUserId}
                            className="inline-flex h-11 items-center justify-center rounded-xl border border-black/[.12] bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
                          >
                            {uploadingAvatar ? "Subiendo..." : "Subir imagen"}
                          </button>
                          <input
                            value={formAvatarUrl}
                            onChange={(e) => {
                              setFormAvatarUrl(e.target.value);
                              setFormAvatarVersion(Date.now());
                            }}
                            placeholder="O pega una URL…"
                            className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                          />
                        </div>
                        {uploadAvatarError ? (
                          <div className="text-sm text-red-700">
                            {uploadAvatarError}
                          </div>
                        ) : null}
                      </label>

                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Nombre completo
                        </span>
                        <input
                          value={formNombreCompleto}
                          onChange={(e) => setFormNombreCompleto(e.target.value)}
                          className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Empresa
                        </span>
                        <input
                          value={formEmpresa}
                          onChange={(e) => setFormEmpresa(e.target.value)}
                          className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Teléfono
                        </span>
                        <input
                          value={formTelefono}
                          onChange={(e) => setFormTelefono(e.target.value)}
                          className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Correo
                        </span>
                        <input
                          value={formCorreo}
                          onChange={(e) => setFormCorreo(e.target.value)}
                          inputMode="email"
                          className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          País
                        </span>
                        <input
                          value={formPais}
                          onChange={(e) => setFormPais(e.target.value)}
                          className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Estado / Región
                        </span>
                        <input
                          value={formRegion}
                          onChange={(e) => setFormRegion(e.target.value)}
                          className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/[.08] bg-zinc-50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-200">
                        {formAvatarPreview ? (
                          <span className="relative block h-full w-full">
                            <Image
                              src={formAvatarPreview}
                              alt=""
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {formNombreCompleto.trim() || "Nuevo cliente"}
                        </div>
                        <div className="truncate text-sm text-zinc-600">
                          {formEmpresa.trim() || "—"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void createCliente()}
                      disabled={saving || !viewerUserId}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-900 disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Guardar cliente"}
                    </button>

                    {saveError ? (
                      <div className="mt-3 text-sm text-red-700">
                        {saveError}
                      </div>
                    ) : saveMessage ? (
                      <div className="mt-3 text-sm text-emerald-700">
                        {saveMessage}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Buscar
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cliente o empresa…"
                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                />
              </label>
            </div>

            {rowsError ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                {rowsError}
              </div>
            ) : null}

            <div className="mt-5 rounded-2xl border border-black/[.08] bg-white">
              <div className="border-b border-black/[.08] bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Resultados ({filtered.length})
              </div>
              {rowsLoading ? (
                <div className="px-4 py-6 text-sm text-zinc-600">
                  Cargando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-6 text-sm text-zinc-600">
                  Sin clientes.
                </div>
              ) : (
                <div className="p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-black/[.08] bg-white p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-200">
                            {c.avatar_url ? (
                              <span className="relative block h-full w-full">
                                <Image
                                  src={`${c.avatar_url}${c.avatar_url.includes("?") ? "&" : "?"}v=${encodeURIComponent(c.created_at)}`}
                                  alt=""
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-900">
                              {c.nombre_completo || "—"}
                            </div>
                            <div className="truncate text-sm text-zinc-600">
                              {c.empresa || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-zinc-700">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              Teléfono
                            </div>
                            <div className="break-words font-medium text-zinc-900">
                              {c.telefono || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              Correo
                            </div>
                            <div className="break-all font-medium text-zinc-900">
                              {c.correo || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              País
                            </div>
                            <div className="break-words font-medium text-zinc-900">
                              {c.pais || "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                              Estado / Región
                            </div>
                            <div className="break-words font-medium text-zinc-900">
                              {c.region || "—"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 text-xs text-zinc-500">
                          {new Date(c.created_at).toLocaleString("es-MX")}
                        </div>
                      </div>
                    ))}
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
