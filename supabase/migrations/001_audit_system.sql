create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  invited_by text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  headline text not null,
  author_url text,
  excerpt text,
  article_key text not null,
  status text not null check (status in ('success', 'failure')),
  reason text not null,
  url_count integer not null default 0,
  word_count integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_inr numeric(12, 4) not null default 0,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.audit_runs(id) on delete set null,
  user_email text not null,
  feedback text not null,
  expected text,
  status text not null default 'pending_admin_review' check (
    status in ('pending_admin_review', 'approved_for_training', 'rejected')
  ),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  role text not null check (role in ('admin', 'user')),
  activity_type text not null,
  created_at timestamptz not null default now()
);

insert into public.app_users (email, role, status)
values ('chandan.kumar@indianexpress.com', 'admin', 'active')
on conflict (email) do update set role = 'admin', status = 'active';

alter table public.app_users enable row level security;
alter table public.audit_runs enable row level security;
alter table public.feedback_reports enable row level security;
alter table public.user_activity enable row level security;

create or replace function public.current_app_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.app_users
  where auth_user_id = auth.uid()
    and status = 'active'
  limit 1
$$;

drop policy if exists "users can read active app users" on public.app_users;
create policy "users can read active app users"
on public.app_users for select
to authenticated
using (status = 'active');

drop policy if exists "admins can manage app users" on public.app_users;
create policy "admins can manage app users"
on public.app_users for all
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "authenticated users can read audit runs" on public.audit_runs;
create policy "authenticated users can read audit runs"
on public.audit_runs for select
to authenticated
using (true);

drop policy if exists "admins can delete audit runs" on public.audit_runs;
create policy "admins can delete audit runs"
on public.audit_runs for delete
to authenticated
using (public.current_app_role() = 'admin');

drop policy if exists "authenticated users can read feedback" on public.feedback_reports;
create policy "authenticated users can read feedback"
on public.feedback_reports for select
to authenticated
using (public.current_app_role() = 'admin' or user_email = auth.jwt() ->> 'email');

drop policy if exists "admins can update feedback" on public.feedback_reports;
create policy "admins can update feedback"
on public.feedback_reports for update
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

drop policy if exists "admins can read activity" on public.user_activity;
create policy "admins can read activity"
on public.user_activity for select
to authenticated
using (public.current_app_role() = 'admin');

create index if not exists audit_runs_created_at_idx on public.audit_runs (created_at desc);
create index if not exists audit_runs_article_key_idx on public.audit_runs (article_key);
create index if not exists user_activity_created_at_idx on public.user_activity (created_at desc);
