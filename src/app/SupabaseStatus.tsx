"use client";

import { useMemo, useState } from "react";

import { supabase } from "@/lib/supabase/client";

type Status = "idle" | "checking" | "ok" | "error";

export function SupabaseStatus() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const supabaseHost = useMemo(() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
    } catch {
      return "";
    }
  }, []);

  async function check() {
    setStatus("checking");
    setMessage("");

    const { error } = await supabase.auth.getSession();

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("ok");
    setMessage("Configuración OK (auth.getSession).");
  }

  return (
    <section className="w-full rounded-xl border border-black/[.08] p-4 dark:border-white/[.145]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-black dark:text-zinc-50">
            Supabase
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {supabaseHost ? `Proyecto: ${supabaseHost}` : "Proyecto: (sin URL)"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void check()}
          className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          aria-busy={status === "checking"}
        >
          {status === "checking" ? "Comprobando..." : "Probar conexión"}
        </button>
      </div>
      <div className="mt-3 text-sm">
        <span className="font-medium text-black dark:text-zinc-50">
          Estado:
        </span>{" "}
        <span className="text-zinc-600 dark:text-zinc-400">{status}</span>
      </div>
      {message ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {message}
        </p>
      ) : null}
    </section>
  );
}
