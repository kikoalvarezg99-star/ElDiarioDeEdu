-- =====================================================================
-- 004 · Arreglo: crear clientes daba "violates row-level security policy"
-- Causa: al guardar un cliente nuevo, la regla de lectura consultaba la
-- propia tabla y no veía la fila recién insertada. Ahora la regla mira
-- directamente las columnas de la fila.
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- =====================================================================

drop policy if exists clients_select on public.clients;

create policy clients_select on public.clients for select to authenticated
  using (
    user_id = auth.uid()
    or (clinic_id = public.current_clinic_id() and public.is_staff())
  );
