-- =====================================================================
-- 003 · Roles: administrador (owner) + dietista con acceso casi total
-- Incluye lo de 002, así que basta con ejecutar este archivo una vez
-- en Supabase > SQL Editor (aunque ya hayas ejecutado el 002).
--
--  * El PRIMER usuario que configura la consulta es el ADMINISTRADOR.
--  * El administrador invita al dietista con un código (Ajustes > Equipo).
--  * Administrador y dietista ven y editan TODOS los clientes.
--  * Solo el administrador gestiona el equipo y puede borrar clientes.
-- =====================================================================

-- ---------- 002: solo se puede crear una consulta ----------
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

-- ---------- Todo el personal ve todos los clientes de la consulta ----------
create or replace function public.can_staff_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid
      and c.clinic_id = public.current_clinic_id()
      and public.is_staff()
  )
$$;

-- ---------- Solo el administrador puede borrar clientes ----------
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated
  using (public.can_staff_client(id) and public.app_role() = 'owner');

-- ---------- Invitaciones del equipo (dietistas) ----------
create table if not exists public.staff_invites (
  code       text primary key default encode(gen_random_bytes(8), 'hex'),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  role       public.user_role not null default 'dietitian' check (role = 'dietitian'),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.staff_invites enable row level security;
alter table public.staff_invites force row level security;
revoke all on public.staff_invites from anon;

drop policy if exists staff_invites_owner on public.staff_invites;
create policy staff_invites_owner on public.staff_invites for all to authenticated
  using (public.app_role() = 'owner' and clinic_id = public.current_clinic_id())
  with check (public.app_role() = 'owner' and clinic_id = public.current_clinic_id());

drop trigger if exists staffinv_clinic on public.staff_invites;
create trigger staffinv_clinic before insert on public.staff_invites
  for each row execute function public.tg_set_clinic();
drop trigger if exists staffinv_by on public.staff_invites;
create trigger staffinv_by before insert on public.staff_invites
  for each row execute function public.tg_set_created_by();

-- ---------- Un solo código sirve para clientes y para el dietista ----------
create or replace function public.claim_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_staff  public.staff_invites%rowtype;
  v_inv    public.client_invites%rowtype;
  v_client public.clients%rowtype;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'el usuario ya tiene perfil';
  end if;

  -- 1) ¿Es una invitación de equipo (dietista)?
  select * into v_staff from public.staff_invites
   where code = p_code and used_at is null and expires_at > now()
   for update;
  if found then
    insert into public.profiles (id, clinic_id, role)
    values (auth.uid(), v_staff.clinic_id, v_staff.role);
    update public.staff_invites set used_at = now() where code = v_staff.code;
    return v_staff.clinic_id;
  end if;

  -- 2) ¿Es una invitación de cliente?
  select * into v_inv from public.client_invites
   where code = p_code and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invitación no válida o caducada'; end if;

  select * into v_client from public.clients where id = v_inv.client_id for update;
  if v_client.user_id is not null then raise exception 'cliente ya vinculado'; end if;

  insert into public.profiles (id, clinic_id, role, first_name, last_name, phone)
  values (auth.uid(), v_client.clinic_id, 'client',
          v_client.first_name, v_client.last_name, v_client.phone);
  update public.clients set user_id = auth.uid() where id = v_client.id;
  update public.client_invites set used_at = now() where code = v_inv.code;
  return v_client.id;
end $$;
