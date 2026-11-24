drop policy if exists "Members send messages as themselves" on public.messages;
create policy "Members send messages as themselves"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and private.is_conversation_member(conversation_id)
  and (
    not exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.type = 'channel'
    )
    or private.is_conversation_admin(conversation_id)
  )
  and (
    not exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.type = 'direct'
    )
    or not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = messages.conversation_id
        and cm.user_id <> (select auth.uid())
        and private.is_user_blocked((select auth.uid()), cm.user_id)
    )
  )
);

drop policy if exists "Users join public conversations" on public.conversation_members;
create policy "Users join public conversations"
on public.conversation_members
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_members.conversation_id
      and c.is_private = false
  )
);
