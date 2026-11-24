create or replace function private.transfer_conversation_ownership_impl(
  p_conversation_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_id uuid := (select auth.uid());
  membership_role text;
begin
  if caller_id is null then
    raise exception 'You must be signed in to transfer ownership.' using errcode = '42501';
  end if;
  if p_new_owner_id is null or p_new_owner_id = caller_id then
    raise exception 'Choose another conversation member as the new owner.' using errcode = '22023';
  end if;

  select cm.role into membership_role
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id and cm.user_id = caller_id;

  if membership_role is distinct from 'owner' then
    raise exception 'Only the current owner can transfer ownership.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.type in ('group','channel')
  ) then
    raise exception 'Ownership can only be transferred for groups and channels.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id and cm.user_id = p_new_owner_id
  ) then
    raise exception 'The new owner must already be a conversation member.' using errcode = '22023';
  end if;

  update public.conversation_members
  set role = 'admin'
  where conversation_id = p_conversation_id and user_id = caller_id;

  update public.conversation_members
  set role = 'owner'
  where conversation_id = p_conversation_id and user_id = p_new_owner_id;
end;
$function$;

revoke all on function private.transfer_conversation_ownership_impl(uuid,uuid) from public, anon;
grant execute on function private.transfer_conversation_ownership_impl(uuid,uuid) to authenticated;

create or replace function public.transfer_conversation_ownership(
  p_conversation_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform private.transfer_conversation_ownership_impl(p_conversation_id, p_new_owner_id);
end;
$function$;

revoke all on function public.transfer_conversation_ownership(uuid,uuid) from public, anon;
grant execute on function public.transfer_conversation_ownership(uuid,uuid) to authenticated;
