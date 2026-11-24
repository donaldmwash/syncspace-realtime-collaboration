alter table public.conversations
  add column if not exists allow_member_invites boolean not null default false,
  add column if not exists allow_member_pins boolean not null default false,
  add column if not exists allow_member_topics boolean not null default false,
  add column if not exists allow_member_polls boolean not null default true,
  add column if not exists allow_member_media boolean not null default true;

alter table public.user_reports
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists moderator_note text,
  add column if not exists severity text not null default 'normal'
    check (severity in ('low','normal','high','critical'));

create index if not exists user_reports_status_created_idx
  on public.user_reports(status, created_at desc);

create or replace function public.get_moderation_queue(p_limit integer default 50)
returns table (
  id uuid, reporter_id uuid, reported_user_id uuid, message_id uuid,
  reason text, status text, severity text, moderator_note text,
  created_at timestamptz, reviewed_at timestamptz,
  conversation_id uuid, conversation_title text,
  reporter_name text, reported_name text, message_body text
)
language sql stable security invoker set search_path = ''
as $$
  select r.id, r.reporter_id, r.reported_user_id, r.message_id,
         r.reason, r.status, r.severity, r.moderator_note,
         r.created_at, r.reviewed_at, c.id, c.title,
         rp.display_name, tp.display_name, m.body
  from public.user_reports r
  left join public.messages m on m.id = r.message_id
  left join public.conversations c on c.id = m.conversation_id
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles tp on tp.id = r.reported_user_id
  where r.message_id is not null and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = c.id and cm.user_id = (select auth.uid())
      and cm.role in ('owner','admin','moderator')
  )
  order by case r.severity when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
           r.created_at desc
  limit greatest(1, least(coalesce(p_limit,50),100));
$$;

create or replace function public.review_user_report(
  p_report_id uuid, p_status text, p_severity text default null, p_note text default null
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare v_conversation_id uuid;
begin
  if p_status not in ('open','investigating','resolved','dismissed') then raise exception 'Invalid report status'; end if;
  if p_severity is not null and p_severity not in ('low','normal','high','critical') then raise exception 'Invalid report severity'; end if;
  select m.conversation_id into v_conversation_id from public.user_reports r
    join public.messages m on m.id=r.message_id where r.id=p_report_id;
  if v_conversation_id is null or not exists (
    select 1 from public.conversation_members cm where cm.conversation_id=v_conversation_id
      and cm.user_id=(select auth.uid()) and cm.role in ('owner','admin','moderator')
  ) then raise exception 'You are not authorised to review this report'; end if;
  update public.user_reports set status=p_status, severity=coalesce(p_severity,severity),
    moderator_note=case when p_note is null then moderator_note else left(p_note,2000) end,
    reviewed_by=(select auth.uid()), reviewed_at=now() where id=p_report_id;
  return found;
end;
$$;
grant execute on function public.get_moderation_queue(integer) to authenticated;
grant execute on function public.review_user_report(uuid,text,text,text) to authenticated;