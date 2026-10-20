-- LE KING BARBER — installation complète (à coller en une fois dans Supabase > SQL Editor > Run)

-- ===== migrations/0001_schema.sql =====
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

-- ===== migrations/0002_security.sql =====
-- Sécurité : Row Level Security et fonctions métier

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

alter table public.business_settings enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.blocked_periods enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.admin_users enable row level security;
alter table public.calendar_integrations enable row level security;
alter table public.gallery_images enable row level security;
alter table public.testimonials enable row level security;
alter table public.notification_log enable row level security;
alter table public.booking_attempts enable row level security;

-- Lecture publique des contenus du site
create policy settings_public_read on public.business_settings for select using (true);
create policy settings_admin_update on public.business_settings for update
  using (public.is_admin()) with check (public.is_admin());

create policy services_public_read on public.services for select using (is_active or public.is_admin());
create policy services_admin_write on public.services for all
  using (public.is_admin()) with check (public.is_admin());

create policy hours_public_read on public.business_hours for select using (true);
create policy hours_admin_write on public.business_hours for all
  using (public.is_admin()) with check (public.is_admin());

create policy gallery_public_read on public.gallery_images for select using (is_published or public.is_admin());
create policy gallery_admin_write on public.gallery_images for all
  using (public.is_admin()) with check (public.is_admin());

create policy testimonials_public_read on public.testimonials for select using (is_published or public.is_admin());
create policy testimonials_admin_write on public.testimonials for all
  using (public.is_admin()) with check (public.is_admin());

-- Données privées : administrateur uniquement
create policy blocked_admin_all on public.blocked_periods for all
  using (public.is_admin()) with check (public.is_admin());
create policy customers_admin_all on public.customers for all
  using (public.is_admin()) with check (public.is_admin());
create policy bookings_admin_all on public.bookings for all
  using (public.is_admin()) with check (public.is_admin());
create policy notifications_admin_read on public.notification_log for select using (public.is_admin());
create policy admin_users_self_read on public.admin_users for select using (user_id = auth.uid());
-- calendar_integrations et booking_attempts : aucune politique => accessibles
-- uniquement par le rôle service (serveur).

-- ---------------------------------------------------------------------------
-- Création d'une réservation (appelée par le serveur avec le rôle service)
-- Le contrôle des horaires d'ouverture est fait côté application juste avant ;
-- ici on sérialise les écritures et on garantit l'absence de conflit.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_service_id uuid,
  p_starts_at timestamptz,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_email text,
  p_customer_note text,
  p_source text,
  p_manage_token_hash text,
  p_ip_hash text default null,
  p_max_per_ip_hour int default 5
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_service public.services;
  v_settings public.business_settings;
  v_customer_id uuid;
  v_end timestamptz;
  v_active int;
  v_booking public.bookings;
  v_contact_email text;
begin
  perform pg_advisory_xact_lock(hashtext('lkb:bookings'));

  select * into v_settings from public.business_settings where id = 1;
  select * into v_service from public.services where id = p_service_id;
  if not found or v_service.duration_minutes is null
     or (p_source = 'online' and not v_service.is_active) then
    raise exception 'service_unavailable' using errcode = 'P0001';
  end if;

  if p_source = 'online' and not v_settings.booking_enabled then
    raise exception 'booking_disabled' using errcode = 'P0001';
  end if;

  v_end := p_starts_at + make_interval(mins => v_service.duration_minutes);

  if p_source = 'online' then
    if p_starts_at < now() + make_interval(mins => v_settings.min_notice_minutes) then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.blocked_periods b
      where tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, v_end, '[)')
    ) then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    end if;
    if p_ip_hash is not null then
      if (select count(*) from public.booking_attempts
          where ip_hash = p_ip_hash and created_at > now() - interval '1 hour') >= p_max_per_ip_hour then
        raise exception 'rate_limited' using errcode = 'P0001';
      end if;
      insert into public.booking_attempts (ip_hash) values (p_ip_hash);
    end if;
  end if;

  insert into public.customers (first_name, last_name, phone, email)
  values (p_first_name, p_last_name, p_phone, nullif(p_email, ''))
  on conflict (phone) do update
    -- En ligne, on ne remplace jamais l'identité d'un client existant :
    -- seul le salon (source admin) peut la corriger.
    set first_name = case when p_source = 'admin' then excluded.first_name else public.customers.first_name end,
        last_name = case when p_source = 'admin' then excluded.last_name else public.customers.last_name end,
        email = case when p_source = 'admin' then coalesce(excluded.email, public.customers.email)
                     else public.customers.email end,
        anonymized_at = null
  returning id into v_customer_id;

  -- En ligne : uniquement l'email saisi pour cette réservation.
  -- Par le salon : l'email saisi, sinon celui de la fiche client.
  if p_source = 'admin' then
    select coalesce(nullif(p_email, ''), email) into v_contact_email from public.customers where id = v_customer_id;
  else
    v_contact_email := nullif(p_email, '');
  end if;

  if p_source = 'online' then
    select count(*) into v_active from public.bookings
    where customer_id = v_customer_id and status = 'confirmed' and starts_at > now();
    if v_active >= v_settings.max_active_bookings_per_customer then
      raise exception 'too_many_bookings' using errcode = 'P0001';
    end if;
  end if;

  begin
    insert into public.bookings (
      customer_id, service_id, service_name, price_cents, duration_minutes,
      starts_at, ends_at, source, contact_email, customer_note, manage_token_hash
    ) values (
      v_customer_id, v_service.id, v_service.name, v_service.price_cents, v_service.duration_minutes,
      p_starts_at, v_end, p_source, v_contact_email, nullif(p_customer_note, ''), p_manage_token_hash
    ) returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
  end;

  return v_booking;
end $$;

revoke all on function public.create_booking(uuid, timestamptz, text, text, text, text, text, text, text, text, int) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, timestamptz, text, text, text, text, text, text, text, text, int) to service_role;

-- ---------------------------------------------------------------------------
-- RGPD : anonymisation
-- ---------------------------------------------------------------------------
create or replace function public._anonymize_customer(p_customer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.customers
     set first_name = 'Client', last_name = 'anonymisé', phone = 'anon-' || id::text,
         email = null, notes = null, anonymized_at = now()
   where id = p_customer_id;
  update public.bookings set customer_note = null, contact_email = null, manage_token_hash = null
   where customer_id = p_customer_id;
  update public.notification_log set recipient = null
   where booking_id in (select id from public.bookings where customer_id = p_customer_id);
end $$;
revoke all on function public._anonymize_customer(uuid) from public, anon, authenticated, service_role;

-- Droit à l'effacement : réservé à l'administrateur (ou au serveur)
create or replace function public.anonymize_customer(p_customer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public._anonymize_customer(p_customer_id);
end $$;
revoke all on function public.anonymize_customer(uuid) from public, anon;
grant execute on function public.anonymize_customer(uuid) to authenticated, service_role;

-- Purge périodique (appelée par la tâche planifiée quotidienne)
create or replace function public.purge_expired_personal_data() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_months int;
  v_count int := 0;
  r record;
begin
  select data_retention_months into v_months from public.business_settings where id = 1;
  delete from public.booking_attempts where created_at < now() - interval '1 day';
  for r in
    select c.id from public.customers c
    where c.anonymized_at is null
      and c.created_at < now() - make_interval(months => v_months)
      and not exists (
        select 1 from public.bookings b
        where b.customer_id = c.id and b.ends_at > now() - make_interval(months => v_months)
      )
  loop
    perform public._anonymize_customer(r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.purge_expired_personal_data() from public, anon, authenticated;
grant execute on function public.purge_expired_personal_data() to service_role;

-- ===== migrations/0003_storage.sql =====
-- Stockage des photos du site (bucket public en lecture, écriture admin)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy site_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin());
create policy site_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
create policy site_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());

-- ===== seed.demo.sql =====
-- DONNÉES DE DÉMONSTRATION — à remplacer depuis l'espace /admin avant une mise en service réelle.
-- Seul le tarif « Coupe + barbe : 20 € » provient du salon ; les autres valeurs
-- (durées, prestations, horaires) sont des exemples destinés à la présentation.

insert into public.services (name, description, price_cents, duration_minutes, is_active, sort_order) values
  ('Coupe + barbe', 'Coupe sur mesure et taille de barbe précise, finitions soignées.', 2000, 45, true, 1),
  ('Coupe', 'Coupe aux ciseaux ou à la tondeuse, adaptée à votre style.', 1500, 30, true, 2),
  ('Taille de barbe', 'Mise en forme, contours nets et soin.', 1000, 20, true, 3);

-- Mardi à samedi, 9h30–12h30 puis 14h–19h (pause déjeuner)
insert into public.business_hours (weekday, opens_at, closes_at)
select d, t.o::time, t.c::time
from generate_series(2, 6) d
cross join (values ('09:30', '12:30'), ('14:00', '19:00')) as t(o, c);

update public.business_settings set
  hero_subtitle = 'Coupe, barbe et soin dans un salon pensé pour l''homme moderne.',
  about_title = 'Une maison de grooming',
  about_text = 'Chez Le King Barber, chaque rendez-vous est un moment pour soi. Un diagnostic attentif, des gestes précis et des finitions nettes : le style se construit avec méthode, sans précipitation.',
  experience_text = 'Accueil, conseil, coupe et finitions : une expérience calme et maîtrisée, du premier échange au dernier détail.'
where id = 1;
