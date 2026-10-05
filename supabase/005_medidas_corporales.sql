-- =====================================================================
-- 005 · Medidas corporales del cliente
--  * Añade los parámetros: Cuello, Brazo, Abdomen y Muslo (Cintura y Cadera
--    ya existen) a las consultas ya creadas, y a las nuevas.
--  * Permite que el cliente borre sus propios registros de las últimas 24 h
--    (por si se equivoca al teclear el peso o una medida).
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- =====================================================================

-- Parámetros nuevos para las consultas existentes
insert into public.measurement_types (clinic_id, code, name, unit)
select c.id, v.code, v.name, 'cm'
from public.clinics c
cross join (values
  ('neck',    'Cuello'),
  ('arm',     'Brazo'),
  ('abdomen', 'Abdomen'),
  ('thigh',   'Muslo')
) as v(code, name)
where not exists (
  select 1 from public.measurement_types t
  where t.clinic_id = c.id and t.name = v.name
);

-- Parámetros por defecto al crear una consulta nueva
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
    (v_clinic, 'neck',     'Cuello',  'cm'),
    (v_clinic, 'arm',      'Brazo',   'cm'),
    (v_clinic, 'waist',    'Cintura', 'cm'),
    (v_clinic, 'abdomen',  'Abdomen', 'cm'),
    (v_clinic, 'hip',      'Cadera',  'cm'),
    (v_clinic, 'thigh',    'Muslo',   'cm'),
    (v_clinic, 'body_fat', '% grasa', '%');
  insert into public.recipe_categories (clinic_id, name) values
    (v_clinic, 'Desayunos'), (v_clinic, 'Comidas'), (v_clinic, 'Cenas'),
    (v_clinic, 'Snacks'), (v_clinic, 'Postres');
  return v_clinic;
end $$;

-- El cliente puede borrar sus propios registros recientes (últimas 24 h)
drop policy if exists measurements_client_delete on public.measurements;
create policy measurements_client_delete on public.measurements
  for delete to authenticated
  using (
    client_id = public.my_client_id()
    and created_by = auth.uid()
    and created_at > now() - interval '1 day'
  );
