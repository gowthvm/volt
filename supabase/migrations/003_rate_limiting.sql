-- Rate limiting: enforce max 60 writes per minute per user on projects
create extension if not exists pgcrypto;

create or replace function public.check_project_write_rate()
returns trigger as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.projects
  where user_id = auth.uid()
    and updated_at > now() - interval '1 minute';
  if recent_count > 60 then
    raise exception 'rate_limit_exceeded: max 60 writes per minute';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_projects_write_rate on public.projects;
create trigger trg_projects_write_rate
  before insert or update on public.projects
  for each row
  execute function public.check_project_write_rate();

-- Restrict anon key to only needed operations by revoking unnecessary perms
revoke all on schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Grant exactly what the app needs
grant select on public.projects to anon, authenticated;
grant insert (user_id, name, schematic_json) on public.projects to authenticated;
grant update (name, schematic_json, share_token, is_public, updated_at) on public.projects to authenticated;
grant delete on public.projects to authenticated;
