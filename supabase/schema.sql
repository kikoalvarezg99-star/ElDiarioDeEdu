-- =====================================================================
-- DietApp · Esquema inicial (PostgreSQL / Supabase)
-- Multi-clínica, con seguridad a nivel de base de datos (RLS) y
-- almacenamiento privado. Ejecutar completo en Supabase > SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.user_role     as enum ('owner', 'dietitian', 'client');
create type public.client_status as enum ('active', 'paused', 'archived');
create type public.photo_kind    as enum ('front', 'side', 'back', 'other');
create type public.meal_slot     as enum ('breakfast', 'mid_morning', 'lunch', 'snack', 'dinner');

-- =====================================================================
-- TABLAS
-- =====================================================================

create table public.clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  role       public.user_role not null,
  first_name text not null default '',
  last_name  text not null default '',
  phone      text,
  created_at timestamptz not null default now()
);

create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null references public.clinics(id) on delete cascade,
  user_id          uuid unique references auth.users(id) on delete set null,
  dietitian_id     uuid references public.profiles(id) on delete set null,
  first_name       text not null,
  last_name        text not null default '',
  email            text,
  phone            text,
  birth_date       date,
  height_cm        numeric(5,1) check (height_cm is null or height_cm between 50 and 250),
  goals            text,
  status           public.client_status not null default 'active',
  joined_on        date not null default current_date,
  last_activity_at timestamptz,
  created_at       timestamptz not null default now()
);

-- Observaciones privadas del dietista (el cliente NO las ve)
create table public.client_notes (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  body       text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.client_invites (
  code       text primary key default encode(gen_random_bytes(8), 'hex'),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Evolución
create table public.measurement_types (
  id        uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  code      text,                       -- 'weight', 'waist', 'hip', 'body_fat'...
  name      text not null,
  unit      text not null,
  unique (clinic_id, name)
);

create table public.measurements (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  type_id     uuid not null references public.measurement_types(id) on delete restrict,
  value       numeric(8,2) not null check (value > 0),
  measured_on date not null default current_date,
  source      text not null default 'staff' check (source in ('client', 'staff')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Seguimiento / revisiones
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references public.clinics(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  reviewed_on    date not null default current_date,
  weight_kg      numeric(5,2),
  observations   text,
  next_review_on date,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.review_measurements (
  review_id uuid not null references public.reviews(id) on delete cascade,
  type_id   uuid not null references public.measurement_types(id) on delete restrict,
  value     numeric(8,2) not null,
  primary key (review_id, type_id)
);

-- Archivos (los ficheros viven en Storage; aquí solo la referencia)
create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  kind         public.photo_kind not null default 'other',
  taken_on     date not null default current_date,
  storage_path text not null unique,    -- clinic_id/client_id/uuid.webp
  thumb_path   text,
  size_bytes   integer,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  category     text not null default 'otros',   -- dieta, analitica, informe...
  name         text not null,
  storage_path text not null unique,
  size_bytes   integer,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Recetas
create table public.recipe_categories (
  id        uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name      text not null,
  unique (clinic_id, name)
);

create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  category_id  uuid references public.recipe_categories(id) on delete set null,
  name         text not null,
  photo_path   text,
  instructions text,
  kcal         numeric(7,1) check (kcal is null or kcal >= 0),
  protein_g    numeric(6,1) check (protein_g is null or protein_g >= 0),
  carbs_g      numeric(6,1) check (carbs_g is null or carbs_g >= 0),
  fat_g        numeric(6,1) check (fat_g is null or fat_g >= 0),
  created_at   timestamptz not null default now()
);

create table public.recipe_ingredients (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name      text not null,
  quantity  numeric(8,2),
  unit      text
);

create table public.recipe_assignments (
  recipe_id   uuid not null references public.recipes(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (recipe_id, client_id)
);

-- Planes nutricionales
create table public.meal_plans (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  valid_from date,
  valid_to   date,
  status     text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

create table public.meal_plan_items (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.meal_plans(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),  -- 1 = lunes
  slot        public.meal_slot not null,
  description text not null,
  recipe_id   uuid references public.recipes(id) on delete set null,
  position    smallint not null default 0
);

create table public.meal_logs (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  item_id   uuid not null references public.meal_plan_items(id) on delete cascade,
  log_date  date not null default current_date,
  completed boolean not null default true,
  unique (item_id, log_date)
);

-- Mensajería (un hilo por cliente)
create table public.conversations (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  client_id  uuid not null unique references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  clinic_id       uuid not null references public.clinics(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null check (length(body) between 1 and 4000),
  attachment_path text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Avisos
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- RGPD
create table public.consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,            -- 'health_data', 'photos', 'privacy_policy'
  version     text not null,
  accepted_at timestamptz not null default now()
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  clinic_id  uuid references public.clinics(id) on delete cascade,
  actor_id   uuid,
  action     text not null,
  table_name text,
  record_id  uuid,
  created_at timestamptz not null default now()
);

-- Índices
create index on public.clients (clinic_id, status);
create index on public.clients (dietitian_id);
create index on public.measurements (client_id, type_id, measured_on desc);
create index on public.photos (client_id, taken_on desc);
create index on public.documents (client_id);
create index on public.reviews (client_id, reviewed_on desc);
create index on public.meal_plans (client_id, status);
create index on public.meal_plan_items (plan_id, day_of_week, slot);
create index on public.meal_logs (client_id, log_date);
create index on public.messages (conversation_id, created_at);
create index on public.notifications (user_id, read_at, created_at desc);
create index on public.recipes (clinic_id, category_id);

-- =====================================================================
-- FUNCIONES AUXILIARES (security definer: evitan recursión de RLS)
-- =====================================================================

create or replace function public.app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_clinic_id() returns uuid
language sql stable security definer set search_path = public as $$
  select clinic_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() in ('owner', 'dietitian'), false)
$$;

create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.clients where user_id = auth.uid()
$$;

create or replace function public.my_dietitian_id() returns uuid
language sql stable security definer set search_path = public as $$
  select dietitian_id from public.clients where user_id = auth.uid()
$$;

-- El owner ve todos los clientes de su clínica; un dietista, solo los suyos.
create or replace function public.can_staff_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid
      and c.clinic_id = public.current_clinic_id()
      and public.is_staff()
      and (public.app_role() = 'owner' or c.dietitian_id = auth.uid())
  )
$$;

-- Acceso = ser el propio cliente, o personal autorizado sobre ese cliente.
create or replace function public.can_access_client(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select cid is not null and (
    exists (select 1 from public.clients c where c.id = cid and c.user_id = auth.uid())
    or public.can_staff_client(cid)
  )
$$;

-- Extrae un uuid de una carpeta de la ruta de Storage (null si no es válido)
create or replace function public.path_uuid(p text, idx int) returns uuid
language plpgsql immutable as $$
begin
  return (storage.foldername(p))[idx]::uuid;
exception when others then
  return null;
end $$;

-- =====================================================================
-- TRIGGERS DE INTEGRIDAD (el cliente no puede falsear clínica/autor/origen)
-- =====================================================================

create or replace function public.tg_set_clinic() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.clinic_id := public.current_clinic_id();
  end if;
  return new;
end $$;

create or replace function public.tg_clients_defaults() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.clinic_id := public.current_clinic_id();
    if new.dietitian_id is null then new.dietitian_id := auth.uid(); end if;
  end if;
  return new;
end $$;

create or replace function public.tg_scope_from_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select clinic_id into new.clinic_id from public.clients where id = new.client_id;
  if new.clinic_id is null then raise exception 'cliente no encontrado'; end if;
  return new;
end $$;

create or replace function public.tg_set_created_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;

create or replace function public.tg_measurement_source() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.source := case when auth.uid() is null or public.is_staff() then 'staff' else 'client' end;
  return new;
end $$;

create or replace function public.tg_message_scope() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select client_id, clinic_id into new.client_id, new.clinic_id
  from public.conversations where id = new.conversation_id;
  if new.client_id is null then raise exception 'conversación no encontrada'; end if;
  new.sender_id := auth.uid();
  return new;
end $$;

create or replace function public.tg_conversation_for_client() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.conversations (clinic_id, client_id) values (new.clinic_id, new.id);
  return new;
end $$;

create trigger clients_defaults   before insert on public.clients           for each row execute function public.tg_clients_defaults();
create trigger clients_conv       after  insert on public.clients           for each row execute function public.tg_conversation_for_client();
create trigger mt_clinic          before insert on public.measurement_types for each row execute function public.tg_set_clinic();
create trigger rc_clinic          before insert on public.recipe_categories for each row execute function public.tg_set_clinic();
create trigger recipes_clinic     before insert on public.recipes            for each row execute function public.tg_set_clinic();

create trigger meas_scope   before insert on public.measurements   for each row execute function public.tg_scope_from_client();
create trigger meas_source  before insert on public.measurements   for each row execute function public.tg_measurement_source();
create trigger meas_by      before insert on public.measurements   for each row execute function public.tg_set_created_by();
create trigger rev_scope    before insert on public.reviews        for each row execute function public.tg_scope_from_client();
create trigger rev_by       before insert on public.reviews        for each row execute function public.tg_set_created_by();
create trigger photo_scope  before insert on public.photos         for each row execute function public.tg_scope_from_client();
create trigger photo_by     before insert on public.photos         for each row execute function public.tg_set_created_by();
create trigger doc_scope    before insert on public.documents      for each row execute function public.tg_scope_from_client();
create trigger doc_by       before insert on public.documents      for each row execute function public.tg_set_created_by();
create trigger plan_scope   before insert on public.meal_plans     for each row execute function public.tg_scope_from_client();
create trigger notes_scope  before insert on public.client_notes   for each row execute function public.tg_scope_from_client();
create trigger notes_by     before insert on public.client_notes   for each row execute function public.tg_set_created_by();
create trigger invite_scope before insert on public.client_invites for each row execute function public.tg_scope_from_client();
create trigger invite_by    before insert on public.client_invites for each row execute function public.tg_set_created_by();
create trigger msg_scope    before insert on public.messages        for each row execute function public.tg_message_scope();

-- =====================================================================
-- NOTIFICACIONES Y ACTIVIDAD (automáticas)
-- =====================================================================

-- Avisos al dietista: mensaje, peso/medida o foto subidos por el cliente
create or replace function public.tg_notify_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client public.clients%rowtype;
  v_staff  uuid;
  v_actor  uuid;
begin
  select * into v_client from public.clients where id = new.client_id;
  v_actor := case when tg_table_name = 'messages' then new.sender_id else new.created_by end;
  if v_client.user_id is null or v_actor is distinct from v_client.user_id then
    return new;   -- solo cuando actúa el propio cliente
  end if;

  update public.clients set last_activity_at = now() where id = v_client.id;

  v_staff := coalesce(
    v_client.dietitian_id,
    (select id from public.profiles
      where clinic_id = v_client.clinic_id and role = 'owner'
      order by created_at limit 1)
  );
  if v_staff is not null then
    insert into public.notifications (user_id, type, payload)
    values (v_staff, tg_table_name || '_from_client',
            jsonb_build_object('client_id', v_client.id));
  end if;
  return new;
end $$;

-- Avisos al cliente: nuevo plan, receta, documento, revisión
create or replace function public.tg_notify_client() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.clients where id = new.client_id;
  if v_user is not null then
    insert into public.notifications (user_id, type, payload)
    values (v_user, tg_table_name || '_new',
            jsonb_build_object('client_id', new.client_id));
  end if;
  return new;
end $$;

-- Aviso al cliente cuando el dietista responde
create or replace function public.tg_notify_reply() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.clients where id = new.client_id;
  if v_user is not null and new.sender_id is distinct from v_user then
    insert into public.notifications (user_id, type, payload)
    values (v_user, 'message_reply', jsonb_build_object('client_id', new.client_id));
  end if;
  return new;
end $$;

create trigger n_msg_staff   after insert on public.messages           for each row execute function public.tg_notify_staff();
create trigger n_msg_client  after insert on public.messages           for each row execute function public.tg_notify_reply();
create trigger n_meas_staff  after insert on public.measurements       for each row execute function public.tg_notify_staff();
create trigger n_photo_staff after insert on public.photos             for each row execute function public.tg_notify_staff();
create trigger n_plan        after insert on public.meal_plans         for each row execute function public.tg_notify_client();
create trigger n_doc         after insert on public.documents          for each row execute function public.tg_notify_client();
create trigger n_review      after insert on public.reviews            for each row execute function public.tg_notify_client();
create trigger n_recipe      after insert on public.recipe_assignments for each row execute function public.tg_notify_client();

-- =====================================================================
-- ALTA DE CLÍNICA E INVITACIONES (sin servidor propio)
-- =====================================================================

-- ¿Se puede configurar todavía la consulta? Solo mientras no exista ninguna.
create or replace function public.setup_available() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.clinics)
$$;

-- La PRIMERA cuenta en configurarse queda como dietista (owner). Una vez creada
-- la consulta, nadie más puede hacerse dietista: el resto entra por invitación.
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

-- El cliente, tras registrarse, canjea el código de invitación del dietista.
create or replace function public.claim_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_inv    public.client_invites%rowtype;
  v_client public.clients%rowtype;
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'el usuario ya tiene perfil';
  end if;

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

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'clinics','profiles','clients','client_notes','client_invites',
    'measurement_types','measurements','reviews','review_measurements',
    'photos','documents','recipe_categories','recipes','recipe_ingredients',
    'recipe_assignments','meal_plans','meal_plan_items','meal_logs',
    'conversations','messages','notifications','consents','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- Tablas por cliente: lectura (cliente o personal) + escritura solo personal
do $$
declare t text;
begin
  foreach t in array array['measurements','reviews','photos','documents','recipe_assignments'] loop
    execute format('create policy %I on public.%I for select to authenticated
                    using (public.can_access_client(client_id))', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (public.can_staff_client(client_id))
                    with check (public.can_staff_client(client_id))', t || '_staff_write', t);
  end loop;
end $$;

-- clinics / profiles
create policy clinics_select on public.clinics for select to authenticated
  using (id = public.current_clinic_id());
create policy clinics_update on public.clinics for update to authenticated
  using (id = public.current_clinic_id() and public.app_role() = 'owner')
  with check (id = public.current_clinic_id());

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid()
         or (clinic_id = public.current_clinic_id() and public.is_staff())
         or id = public.my_dietitian_id());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- clients
create policy clients_select on public.clients for select to authenticated
  using (
    user_id = auth.uid()
    or (clinic_id = public.current_clinic_id() and public.is_staff())
  );
create policy clients_insert on public.clients for insert to authenticated
  with check (public.is_staff());
create policy clients_update on public.clients for update to authenticated
  using (public.can_staff_client(id))
  with check (clinic_id = public.current_clinic_id());
create policy clients_delete on public.clients for delete to authenticated
  using (public.can_staff_client(id));

-- Solo personal
create policy notes_staff on public.client_notes for all to authenticated
  using (public.can_staff_client(client_id)) with check (public.can_staff_client(client_id));
create policy invites_staff on public.client_invites for all to authenticated
  using (public.can_staff_client(client_id)) with check (public.can_staff_client(client_id));

-- Tipos de medida y categorías (de la clínica)
create policy mt_select on public.measurement_types for select to authenticated
  using (clinic_id = public.current_clinic_id());
create policy mt_staff on public.measurement_types for all to authenticated
  using (public.is_staff() and clinic_id = public.current_clinic_id())
  with check (public.is_staff() and clinic_id = public.current_clinic_id());

create policy rc_select on public.recipe_categories for select to authenticated
  using (clinic_id = public.current_clinic_id());
create policy rc_staff on public.recipe_categories for all to authenticated
  using (public.is_staff() and clinic_id = public.current_clinic_id())
  with check (public.is_staff() and clinic_id = public.current_clinic_id());

-- El cliente puede registrar sus propias medidas (peso, etc.)
create policy measurements_client_insert on public.measurements for insert to authenticated
  with check (client_id = public.my_client_id());

-- Revisiones: medidas asociadas
create policy revm_select on public.review_measurements for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id));
create policy revm_staff on public.review_measurements for all to authenticated
  using (exists (select 1 from public.reviews r
                 where r.id = review_id and public.can_staff_client(r.client_id)))
  with check (exists (select 1 from public.reviews r
                 where r.id = review_id and public.can_staff_client(r.client_id)));

-- Fotos: el cliente sube las suyas
create policy photos_client_insert on public.photos for insert to authenticated
  with check (client_id = public.my_client_id());

-- Recetas: el personal ve todas las de su clínica; el cliente solo las asignadas
create policy recipes_select on public.recipes for select to authenticated
  using ((public.is_staff() and clinic_id = public.current_clinic_id())
         or id in (select recipe_id from public.recipe_assignments
                   where client_id = public.my_client_id()));
create policy recipes_staff on public.recipes for all to authenticated
  using (public.is_staff() and clinic_id = public.current_clinic_id())
  with check (public.is_staff() and clinic_id = public.current_clinic_id());

create policy ingr_select on public.recipe_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id));
create policy ingr_staff on public.recipe_ingredients for all to authenticated
  using (public.is_staff() and exists
         (select 1 from public.recipes r
          where r.id = recipe_id and r.clinic_id = public.current_clinic_id()))
  with check (public.is_staff() and exists
         (select 1 from public.recipes r
          where r.id = recipe_id and r.clinic_id = public.current_clinic_id()));

-- Planes: el cliente solo ve los planes activos
create policy plans_select on public.meal_plans for select to authenticated
  using (public.can_access_client(client_id)
         and (public.is_staff() or status = 'active'));
create policy plans_staff on public.meal_plans for all to authenticated
  using (public.can_staff_client(client_id)) with check (public.can_staff_client(client_id));

create policy items_select on public.meal_plan_items for select to authenticated
  using (exists (select 1 from public.meal_plans p where p.id = plan_id));
create policy items_staff on public.meal_plan_items for all to authenticated
  using (exists (select 1 from public.meal_plans p
                 where p.id = plan_id and public.can_staff_client(p.client_id)))
  with check (exists (select 1 from public.meal_plans p
                 where p.id = plan_id and public.can_staff_client(p.client_id)));

-- Comidas realizadas
create policy logs_select on public.meal_logs for select to authenticated
  using (public.can_access_client(client_id));
create policy logs_insert on public.meal_logs for insert to authenticated
  with check (client_id = public.my_client_id()
              and exists (select 1 from public.meal_plan_items i
                          join public.meal_plans p on p.id = i.plan_id
                          where i.id = item_id and p.client_id = meal_logs.client_id));
create policy logs_update on public.meal_logs for update to authenticated
  using (client_id = public.my_client_id()) with check (client_id = public.my_client_id());

-- Mensajería
create policy conv_select on public.conversations for select to authenticated
  using (public.can_access_client(client_id));
create policy msg_select on public.messages for select to authenticated
  using (public.can_access_client(client_id));
create policy msg_insert on public.messages for insert to authenticated
  with check (exists (select 1 from public.conversations c
                      where c.id = conversation_id and public.can_access_client(c.client_id)));
create policy msg_mark_read on public.messages for update to authenticated
  using (public.can_access_client(client_id) and sender_id <> auth.uid())
  with check (public.can_access_client(client_id) and sender_id <> auth.uid());

-- Avisos propios
create policy notif_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RGPD
create policy consents_select on public.consents for select to authenticated
  using (user_id = auth.uid());
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid());
create policy audit_owner on public.audit_log for select to authenticated
  using (public.app_role() = 'owner' and clinic_id = public.current_clinic_id());

-- =====================================================================
-- PERMISOS DE COLUMNA Y FUNCIONES
-- =====================================================================

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- Nadie puede cambiarse el rol ni la clínica
revoke update on public.profiles from authenticated;
grant  update (first_name, last_name, phone) on public.profiles to authenticated;
-- Los mensajes solo permiten marcar como leído
revoke update on public.messages from authenticated;
grant  update (read_at) on public.messages to authenticated;
-- Los avisos los crea el sistema; el usuario solo los marca como leídos
revoke insert, delete on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant  update (read_at) on public.notifications to authenticated;

-- =====================================================================
-- ALMACENAMIENTO PRIVADO (fotos, documentos, imágenes de recetas)
-- Ruta: photos|documents -> clinic_id/client_id/archivo
--       recipes          -> clinic_id/archivo
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos',    'photos',    false, 3145728,
     array['image/jpeg','image/webp','image/png']),
  ('documents', 'documents', false, 20971520,
     array['application/pdf','image/jpeg','image/png',
           'application/msword',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('recipes',   'recipes',   false, 2097152,
     array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

create policy st_read_client_files on storage.objects for select to authenticated
  using (bucket_id in ('photos','documents')
         and public.can_access_client(public.path_uuid(name, 2)));

create policy st_insert_photos on storage.objects for insert to authenticated
  with check (bucket_id = 'photos'
              and public.can_access_client(public.path_uuid(name, 2)));

create policy st_insert_documents on storage.objects for insert to authenticated
  with check (bucket_id = 'documents'
              and public.can_staff_client(public.path_uuid(name, 2)));

create policy st_delete_client_files on storage.objects for delete to authenticated
  using (bucket_id in ('photos','documents')
         and public.can_staff_client(public.path_uuid(name, 2)));

create policy st_read_recipes on storage.objects for select to authenticated
  using (bucket_id = 'recipes'
         and public.path_uuid(name, 1) = public.current_clinic_id());

create policy st_write_recipes on storage.objects for all to authenticated
  using (bucket_id = 'recipes' and public.is_staff()
         and public.path_uuid(name, 1) = public.current_clinic_id())
  with check (bucket_id = 'recipes' and public.is_staff()
         and public.path_uuid(name, 1) = public.current_clinic_id());
