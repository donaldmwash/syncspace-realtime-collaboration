create or replace function private.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recent_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text, 0));

  select count(*)::integer into recent_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if recent_count >= 30 then
    raise exception 'You are sending messages too quickly. Please wait a moment and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_message_rate_limit on public.messages;
create trigger enforce_message_rate_limit
before insert on public.messages
for each row execute function private.enforce_message_rate_limit();

revoke all on function private.enforce_message_rate_limit() from public, anon, authenticated;
