import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const servicesSupabaseUrl = process.env.NEXT_PUBLIC_SERVICES_SUPABASE_URL;
const servicesSupabaseKey =
  process.env.NEXT_PUBLIC_SERVICES_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SERVICES_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseKey) {
  throw new Error(
    "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const servicesSupabase =
  servicesSupabaseUrl && servicesSupabaseKey
    ? createClient(servicesSupabaseUrl, servicesSupabaseKey)
    : supabase;
