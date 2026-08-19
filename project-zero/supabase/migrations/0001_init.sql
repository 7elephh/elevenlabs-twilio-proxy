-- PROJECT ZERO — initial schema
-- Football Development System, V0.1
--
-- Conventions:
--   * every user-owned row carries user_id and is protected by RLS
--   * measurement_type / reliability_level / improvement_direction are stored
--     explicitly so the UI can never present a subjective value as a hard one
--   * is_demo marks seeded data so it can be wiped in one statement

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users (id) on delete cascade,
  display_name        text not null default 'Player',
  primary_position    text not null default 'RB'
                        check (primary_position in ('GK','CB','RB','LB','RWB','LWB','DM','CM','AM','RW','LW','ST')),
  secondary_positions text[] not null default '{}',
  preferred_role      text not null default 'GENERALIST'
                        check (preferred_role in ('DEFENSIVE_FULLBACK','ATTACKING_FULLBACK','COMPLETE_FULLBACK','INVERTED_FULLBACK','WINGBACK','GENERALIST')),
  -- Date of the ZERO BASELINE test battery. Null until the first test is logged.
  baseline_date       date,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- test_protocols (reference data, mirrored from src/lib/domain/protocols.ts)
-- ---------------------------------------------------------------------------
create table if not exists public.test_protocols (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null,
  description           text not null default '',
  category              text not null check (category in ('TECHNICAL','PHYSICAL','POSITIONAL')),
  position_relevance    jsonb not null default '{}'::jsonb,
  instructions          jsonb not null default '[]'::jsonb,
  equipment             jsonb not null default '[]'::jsonb,
  attempts              integer not null default 1 check (attempts > 0),
  rest_seconds          integer not null default 0 check (rest_seconds >= 0),
  unit                  text not null,
  measurement_type      text not null check (measurement_type in ('OBJECTIVE','SEMI_OBJECTIVE','SUBJECTIVE')),
  improvement_direction text not null check (improvement_direction in ('HIGHER_IS_BETTER','LOWER_IS_BETTER')),
  default_reliability   text not null check (default_reliability in ('HIGH','MEDIUM','LOW')),
  -- Bumped when a protocol change breaks comparability with older results.
  protocol_version      integer not null default 1,
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- training_sessions — the 15-second entry
-- ---------------------------------------------------------------------------
create table if not exists public.training_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  date             date not null,
  session_type     text not null check (session_type in ('INDIVIDUAL','TEAM_TRAINING','MATCH','PHYSICAL')),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 600),
  position         text check (position in ('GK','CB','RB','LB','RWB','LWB','DM','CM','AM','RW','LW','ST')),
  rpe              integer check (rpe between 1 and 10),
  notes            text,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists training_sessions_user_date_idx
  on public.training_sessions (user_id, date desc);

-- ---------------------------------------------------------------------------
-- test_results
-- ---------------------------------------------------------------------------
create table if not exists public.test_results (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  protocol_slug      text not null references public.test_protocols (slug) on update cascade,
  -- Version of the protocol in force when the test was run.
  protocol_version   integer not null default 1,
  performed_at       date not null,
  value              numeric not null,
  attempts           jsonb not null default '[]'::jsonb,
  detail             jsonb not null default '{}'::jsonb,
  -- Set when a protocol has non-comparable variants (e.g. run distance).
  variant            text,
  measurement_method text not null check (measurement_method in ('MANUAL_COUNT','PHONE_VIDEO','STOPWATCH','WEARABLE','OTHER')),
  reliability_level  text not null check (reliability_level in ('HIGH','MEDIUM','LOW')),
  conditions         text,
  notes              text,
  is_baseline        boolean not null default false,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists test_results_user_metric_idx
  on public.test_results (user_id, protocol_slug, variant, performed_at);

-- One ZERO BASELINE per metric.
create unique index if not exists test_results_single_baseline_idx
  on public.test_results (user_id, protocol_slug, coalesce(variant, ''))
  where is_baseline;

-- ---------------------------------------------------------------------------
-- checkpoints
-- ---------------------------------------------------------------------------
create table if not exists public.checkpoints (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users (id) on delete cascade,
  date                       date not null,
  kind                       text not null check (kind in ('SIMPLE','FULL')),
  sessions_since_previous    integer not null default 0,
  training_hours_since_previous numeric not null default 0,
  matches_since_previous     integer not null default 0,
  -- Computed per-metric snapshot (baseline / previous / latest / best / trend).
  metrics                    jsonb not null default '[]'::jsonb,
  notes                      text,
  is_demo                    boolean not null default false,
  created_at                 timestamptz not null default now()
);

create index if not exists checkpoints_user_date_idx
  on public.checkpoints (user_id, date desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.training_sessions enable row level security;
alter table public.test_results      enable row level security;
alter table public.checkpoints       enable row level security;
alter table public.test_protocols    enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['profiles','training_sessions','test_results','checkpoints']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      t || '_delete_own', t);
  end loop;
end
$$;

-- Protocols are shared reference data: readable by any signed-in user,
-- writable only through migrations / the service role.
drop policy if exists test_protocols_read on public.test_protocols;
create policy test_protocols_read
  on public.test_protocols for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- A profile row is created automatically for every new auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Player'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
