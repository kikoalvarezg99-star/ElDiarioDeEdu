-- =====================================================================
-- 010 · Función "ping" para que el proyecto no se pause por inactividad
-- Devuelve solo la hora; no expone ningún dato.
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- =====================================================================
create or replace function public.ping() returns timestamptz
language sql stable security definer set search_path = public as $$
  select now()
$$;
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
