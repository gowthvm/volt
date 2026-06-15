alter table public.projects
  add column if not exists share_token text unique,
  add column if not exists is_public boolean not null default false;

create index if not exists idx_projects_share_token on public.projects(share_token);

-- public read-only access by share_token
create policy "Anyone can view shared projects"
  on public.projects for select
  using (is_public = true);
