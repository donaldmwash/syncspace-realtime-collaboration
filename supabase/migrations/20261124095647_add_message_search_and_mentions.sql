create index if not exists messages_body_search_idx
  on public.messages using gin (to_tsvector('simple', coalesce(body, '')));

create or replace function public.search_messages(
  p_query text,
  p_limit integer default 50
)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select m.id, m.conversation_id, m.sender_id, m.body, m.created_at
  from public.messages m
  where (select auth.uid()) is not null
    and length(trim(coalesce(p_query, ''))) between 2 and 200
    and m.deleted_at is null
    and to_tsvector('simple', coalesce(m.body, '')) @@ websearch_to_tsquery('simple', trim(p_query))
  order by m.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$function$;

revoke all on function public.search_messages(text, integer) from public, anon;
grant execute on function public.search_messages(text, integer) to authenticated;

create or replace function private.sync_message_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.body is not distinct from old.body then
      return new;
    end if;
    delete from public.message_mentions where message_id = new.id;
  end if;

  if new.body is not null and length(new.body) > 0 then
    insert into public.message_mentions (message_id, mentioned_user_id)
    select distinct new.id, p.id
    from regexp_matches(new.body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,24})', 'g') as match
    join public.profiles p on lower(p.username) = lower(match[1])
    join public.conversation_members cm
      on cm.conversation_id = new.conversation_id and cm.user_id = p.id
    where p.id <> new.sender_id
    on conflict (message_id, mentioned_user_id) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists sync_message_mentions on public.messages;
create trigger sync_message_mentions
after insert or update of body on public.messages
for each row execute function private.sync_message_mentions();

revoke all on function private.sync_message_mentions() from public, anon, authenticated;
