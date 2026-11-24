revoke all on function public.get_moderation_queue(integer) from public, anon;
revoke all on function public.review_user_report(uuid,text,text,text) from public, anon;
grant execute on function public.get_moderation_queue(integer) to authenticated;
grant execute on function public.review_user_report(uuid,text,text,text) to authenticated;