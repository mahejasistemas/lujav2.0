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
  const [sort, setSort] = useState<"recent" | "az" | "za">("recent");

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
    const base = !q
      ? clientes
      : clientes.filter((c) => {
      return (
        (c.nombre_completo ?? "").toLowerCase().includes(q) ||
        (c.empresa ?? "").toLowerCase().includes(q) ||
        (c.correo ?? "").toLowerCase().includes(q) ||
        (c.telefono ?? "").toLowerCase().includes(q) ||
        (c.pais ?? "").toLowerCase().includes(q) ||
        (c.region ?? "").toLowerCase().includes(q)
      );
        });

    const sorted = [...base];
    if (sort === "recent") {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else {
      sorted.sort((a, b) => {
        const an = String(a.nombre_completo ?? "").trim().toLowerCase();
        const bn = String(b.nombre_completo ?? "").trim().toLowerCase();
        return an.localeCompare(bn, "es-MX");
      });
      if (sort === "za") sorted.reverse();
    }

    return sorted;
  }, [clientes, search, sort]);

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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
              <aside className="hidden lg:block">
                <div className="rounded-2xl border border-black/[.08] bg-white p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Secciones
                  </div>
                  <div className="mt-3 flex flex-col gap-1">
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 18a7 7 0 0 1 14 0H3Z" />
                        </svg>
                      </span>
                      Clientes
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-black/[.03]"
                      disabled
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-500">
                          <path d="M3 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3Zm3 4h8v2H6V7Zm0 4h8v2H6v-2Z" />
                        </svg>
                      </span>
                      Empresas
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/platf/estadisticas")}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-black/[.03]"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-500">
                          <path d="M2 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v6H3a1 1 0 0 1-1-1v-5Zm6-8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v14H8V3Zm6 5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3V8Z" />
                        </svg>
                      </span>
                      Gráficos
                    </button>
                  </div>
                </div>
              </aside>

              <section className="min-w-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-semibold text-zinc-900">
                      Todos los Clientes
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSaveMessage("");
                        setSaveError("");
                        setUploadAvatarError("");
                        setIsFormOpen(true);
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-4 text-sm font-semibold text-white hover:bg-zinc-900"
                    >
                      Nuevo Cliente
                      <span className="ml-2 text-lg leading-none">+</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-black/[.10] bg-white px-3 py-2 text-sm text-zinc-700">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-500">
                        <path d="M10 2a1 1 0 0 1 1 1v7h4a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
                        <path d="M10 18a8 8 0 1 1 8-8h-2a6 6 0 1 0-6 6v2Z" />
                      </svg>
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as typeof sort)}
                        className="bg-transparent text-sm font-medium text-zinc-900 outline-none"
                        disabled={rowsLoading}
                      >
                        <option value="recent">Más recientes</option>
                        <option value="az">A - Z</option>
                        <option value="za">Z - A</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => void reload()}
                      disabled={rowsLoading}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02] disabled:opacity-60"
                    >
                      {rowsLoading ? "Cargando..." : "Actualizar"}
                    </button>
                  </div>

                  <div className="w-full sm:w-[360px]">
                    <div className="relative">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nombre, empresa o…"
                        className="h-10 w-full rounded-full border border-black/[.12] bg-white pl-10 pr-4 text-sm text-zinc-900 outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path
                            fillRule="evenodd"
                            d="M9 3a6 6 0 1 0 3.467 10.9l3.316 3.316a1 1 0 0 0 1.414-1.414l-3.316-3.316A6 6 0 0 0 9 3Zm-4 6a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>

                {isFormOpen ? (
                  <div className="mt-4 rounded-2xl border border-black/[.08] bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-zinc-900">
                        Nuevo cliente
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-black/[.12] bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-black/[.02]"
                      >
                        Cerrar
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                          <div className="h-12 w-12 overflow-hidden rounded-xl bg-zinc-200">
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

                {rowsError ? (
                  <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                    {rowsError}
                  </div>
                ) : null}

                <div className="mt-5">
                  {rowsLoading ? (
                    <div className="rounded-2xl border border-black/[.08] bg-white px-4 py-6 text-sm text-zinc-600">
                      Cargando…
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="rounded-2xl border border-black/[.08] bg-white px-4 py-6 text-sm text-zinc-600">
                      Sin clientes.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {filtered.map((c) => {
                        const name = c.nombre_completo || "—";
                        const company = c.empresa || "—";
                        const location = [c.region, c.pais].filter(Boolean).join(", ") || "—";
                        const created = new Date(c.created_at).toLocaleDateString("es-MX");
                        const initials = String(name)
                          .split(" ")
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase())
                          .join("");

                        return (
                          <div key={c.id} className="overflow-hidden rounded-2xl border border-black/[.08] bg-white">
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="h-10 w-10 overflow-hidden rounded-xl bg-zinc-200">
                                    {c.avatar_url ? (
                                      <span className="relative block h-full w-full">
                                        <Image
                                          src={`${c.avatar_url}${c.avatar_url.includes("?") ? "&" : "?"}v=${encodeURIComponent(c.created_at)}`}
                                          alt=""
                                          fill
                                          sizes="40px"
                                          className="object-cover"
                                        />
                                      </span>
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-700">
                                        {initials || "—"}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-zinc-900">
                                      {name}
                                    </div>
                                    <div className="truncate text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                                      {company}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-black/[.04]"
                                  aria-label="Opciones"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M6 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm6 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                                  </svg>
                                </button>
                              </div>

                              <div className="mt-4 space-y-2 text-sm text-zinc-700">
                                <div className="flex items-center gap-2">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
                                    <path d="M6 2a1 1 0 0 0-1 1v1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H7V3a1 1 0 0 0-1-1Zm10 7H4v7h12V9Z" />
                                  </svg>
                                  <span className="text-xs text-zinc-600">{created}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
                                    <path
                                      fillRule="evenodd"
                                      d="M10 2a6 6 0 0 0-6 6c0 4.2 6 10 6 10s6-5.8 6-10a6 6 0 0 0-6-6Zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span className="text-xs text-zinc-600">{location}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
                                    <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h13A1.5 1.5 0 0 1 18 3.5v13A1.5 1.5 0 0 1 16.5 18h-13A1.5 1.5 0 0 1 2 16.5v-13Zm2.4.9 5.6 4.2 5.6-4.2H4.4Zm11.6 2.3-5.7 4.3a1 1 0 0 1-1.2 0L3.4 6.7V16h13V6.7Z" />
                                  </svg>
                                  <span className="truncate text-xs text-zinc-600">{c.correo || "—"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
                                    <path d="M2 4a2 2 0 0 1 2-2h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5.2c.6 2.6 2.6 4.6 5.2 5.2V12a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2c-6.1 0-11-4.9-11-11Z" />
                                  </svg>
                                  <span className="truncate text-xs text-zinc-600">{c.telefono || "—"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 bg-brand px-4 py-3 text-xs font-semibold text-white">
                              <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-1">
                                {c.region || "General"}
                              </span>
                              <div className="flex items-center gap-4 text-white/90">
                                <span className="inline-flex items-center gap-2">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M6 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5a1 1 0 0 0-.293-.707l-3.5-3.5A1 1 0 0 0 11.5 3H6Z" />
                                  </svg>
                                  0 cotizaciones
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                    <path d="M3 3a1 1 0 0 1 1 1v11h12a1 1 0 1 1 0 2H4a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1Zm5 4a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 2a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Zm4-3a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1Z" />
                                  </svg>
                                  0 reportes
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
