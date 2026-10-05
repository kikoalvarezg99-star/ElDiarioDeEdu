-- =====================================================================
-- 006 · Diario de comidas con fotos
-- Cada día el cliente sube una foto por comida (desayuno, media mañana,
-- comida, merienda, cena). El dietista las ve por día en la ficha.
-- Los archivos van al almacenamiento privado (bucket "photos"):
--   clinic_id / client_id / food / archivo
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- =====================================================================

create table if not exists public.food_photos (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  log_date     date not null,
  slot         public.meal_slot not null,
  storage_path text not null unique,
  thumb_path   text,
  size_bytes   integer,
  note         text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists food_photos_client_date
  on public.food_photos (client_id, log_date desc);

alter table public.food_photos enable row level security;
alter table public.food_photos force row level security;
revoke all on public.food_photos from anon;

drop policy if exists food_select on public.food_photos;
create policy food_select on public.food_photos for select to authenticated
  using (public.can_access_client(client_id));

drop policy if exists food_client_insert on public.food_photos;
create policy food_client_insert on public.food_photos for insert to authenticated
  with check (client_id = public.my_client_id());

drop policy if exists food_staff_write on public.food_photos;
create policy food_staff_write on public.food_photos for all to authenticated
  using (public.can_staff_client(client_id))
  with check (public.can_staff_client(client_id));

-- El cliente puede borrar sus propias fotos de las últimas 24 h
drop policy if exists food_client_delete on public.food_photos;
create policy food_client_delete on public.food_photos for delete to authenticated
  using (
    client_id = public.my_client_id()
    and created_by = auth.uid()
    and created_at > now() - interval '1 day'
  );

drop trigger if exists food_scope on public.food_photos;
create trigger food_scope before insert on public.food_photos
  for each row execute function public.tg_scope_from_client();
drop trigger if exists food_by on public.food_photos;
create trigger food_by before insert on public.food_photos
  for each row execute function public.tg_set_created_by();
-- Avisa al dietista cuando el cliente sube una foto de comida
drop trigger if exists n_food_staff on public.food_photos;
create trigger n_food_staff after insert on public.food_photos
  for each row execute function public.tg_notify_staff();

-- El cliente puede borrar los archivos de SUS fotos de comida
drop policy if exists st_delete_own_food on storage.objects;
create policy st_delete_own_food on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and public.path_uuid(name, 2) = public.my_client_id()
    and (storage.foldername(name))[3] = 'food'
  );
