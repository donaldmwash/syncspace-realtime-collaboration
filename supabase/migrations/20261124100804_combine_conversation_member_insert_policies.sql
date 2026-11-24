drop policy if exists "Users join public conversations" on public.conversation_members;
drop policy if exists "Authorized users add conversation members" on public.conversation_members;
create policy "Authorized users add conversation members"
on public.conversation_members
for insert
to authenticated
with check (
  (
    (user_id = (select auth.uid()) and private.is_conversation_creator(conversation_id))
    or private.is_conversation_admin(conversation_id)
  )
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_members.conversation_id
        and c.is_private = false
    )
  )
);
