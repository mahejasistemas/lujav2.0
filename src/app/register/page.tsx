"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";

type BaseRow = { id: number; nombre: string };
type PuestoRow = { id: number; nombre: string };

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [baseId, setBaseId] = useState<string>("");
  const [puestoId, setPuestoId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [bases, setBases] = useState<BaseRow[]>([]);
  const [puestos, setPuestos] = useState<PuestoRow[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [catalogMessage, setCatalogMessage] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      setLoadingCatalogs(true);
      setCatalogMessage("");

      const [
        { data: basesData, error: basesError },
        { data: puestosData, error: puestosError },
      ] = await Promise.all([
        supabase.from("bases").select("id,nombre").order("nombre"),
        supabase.from("puestos").select("id,nombre").order("nombre"),
      ]);

      if (cancelled) return;

      if (basesError || puestosError) {
        setBases([]);
        setPuestos([]);
        setLoadingCatalogs(false);
        setCatalogMessage(
          "No se pudieron cargar Bases/Puestos (revisa RLS para role anon).",
        );
        return;
      }

      setBases((basesData as BaseRow[] | null) ?? []);
      setPuestos((puestosData as PuestoRow[] | null) ?? []);
      setLoadingCatalogs(false);
    }

    void loadCatalogs();

    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(
      nombre.trim() &&
        apellido.trim() &&
        baseId &&
        puestoId &&
        email.trim() &&
        telefono.trim() &&
        password,
    );
  }, [apellido, baseId, email, nombre, password, puestoId, telefono]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      setStatus("error");
      setMessage("Completa todos los campos.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const base_id = Number(baseId);
    const puesto_id = Number(puestoId);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellido,
          telefono,
          base_id,
          puesto_id,
        },
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (!data.user) {
      setStatus("error");
      setMessage("No se pudo crear el usuario.");
      return;
    }

    if (data.session) {
      await supabase
        .from("profiles")
        .update({
          nombre,
          apellido,
          telefono,
          base_id,
          puesto_id,
        })
        .eq("user_id", data.user.id);
    }

    setStatus("ok");
    setMessage(
      data.session
        ? "Usuario creado y perfil guardado."
        : "Usuario creado. Revisa tu correo para confirmar y luego inicia sesión.",
    );

    if (data.session) {
      router.replace("/platf");
    }
  }

  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="absolute inset-0 opacity-60 [background:radial-gradient(60rem_40rem_at_10%_10%,rgba(255,255,255,0.14),transparent),radial-gradient(50rem_30rem_at_90%_80%,rgba(255,255,255,0.10),transparent)]" />
        <div className="relative text-xl font-semibold tracking-tight">
          MetaWeb Dev Solutions
        </div>
        <div className="max-w-md">
          <h2 className="text-5xl font-semibold leading-tight tracking-tight">
            Bienvenido a <span className="text-zinc-300">Plataforma Lujav.</span>
          </h2>
          <p className="mt-4 text-sm leading-6 text-zinc-400">
            Registra tu usuario, selecciona tu base y tu puesto para continuar.
          </p>
        </div>
        <div className="relative text-xs text-zinc-500">© MetaWeb Dev Solutions</div>
      </aside>

      <main className="flex items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col gap-2">
            <div className="text-sm font-semibold tracking-tight text-brand dark:text-zinc-50 md:hidden">
              MetaWeb Dev Solutions
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-brand">
              Crear cuenta
            </h1>
            <p className="text-sm text-zinc-600">
              Ingresa tus datos para registrarte.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Base
                </span>
                <select
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                  required
                  disabled={loadingCatalogs}
                >
                  <option value="" disabled>
                    {loadingCatalogs ? "Cargando..." : "Selecciona una base"}
                  </option>
                  {bases.map((b) => (
                    <option key={b.id} value={String(b.id)}>
                      {b.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Puesto
                </span>
                <select
                  value={puestoId}
                  onChange={(e) => setPuestoId(e.target.value)}
                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                  required
                  disabled={loadingCatalogs}
                >
                  <option value="" disabled>
                    {loadingCatalogs ? "Cargando..." : "Selecciona un puesto"}
                  </option>
                  {puestos.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Nombre
                </span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Apellido
                </span>
                <input
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Correo / Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Teléfono
                </span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                  required
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Contraseña
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-black/[.12] bg-white px-3 pr-24 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-black/[.04]"
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </label>

            <button
              type="submit"
              className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
              aria-busy={status === "loading"}
              disabled={!canSubmit || loadingCatalogs}
            >
              {status === "loading" ? "Creando..." : "Crear cuenta"}
            </button>
          </form>

          {message ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {message}
            </p>
          ) : null}
          {catalogMessage ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {catalogMessage}
            </p>
          ) : null}

          <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            ¿Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-brand hover:text-brand-hover dark:text-zinc-50"
            >
              Ingresar
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
