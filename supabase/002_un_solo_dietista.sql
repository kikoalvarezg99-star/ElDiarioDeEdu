-- =====================================================================
-- 002 · Un solo dietista: la primera cuenta que configura la consulta es
--       el dietista; después nadie más puede hacerse dietista.
-- Ejecutar UNA vez en Supabase > SQL Editor (si ya ejecutaste schema.sql).
-- =====================================================================

create or replace function public.setup_available() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.clinics)
$$;

revoke all on function public.setup_available() from public, anon;
grant execute on function public.setup_available() to authenticated;

create or replace function public.create_clinic(p_name text, p_first text, p_last text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_clinic uuid;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if exists (select 1 from public.clinics) then
    raise exception 'la consulta ya está configurada';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'el usuario ya tiene perfil';
  end if;
  insert into public.clinics (name) values (p_name) returning id into v_clinic;
  insert into public.profiles (id, clinic_id, role, first_name, last_name)
  values (auth.uid(), v_clinic, 'owner', p_first, p_last);
  insert into public.measurement_types (clinic_id, code, name, unit) values
    (v_clinic, 'weight',   'Peso',    'kg'),
    (v_clinic, 'waist',    'Cintura', 'cm'),
    (v_clinic, 'hip',      'Cadera',  'cm'),
    (v_clinic, 'body_fat', '% grasa', '%');
  insert into public.recipe_categories (clinic_id, name) values
    (v_clinic, 'Desayunos'), (v_clinic, 'Comidas'), (v_clinic, 'Cenas'),
    (v_clinic, 'Snacks'), (v_clinic, 'Postres');
  return v_clinic;
end $$;
