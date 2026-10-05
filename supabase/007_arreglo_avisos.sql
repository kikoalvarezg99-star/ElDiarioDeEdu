-- Arreglo: 'record "new" has no field "sender_id"' al subir fotos/medidas.
-- El aviso al dietista leía un campo que solo existe en mensajes.
create or replace function public.tg_notify_staff() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_client public.clients%rowtype;
  v_staff  uuid;
  v_actor  uuid;
  j        jsonb := to_jsonb(new);
begin
  select * into v_client from public.clients where id = (j->>'client_id')::uuid;
  v_actor := case when tg_table_name = 'messages'
                  then (j->>'sender_id')::uuid
                  else (j->>'created_by')::uuid end;
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
