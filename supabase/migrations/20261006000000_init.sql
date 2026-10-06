create extension if not exists pgcrypto;

create type public.project_status as enum ('not_started', 'in_progress', 'live', 'issue');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null,
  phone text,
  business text,
  it_support boolean not null default false,
  meeting_url text check (meeting_url is null or meeting_url ~ '^https://'),
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  description text,
  status public.project_status not null default 'not_started',
  live_url text check (live_url is null or live_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_client_id_idx on public.projects (client_id);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('contact', 'package')),
  name text,
  email text,
  phone text,
  type text,
  message text,
  payload jsonb,
  ip_hash text,
  status text not null default 'received',
  created_at timestamptz not null default now()
);
create index submissions_ip_recent_idx on public.submissions (ip_hash, created_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.submissions enable row level security;

-- Signed-in clients may read only their own record and their client-facing projects.
grant select on public.clients, public.projects to authenticated;
grant all on public.clients, public.projects, public.submissions to service_role;

create policy clients_read_own on public.clients
  for select to authenticated
  using (email = lower(auth.jwt() ->> 'email') and not disabled);

create policy projects_read_own on public.projects
  for select to authenticated
  using (
    status <> 'not_started'
    and exists (
      select 1 from public.clients c
      where c.id = projects.client_id
        and c.email = lower(auth.jwt() ->> 'email')
        and not c.disabled
    )
  );
-- submissions: RLS on, no policies, no grants to anon/authenticated (service role only).
