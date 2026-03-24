"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (data.user) {
      const metadata = data.user.user_metadata as Partial<{
        nombre: string;
        apellido: string;
        telefono: string;
        base_id: number;
        puesto_id: number;
      }>;

      if (
        metadata.nombre ||
        metadata.apellido ||
        metadata.telefono ||
        metadata.base_id ||
        metadata.puesto_id
      ) {
        await supabase
          .from("profiles")
          .update({
            nombre: metadata.nombre,
            apellido: metadata.apellido,
            telefono: metadata.telefono,
            base_id: metadata.base_id,
            puesto_id: metadata.puesto_id,
          })
          .eq("user_id", data.user.id);
      }

      setStatus("ok");
      setMessage("Sesión iniciada.");
      router.replace("/platf");
      return;
    }

    setStatus("error");
    setMessage("No se pudo iniciar sesión.");
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
            Inicia sesión para continuar.
          </p>
        </div>
        <div className="relative text-xs text-zinc-500">© MetaWeb Dev Solutions</div>
      </aside>

      <main className="flex items-center justify-center px-6 py-10 md:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col gap-2">
            <div className="text-sm font-semibold tracking-tight text-brand md:hidden">
              MetaWeb Dev Solutions
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-brand">
              Iniciar sesión
            </h1>
            <p className="text-sm text-zinc-600">
              Usa tu correo y contraseña.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
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

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Contraseña
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border border-black/[.12] bg-white px-3 text-sm outline-none focus-visible:border-black/40 focus-visible:ring-2 focus-visible:ring-black/10"
                required
              />
            </label>

            <button
              type="submit"
              className="mt-1 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
              aria-busy={status === "loading"}
            >
              {status === "loading" ? "Entrando..." : "Entrar"}
            </button>
          </form>

          {message ? (
            <p className="mt-4 text-sm text-zinc-600">{message}</p>
          ) : null}

          <div className="mt-6 text-sm text-zinc-600">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="font-medium text-brand hover:text-brand-hover">
              Regístrate
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
