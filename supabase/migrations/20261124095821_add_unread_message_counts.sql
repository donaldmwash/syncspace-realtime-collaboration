create or replace function public.get_unread_counts()
returns table (conversation_id uuid, unread_count bigint)
language sql
stable
security invoker
set search_path = ''
as $function$
  select m.conversation_id, count(*)::bigint
  from public.messages m
  left join public.message_receipts r
    on r.message_id = m.id
   and r.user_id = (select auth.uid())
  where (select auth.uid()) is not null
    and m.sender_id <> (select auth.uid())
    and m.deleted_at is null
    and (m.expires_at is null or m.expires_at > now())
    and r.read_at is null
  group by m.conversation_id;
$function$;
revoke all on function public.get_unread_counts() from public, anon;
grant execute on function public.get_unread_counts() to authenticated;
