-- =====================================================================
-- 011 · Herramientas del administrador (solo rol "owner")
--   admin_users()          lista de usuarios con correo, último acceso y estado
--   admin_set_banned()     suspender / reactivar el acceso de un usuario
--   admin_remove_staff()   eliminar a un dietista
--   admin_stats()          uso de espacio y cifras generales
-- Ejecutar UNA vez en Supabase > SQL Editor.
-- =====================================================================

create or replace function public.admin_users()
returns table (
  user_id uuid, role public.user_role, first_name text, last_name text,
  email text, last_sign_in_at timestamptz, created_at timestamptz,
  banned boolean, client_id uuid
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.app_role() is distinct from 'owner' then
    raise exception 'solo el administrador';
  end if;
  return query
    select p.id, p.role, p.first_name, p.last_name, u.email::text,
           u.last_sign_in_at, u.created_at,
           (u.banned_until is not null and u.banned_until > now()),
           c.id
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.clients c on c.user_id = p.id
     where p.clinic_id = public.current_clinic_id()
     order by p.role, u.created_at;
end $$;

create or replace function public.admin_set_banned(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_role public.user_role;
begin
  if public.app_role() is distinct from 'owner' then
    raise exception 'solo el administrador';
  end if;
  if p_user = auth.uid() then raise exception 'no puedes suspenderte a ti mismo'; end if;
  select role into v_role from public.profiles
   where id = p_user and clinic_id = public.current_clinic_id();
  if not found then raise exception 'usuario no encontrado'; end if;
  if v_role = 'owner' then raise exception 'no se puede suspender al administrador'; end if;

  update auth.users
     set banned_until = case when p_banned then now() + interval '100 years' else null end
   where id = p_user;
  insert into public.audit_log (clinic_id, actor_id, action, table_name, record_id)
  values (public.current_clinic_id(), auth.uid(),
          case when p_banned then 'suspend_user' else 'reactivate_user' end, 'profiles', p_user);
end $$;

create or replace function public.admin_remove_staff(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if public.app_role() is distinct from 'owner' then
    raise exception 'solo el administrador';
  end if;
  if not exists (select 1 from public.profiles
                  where id = p_user and role = 'dietitian'
                    and clinic_id = public.current_clinic_id()) then
    raise exception 'dietista no encontrado';
  end if;
  delete from auth.users where id = p_user;
  insert into public.audit_log (clinic_id, actor_id, action, table_name, record_id)
  values (public.current_clinic_id(), auth.uid(), 'remove_staff', 'profiles', p_user);
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_clinic uuid := public.current_clinic_id();
begin
  if public.app_role() is distinct from 'owner' then
    raise exception 'solo el administrador';
  end if;
  return jsonb_build_object(
    'files_bytes',
      coalesce((select sum(size_bytes) from public.photos where clinic_id = v_clinic), 0)
    + coalesce((select sum(size_bytes) from public.food_photos where clinic_id = v_clinic), 0)
    + coalesce((select sum(size_bytes) from public.documents where clinic_id = v_clinic), 0),
    'db_bytes', pg_database_size(current_database()),
    'messages_30d', (select count(*) from public.messages
                      where clinic_id = v_clinic and created_at > now() - interval '30 days'),
    'requests_pending', (select count(*) from public.data_requests
                          where clinic_id = v_clinic and status = 'pending')
  );
end $$;

revoke all on function public.admin_users(), public.admin_stats(),
  public.admin_set_banned(uuid, boolean), public.admin_remove_staff(uuid) from public, anon;
grant execute on function public.admin_users(), public.admin_stats(),
  public.admin_set_banned(uuid, boolean), public.admin_remove_staff(uuid) to authenticated;
