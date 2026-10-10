-- Portal v2: contract details, a client-editable additional contact, project phases and milestones, shared links
-- and documents (private storage), and full admin management of clients and projects.
--
-- Access model, in one paragraph:
--   * The admin (app_metadata.role = 'admin', see 20261009000000_admin.sql) can read and write everything below.
--   * A client reads only their own rows, and only projects that are not "not_started".
--   * A client can change exactly one thing from the browser: clients.extra_contact on their own row. A trigger
--     enforces that, because a column grant alone would be shared by every signed-in user.
--   * Files live in the private "client-files" bucket under <client_id>/. A client can read an object only if a
--     visible client_files row points at it. The browser never gets a public URL: it asks for a short-lived signed one.
--
-- Apply after 20261009000000_admin.sql. Create the bucket here (below), then in the dashboard confirm
-- Storage > client-files is Private.

/* ── helpers ──────────────────────────────────────────────────────── */

-- The signed-in client's id (null for anyone without an active client row). security definer so a policy on one
-- table can look at clients without recursing through that table's own policies.
create function public.my_client_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.clients
  where email = lower(coalesce(auth.jwt() ->> 'email', '')) and not disabled
  limit 1
$$;
revoke all on function public.my_client_id() from public;
grant execute on function public.my_client_id() to authenticated, service_role;

-- Shape check for the one field a client may write.
create function public.valid_extra_contact(j jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select j is null or (
    jsonb_typeof(j) = 'object'
    and not exists (select 1 from jsonb_object_keys(j) k where k not in ('name', 'email', 'phone', 'note'))
    and coalesce(length(j ->> 'name'), 0) <= 120
    and coalesce(length(j ->> 'phone'), 0) <= 40
    and coalesce(length(j ->> 'note'), 0) <= 300
    and coalesce(length(j ->> 'email'), 0) <= 254
    and (j ->> 'email' is null or j ->> 'email' = '' or j ->> 'email' ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  )
$$;

/* ── clients: contract fields and the additional contact ──────────── */

alter table public.clients
  add column plan text check (plan is null or length(plan) <= 120),
  add column start_date date,
  add column agreed_price numeric(12, 2) check (agreed_price is null or agreed_price >= 0),
  add column billing_terms text check (billing_terms is null or length(billing_terms) <= 1000),
  add column contract_url text check (contract_url is null or contract_url ~ '^https://'),
  add column contract_status text not null default 'draft' check (contract_status in ('draft', 'active', 'completed', 'cancelled')),
  add column extra_contact jsonb check (public.valid_extra_contact(extra_contact));

-- Table-level write grants, narrowed by policies and by the guard trigger below.
grant insert, update, delete on public.clients to authenticated;

create policy clients_admin_insert on public.clients
  for insert to authenticated with check (public.is_admin());

create policy clients_admin_update on public.clients
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy clients_admin_delete on public.clients
  for delete to authenticated using (public.is_admin());

create policy clients_update_own on public.clients
  for update to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')) and not disabled)
  with check (email = lower(coalesce(auth.jwt() ->> 'email', '')) and not disabled);

-- A signed-in non-admin may only change extra_contact. Every other column (and the row's email) must stay as it was.
-- Only requests made as a signed-in user are checked: the Supabase table editor, the SQL editor and the service
-- role have no signed-in user, so they are not affected.
create function public.clients_guard_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'authenticated' and not public.is_admin() then
    if (to_jsonb(new) - 'extra_contact' - 'updated_at') is distinct from (to_jsonb(old) - 'extra_contact' - 'updated_at') then
      raise exception 'only the additional contact can be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

-- Named so it fires before clients_touch (triggers run in name order).
create trigger clients_guard before update on public.clients
  for each row execute function public.clients_guard_update();

/* ── projects: admin can create, edit and delete ──────────────────── */

-- Clients have no write policy on projects, so a table-level grant is safe: RLS still blocks everyone but the admin.
grant insert, update, delete on public.projects to authenticated;

create policy projects_admin_insert on public.projects
  for insert to authenticated with check (public.is_admin());

create policy projects_admin_delete on public.projects
  for delete to authenticated using (public.is_admin());

/* ── phases and milestones ────────────────────────────────────────── */

create type public.project_phase as enum ('discovery', 'design', 'build', 'review', 'launch');
create type public.work_state as enum ('todo', 'in_progress', 'done');

create table public.project_phases (
  project_id uuid not null references public.projects (id) on delete cascade,
  phase public.project_phase not null,
  state public.work_state not null default 'todo',
  updated_at timestamptz not null default now(),
  primary key (project_id, phase)
);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  phase public.project_phase not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  state public.work_state not null default 'todo',
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_milestones_project_idx on public.project_milestones (project_id, phase, position);

create trigger project_phases_touch before update on public.project_phases
  for each row execute function public.touch_updated_at();
create trigger project_milestones_touch before update on public.project_milestones
  for each row execute function public.touch_updated_at();

-- Every project starts with the five phases.
create function public.projects_seed_phases() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.project_phases (project_id, phase)
  select new.id, p from unnest(enum_range(null::public.project_phase)) as p
  on conflict do nothing;
  return new;
end $$;

create trigger projects_seed_phases after insert on public.projects
  for each row execute function public.projects_seed_phases();

-- Existing projects get their phases too.
insert into public.project_phases (project_id, phase)
select pr.id, p from public.projects pr cross join unnest(enum_range(null::public.project_phase)) as p
on conflict do nothing;

/* ── links and documents ──────────────────────────────────────────── */

create table public.client_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 160),
  url text not null check (url ~ '^https://' and length(url) <= 2000),
  note text check (note is null or length(note) <= 500),
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now()
);
create index client_links_client_idx on public.client_links (client_id, created_at desc);

create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 200),
  storage_path text not null unique check (storage_path like (client_id::text || '/%')),
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 26214400),
  content_type text,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now()
);
create index client_files_client_idx on public.client_files (client_id, created_at desc);

/* ── row-level security for the new tables ────────────────────────── */

alter table public.project_phases enable row level security;
alter table public.project_milestones enable row level security;
alter table public.client_links enable row level security;
alter table public.client_files enable row level security;

grant select on public.project_phases, public.project_milestones, public.client_links, public.client_files to authenticated;
grant insert, update, delete on public.project_phases, public.project_milestones, public.client_links, public.client_files to authenticated;
grant all on public.project_phases, public.project_milestones, public.client_links, public.client_files to service_role;

-- The sub-select on projects is itself filtered by projects' own policies, so a client only matches projects
-- they are allowed to see (their own, and not "not_started").
create policy phases_read_own on public.project_phases
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_phases.project_id));

create policy milestones_read_own on public.project_milestones
  for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_milestones.project_id));

create policy links_read_own on public.client_links
  for select to authenticated
  using (
    visible_to_client
    and client_id = public.my_client_id()
    and (project_id is null or exists (select 1 from public.projects p where p.id = client_links.project_id))
  );

create policy files_read_own on public.client_files
  for select to authenticated
  using (
    visible_to_client
    and client_id = public.my_client_id()
    and (project_id is null or exists (select 1 from public.projects p where p.id = client_files.project_id))
  );

create policy phases_admin_all on public.project_phases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy milestones_admin_all on public.project_milestones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy links_admin_all on public.client_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy files_admin_all on public.client_files
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

/* ── private storage bucket ───────────────────────────────────────── */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-files', 'client-files', false, 26214400,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/csv', 'text/markdown',
    'application/zip', 'application/json',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Admin: everything in the bucket.
create policy client_files_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'client-files' and public.is_admin())
  with check (bucket_id = 'client-files' and public.is_admin());

-- Client: read an object only when a visible client_files row of theirs points at it (so listing the bucket
-- or guessing a path returns nothing). Download goes through a signed URL, which needs this select policy.
create policy client_files_client_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-files'
    and exists (
      select 1 from public.client_files f
      where f.storage_path = storage.objects.name
        and f.visible_to_client
        and f.client_id = public.my_client_id()
    )
  );

/* ── how to check it by hand ──────────────────────────────────────────
   1. Sign in as a client (not the admin) in the portal. In the browser console, with a client from supabase-js:
        sb.from('clients').update({ name: 'x' }).eq('email', '<their email>')       -> error 42501 (guard trigger)
        sb.from('clients').update({ extra_contact: { name: 'Pat' } }).eq(...)        -> ok
        sb.from('clients').select('id')                                             -> only their own row
        sb.from('client_files').select('*')                                         -> only visible files of theirs
        sb.storage.from('client-files').list('<another client id>')                 -> empty
   2. As the admin: create a client and a project, confirm five project_phases rows appear, upload a file,
      then confirm the client sees it only once visible_to_client is true.
   ─────────────────────────────────────────────────────────────────── */
