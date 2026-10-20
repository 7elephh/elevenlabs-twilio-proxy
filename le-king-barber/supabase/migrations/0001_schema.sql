-- LE KING BARBER — schéma principal
-- Source de vérité des réservations. Google Calendar n'est qu'une copie secondaire.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Réglages du salon (ligne unique)
-- ---------------------------------------------------------------------------
create table public.business_settings (
  id smallint primary key default 1 check (id = 1),
  salon_name text not null default 'Le King Barber',
  hero_title text not null default 'L''art de soigner son style.',
  hero_subtitle text,
  hero_image_path text,
  about_title text,
  about_text text,
  experience_text text,
  barber_name text,
  barber_bio text,
  barber_photo_path text,
  address_line text,
  postal_code text,
  city text,
  phone text,
  email text,
  instagram_url text,
  google_maps_url text,
  google_reviews_url text,
  timezone text not null default 'Europe/Paris',
  slot_interval_minutes int not null default 15 check (slot_interval_minutes between 5 and 120),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 60),
  min_notice_minutes int not null default 60 check (min_notice_minutes between 0 and 10080),
  max_advance_days int not null default 60 check (max_advance_days between 1 and 365),
  cancellation_notice_minutes int not null default 120 check (cancellation_notice_minutes between 0 and 10080),
  max_active_bookings_per_customer int not null default 2 check (max_active_bookings_per_customer between 1 and 20),
  booking_enabled boolean not null default true,
  data_retention_months int not null default 36 check (data_retention_months between 1 and 120),
  legal_name text,
  legal_form text,
  siret text,
  legal_address text,
  publication_director text,
  hosting_provider text default 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis',
  updated_at timestamptz not null default now()
);

insert into public.business_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Prestations
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  price_cents int not null check (price_cents between 0 and 100000),
  duration_minutes int check (duration_minutes between 5 and 480),
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Une prestation sans durée ne peut pas être proposée à la réservation.
  constraint services_active_needs_duration check (not is_active or duration_minutes is not null)
);

-- ---------------------------------------------------------------------------
-- Horaires hebdomadaires (plusieurs plages par jour = pauses)
-- weekday : 1 = lundi … 7 = dimanche (ISO 8601)
-- ---------------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  constraint business_hours_order check (closes_at > opens_at),
  constraint business_hours_no_overlap exclude using gist (
    weekday with =,
    tsrange(date '2000-01-01' + opens_at, date '2000-01-01' + closes_at, '[)') with &&
  )
);

-- ---------------------------------------------------------------------------
-- Congés, fermetures exceptionnelles, créneaux bloqués
-- ---------------------------------------------------------------------------
create table public.blocked_periods (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'block' check (kind in ('vacation', 'closure', 'block')),
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint blocked_periods_order check (ends_at > starts_at)
);
create index blocked_periods_range_idx on public.blocked_periods using gist (tstzrange(starts_at, ends_at, '[)'));

-- ---------------------------------------------------------------------------
-- Clients (collecte minimale : prénom, nom, téléphone, email facultatif)
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  phone text not null unique,
  email text check (email is null or char_length(email) <= 254),
  notes text check (notes is null or char_length(notes) <= 1000),
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Réservations
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  -- Instantané de la prestation au moment de la réservation
  service_name text not null,
  price_cents int not null check (price_cents >= 0),
  duration_minutes int not null check (duration_minutes between 5 and 480),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  source text not null default 'online' check (source in ('online', 'admin')),
  -- Email fourni AVEC ce rendez-vous : seule adresse utilisée pour ses notifications.
  -- (Le téléphone n'étant pas vérifié, une réservation en ligne ne doit jamais
  -- modifier les coordonnées d'un client existant.)
  contact_email text check (contact_email is null or char_length(contact_email) <= 254),
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  manage_token_hash text unique,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by is null or cancelled_by in ('customer', 'admin')),
  reminder_sent_at timestamptz,
  google_event_id text,
  google_synced_at timestamptz,
  google_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_order check (ends_at > starts_at),
  -- Garantie ultime : deux rendez-vous non annulés ne peuvent jamais se chevaucher,
  -- y compris en cas de requêtes simultanées.
  constraint bookings_no_overlap exclude using gist (
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'cancelled')
);
create index bookings_starts_at_idx on public.bookings (starts_at);
create index bookings_customer_idx on public.bookings (customer_id);

-- ---------------------------------------------------------------------------
-- Administrateurs (liés à Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Intégrations calendrier (jetons chiffrés côté application, jamais exposés)
-- ---------------------------------------------------------------------------
create table public.calendar_integrations (
  provider text primary key check (provider in ('google')),
  account_email text,
  calendar_id text not null default 'primary',
  refresh_token_encrypted text not null,
  scopes text,
  import_busy boolean not null default false,
  last_error text,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Contenus du site
-- ---------------------------------------------------------------------------
create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  alt text not null check (char_length(alt) between 1 and 200),
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Avis clients : saisis par le salon à partir de témoignages réels uniquement.
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null check (char_length(author_name) between 1 and 80),
  content text not null check (char_length(content) between 1 and 800),
  rating smallint check (rating is null or rating between 1 and 5),
  source text check (source is null or char_length(source) <= 60),
  review_date date,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Journal des notifications et limitation des abus
-- ---------------------------------------------------------------------------
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  kind text not null check (kind in ('confirmation', 'barber_new', 'cancellation', 'update', 'reminder')),
  channel text not null default 'email',
  recipient text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index notification_log_booking_idx on public.notification_log (booking_id);

create table public.booking_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index booking_attempts_ip_idx on public.booking_attempts (ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.business_settings
  for each row execute function public.touch_updated_at();
create trigger calendar_touch before update on public.calendar_integrations
  for each row execute function public.touch_updated_at();
