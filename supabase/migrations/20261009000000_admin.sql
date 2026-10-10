-- Admin hub: lets the site owner (and only the owner) read every client, project and submission,
-- change a project's status, and keep private notes.
--
-- Who is an admin: a Supabase Auth user whose app_metadata contains {"role": "admin"}. app_metadata can only
-- be changed with the service role or from the dashboard, never by the user, so it is safe to trust in policies.
-- Give yourself the role once (SQL editor), then sign out and back in so the new token carries it:
--
--   update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
--   where email = 'you@example.com';
--
-- Every policy below is additive (permissive policies are OR-ed), so the client policies from the first
-- migration are untouched: a client still reads only their own rows.

create function public.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- Read everything, including disabled clients and projects that are not started yet.
create policy clients_admin_read on public.clients
  for select to authenticated
  using (public.is_admin());

create policy projects_admin_read on public.projects
  for select to authenticated
  using (public.is_admin());

-- Change a project's status (and nothing else) from the browser.
grant update (status) on public.projects to authenticated;

create policy projects_admin_update on public.projects
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Submissions: columns an admin needs, without the ip hash.
grant select (id, kind, name, email, phone, type, message, payload, status, created_at)
  on public.submissions to authenticated;

create policy submissions_admin_read on public.submissions
  for select to authenticated
  using (public.is_admin());

-- Private notes. A separate table on purpose: a notes column on projects would be readable by that
-- project's client through their own read policy.
create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  author_email text not null default lower(coalesce(auth.jwt() ->> 'email', '')),
  created_at timestamptz not null default now()
);
create index admin_notes_client_idx on public.admin_notes (client_id, created_at desc);

alter table public.admin_notes enable row level security;

grant select, insert, delete on public.admin_notes to authenticated;
grant all on public.admin_notes to service_role;

create policy admin_notes_read on public.admin_notes
  for select to authenticated using (public.is_admin());

create policy admin_notes_insert on public.admin_notes
  for insert to authenticated with check (public.is_admin());

create policy admin_notes_delete on public.admin_notes
  for delete to authenticated using (public.is_admin());
