-- =====================================================================
-- 009 · Asistente de IA: contador de uso diario (límite de consultas)
-- Solo lo usa la función del servidor; los usuarios no tienen acceso.
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- =====================================================================
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
alter table public.ai_usage force row level security;
revoke all on public.ai_usage from anon, authenticated;
-- (sin políticas: solo la clave de servicio de la función puede leer/escribir)
