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
