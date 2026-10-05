import { createClient } from "@supabase/supabase-js";

// La URL y la clave "publishable" son públicas por diseño: la seguridad real
// la imponen las políticas RLS de la base de datos (supabase/schema.sql).
// NUNCA pongas aquí la clave secret / service_role.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://hxqmemrwpoytgezktxsv.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_9qk8wTAjBRAaPMMSPmEAsA_b-gxWlP0";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
