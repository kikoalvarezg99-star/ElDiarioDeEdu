-- =====================================================================
-- 008 · RGPD: solicitudes de derechos del cliente + borrado completo
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- =====================================================================

-- Solicitudes (descarga o borrado de datos) que hace el cliente
create table if not exists public.data_requests (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  kind       text not null check (kind in ('export', 'delete')),
  status     text not null default 'pending' check (status in ('pending', 'done')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists data_requests_client on public.data_requests (client_id, status);

alter table public.data_requests enable row level security;
alter table public.data_requests force row level security;
revoke all on public.data_requests from anon;

drop policy if exists dr_select on public.data_requests;
create policy dr_select on public.data_requests for select to authenticated
  using (public.can_access_client(client_id));

drop policy if exists dr_client_insert on public.data_requests;
create policy dr_client_insert on public.data_requests for insert to authenticated
  with check (client_id = public.my_client_id() and status = 'pending');

drop policy if exists dr_staff_update on public.data_requests;
create policy dr_staff_update on public.data_requests for update to authenticated
  using (public.can_staff_client(client_id))
  with check (public.can_staff_client(client_id));

-- Solo se puede cambiar el estado
revoke update on public.data_requests from authenticated;
grant  update (status) on public.data_requests to authenticated;

drop trigger if exists dr_scope on public.data_requests;
create trigger dr_scope before insert on public.data_requests
  for each row execute function public.tg_scope_from_client();
drop trigger if exists dr_by on public.data_requests;
create trigger dr_by before insert on public.data_requests
  for each row execute function public.tg_set_created_by();
drop trigger if exists n_dr_staff on public.data_requests;
create trigger n_dr_staff after insert on public.data_requests
  for each row execute function public.tg_notify_staff();

-- Borrado completo de un cliente (solo el administrador):
-- elimina su ficha con TODOS sus datos y su cuenta de acceso.
-- (Los archivos del almacenamiento los borra antes la propia app.)
create or replace function public.erase_client(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v public.clients%rowtype;
begin
  if public.app_role() is distinct from 'owner' then
    raise exception 'solo el administrador puede borrar clientes';
  end if;
  select * into v from public.clients
   where id = p_client and clinic_id = public.current_clinic_id();
  if not found then raise exception 'cliente no encontrado'; end if;

  delete from public.clients where id = p_client;
  if v.user_id is not null then
    delete from auth.users where id = v.user_id;
  end if;
  insert into public.audit_log (clinic_id, actor_id, action, table_name, record_id)
  values (v.clinic_id, auth.uid(), 'erase_client', 'clients', p_client);
end $$;

revoke all on function public.erase_client(uuid) from public, anon;
grant execute on function public.erase_client(uuid) to authenticated;
