-- ===========================================================================
-- Callio V2 — socle multi-tenant
--
-- MIGRATION LOCALE. Non appliquee a la base distante a ce stade.
--
-- Proprietes de cette migration :
--   * additive uniquement — aucun DROP TABLE, aucun DROP COLUMN, aucun DELETE
--   * idempotente — rejouable sans effet de bord (IF NOT EXISTS partout)
--   * protegee — elle s'interrompt avec un message explicite si une table
--     `calls` preexistante et incompatible est detectee (voir le garde-fou
--     ci-dessous et la migration 0002 pour le chemin progressif)
--
-- Regle d'autorisation structurante :
--   l'appartenance et le role proviennent EXCLUSIVEMENT de la table
--   `company_members`. Jamais de `auth.jwt()`, jamais de `raw_user_meta_data`,
--   jamais de `app_metadata` — ces sources sont modifiables cote client ou via
--   un jeton et ne peuvent pas servir d'autorite.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Garde-fou : table `calls` preexistante
--
-- Si une table `public.calls` existe deja sans colonne `company_id`, elle
-- appartient a l'ancien systeme. On ne la touche pas et on interrompt ici
-- plutot que de creer un schema ambigu. Le chemin de reprise est decrit dans
-- 0002_legacy_calls_bridge.sql.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'calls'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calls'
      and column_name = 'company_id'
  ) then
    raise exception using
      errcode = 'raise_exception',
      message = 'Une table public.calls preexistante et sans company_id a ete detectee.',
      detail  = 'Cette migration n''ecrase jamais une table existante.',
      hint    = 'Appliquer d''abord supabase/migrations/0002_legacy_calls_bridge.sql, qui renomme la table historique en calls_legacy_v1 sans perte de donnees et cree une vue de compatibilite, puis rejouer 0001.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,63}$'),
  vertical    text not null default 'hvac' check (vertical in ('hvac')),
  status      text not null default 'active' check (status in ('active','suspended')),
  timezone    text not null default 'Europe/Paris',
  -- Createur, conserve pour tracabilite. N'accorde aucun droit par lui-meme :
  -- les droits passent par company_members.
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- company_members — la seule source d'autorite sur l'appartenance et le role
-- ---------------------------------------------------------------------------
create table if not exists public.company_members (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner','admin','member')),
  display_name text not null default '',
  created_at   timestamptz not null default now(),
  -- Un utilisateur a au plus un role par entreprise, et peut appartenir a
  -- plusieurs entreprises : le multi-appartenance est natif.
  unique (company_id, user_id)
);

create index if not exists company_members_user_idx
  on public.company_members (user_id);

-- ---------------------------------------------------------------------------
-- Fonctions d'autorisation
--
-- SECURITY DEFINER : elles lisent company_members en contournant la RLS, ce
-- qui evite la recursion infinie d'une policy sur company_members qui
-- interrogerait company_members. `search_path` est fige pour empecher toute
-- resolution de nom detournee.
-- ---------------------------------------------------------------------------
create or replace function public.callio_is_member(target_company uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target_company
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.callio_role_in(target_company uuid)
returns text
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select m.role from public.company_members m
  where m.company_id = target_company
    and m.user_id = auth.uid()
  limit 1;
$$;

/* Vrai si l'utilisateur courant est owner ou admin de l'entreprise visee. */
create or replace function public.callio_can_manage(target_company uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.callio_role_in(target_company) in ('owner','admin');
$$;

revoke all on function public.callio_is_member(uuid) from public;
revoke all on function public.callio_role_in(uuid) from public;
revoke all on function public.callio_can_manage(uuid) from public;
grant execute on function public.callio_is_member(uuid) to authenticated;
grant execute on function public.callio_role_in(uuid) to authenticated;
grant execute on function public.callio_can_manage(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  full_name        text not null default '',
  phone            text not null,
  email            text,
  postal_code      text,
  city             text,
  request_type     text not null default 'other'
                     check (request_type in ('installation_pac','installation_clim','maintenance','repair','other')),
  source           text not null
                     check (source in ('quote_form','missed_call','manual')),
  status           text not null default 'new'
                     check (status in ('new','contacting','qualified','appointment_set','transferred','unreachable','rejected')),
  urgency          text not null default 'normal'
                     check (urgency in ('low','normal','high','critical')),
  next_action      text,
  next_action_at   timestamptz,
  notes            text,
  -- Premiere prise en charge effective, base du delai moyen du tableau de bord.
  first_handled_at timestamptz,
  -- Cle de deduplication fournie par la source (idempotence des webhooks).
  external_ref     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists leads_company_created_idx
  on public.leads (company_id, created_at desc);
create index if not exists leads_company_status_idx
  on public.leads (company_id, status);

-- Idempotence : une meme reference externe ne cree qu'un prospect par entreprise.
create unique index if not exists leads_company_external_ref_idx
  on public.leads (company_id, external_ref)
  where external_ref is not null;

-- ---------------------------------------------------------------------------
-- lead_consents — preuve de consentement, en ecriture seule
-- ---------------------------------------------------------------------------
create table if not exists public.lead_consents (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  lead_id         uuid not null references public.leads (id) on delete cascade,
  channel         text not null check (channel in ('phone','sms','email')),
  granted         boolean not null,
  -- Texte exact presente a la personne au moment du recueil.
  statement_shown text not null,
  -- Origine technique : URL du formulaire, identifiant d'appel, etc.
  evidence_source text not null default '',
  collected_at    timestamptz not null default now()
);

create index if not exists lead_consents_lead_idx
  on public.lead_consents (company_id, lead_id, collected_at desc);

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------
create table if not exists public.calls (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  lead_id          uuid references public.leads (id) on delete set null,
  direction        text not null check (direction in ('inbound','outbound')),
  started_at       timestamptz not null default now(),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  outcome          text not null
                     check (outcome in ('qualified','appointment_set','transferred_to_human','no_answer','voicemail','rejected','failed')),
  urgency          text not null default 'normal'
                     check (urgency in ('low','normal','high','critical')),
  summary          text,
  -- Identifiant chez le fournisseur de voix : reconciliation et idempotence.
  provider_call_id text,
  created_at       timestamptz not null default now()
);

create index if not exists calls_company_started_idx
  on public.calls (company_id, started_at desc);
create index if not exists calls_lead_idx
  on public.calls (company_id, lead_id);

create unique index if not exists calls_provider_call_id_idx
  on public.calls (provider_call_id)
  where provider_call_id is not null;

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  lead_id            uuid not null references public.leads (id) on delete cascade,
  service            text not null default '',
  assignee_member_id uuid references public.company_members (id) on delete set null,
  scheduled_at       timestamptz not null,
  duration_minutes   integer not null default 60 check (duration_minutes > 0),
  status             text not null default 'proposed'
                       check (status in ('proposed','confirmed','completed','cancelled','no_show')),
  -- Identifiant de l'evenement chez le fournisseur d'agenda.
  external_event_id  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists appointments_company_scheduled_idx
  on public.appointments (company_id, scheduled_at desc);

-- ---------------------------------------------------------------------------
-- agent_settings — une ligne par entreprise
-- ---------------------------------------------------------------------------
create table if not exists public.agent_settings (
  company_id               uuid primary key references public.companies (id) on delete cascade,
  enabled                  boolean not null default false,
  agent_display_name       text not null default 'Callio',
  services                 jsonb not null default '[]'::jsonb,
  service_area_postal_codes jsonb not null default '[]'::jsonb,
  business_hours           jsonb not null default '[]'::jsonb,
  transfer_phone           text,
  transfer_on_urgency      jsonb not null default '["critical"]'::jsonb,
  transfer_outside_hours   boolean not null default true,
  qualification_questions  jsonb not null default '[]'::jsonb,
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- integrations
--
-- Cette table ne contient AUCUN secret : uniquement l'etat de la connexion.
-- Les identifiants des fournisseurs sont stockes hors de portee du navigateur
-- (Vault Supabase ou variables serveur) et ne sont jamais exposes par
-- PostgREST.
-- ---------------------------------------------------------------------------
create table if not exists public.integrations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  kind           text not null check (kind in ('voice','calendar','sms')),
  provider       text not null,
  status         text not null default 'not_configured'
                   check (status in ('not_configured','connected','error')),
  status_message text,
  connected_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_id, kind, provider)
);

-- ---------------------------------------------------------------------------
-- Horodatage de modification
-- ---------------------------------------------------------------------------
create or replace function public.callio_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['companies','leads','appointments','agent_settings','integrations']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function public.callio_touch_updated_at()',
      t || '_touch_updated_at', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Amorcage : le createur d'une entreprise en devient proprietaire
--
-- SECURITY DEFINER pour contourner la policy d'insertion de company_members,
-- qui exige d'etre deja owner/admin. Sans ce declencheur, aucune entreprise ne
-- pourrait jamais avoir son premier membre.
-- ---------------------------------------------------------------------------
create or replace function public.callio_add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is not null then
    insert into public.company_members (company_id, user_id, role, display_name)
    values (new.id, new.created_by, 'owner', '')
    on conflict (company_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_add_creator_as_owner on public.companies;
create trigger companies_add_creator_as_owner
  after insert on public.companies
  for each row execute function public.callio_add_creator_as_owner();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.companies       enable row level security;
alter table public.company_members enable row level security;
alter table public.leads           enable row level security;
alter table public.lead_consents   enable row level security;
alter table public.calls           enable row level security;
alter table public.appointments    enable row level security;
alter table public.agent_settings  enable row level security;
alter table public.integrations    enable row level security;

-- --- companies -------------------------------------------------------------
-- Un utilisateur ne voit que les entreprises dont il est membre.
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (public.callio_is_member(id));

-- Creer une entreprise est permis a tout compte authentifie ; le declencheur
-- ci-dessus en fait immediatement le proprietaire. `created_by` doit designer
-- l'appelant : impossible de creer une entreprise au nom d'un tiers.
drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (public.callio_can_manage(id))
  with check (public.callio_can_manage(id));

-- Aucune policy DELETE : la suppression d'une entreprise n'est pas une
-- operation d'interface. Elle passe par une procedure administree.

-- --- company_members -------------------------------------------------------
-- Visible : les membres des entreprises auxquelles on appartient.
drop policy if exists company_members_select on public.company_members;
create policy company_members_select on public.company_members
  for select to authenticated
  using (public.callio_is_member(company_id));

-- Point de securite central : seul un owner/admin de CETTE entreprise peut y
-- ajouter quelqu'un. Un utilisateur qui n'est membre de rien obtient un role
-- nul, donc faux : il ne peut pas s'auto-rattacher a une entreprise tierce.
drop policy if exists company_members_insert on public.company_members;
create policy company_members_insert on public.company_members
  for insert to authenticated
  with check (public.callio_can_manage(company_id));

drop policy if exists company_members_update on public.company_members;
create policy company_members_update on public.company_members
  for update to authenticated
  using (public.callio_can_manage(company_id))
  with check (public.callio_can_manage(company_id));

drop policy if exists company_members_delete on public.company_members;
create policy company_members_delete on public.company_members
  for delete to authenticated
  using (public.callio_can_manage(company_id));

-- --- tables metier ---------------------------------------------------------
-- Meme regle partout : appartenance a l'entreprise portee par company_id.
-- Le WITH CHECK empeche de deplacer une ligne vers une autre entreprise.
do $$
declare
  t text;
begin
  foreach t in array array['leads','calls','appointments','integrations']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
       using (public.callio_is_member(company_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
       with check (public.callio_is_member(company_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
       using (public.callio_is_member(company_id))
       with check (public.callio_is_member(company_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
       using (public.callio_can_manage(company_id))',
      t || '_delete', t);
  end loop;
end
$$;

-- --- lead_consents ---------------------------------------------------------
-- Une preuve se lit et se depose, elle ne se retouche pas : ni UPDATE ni
-- DELETE ne sont exposes.
drop policy if exists lead_consents_select on public.lead_consents;
create policy lead_consents_select on public.lead_consents
  for select to authenticated
  using (public.callio_is_member(company_id));

drop policy if exists lead_consents_insert on public.lead_consents;
create policy lead_consents_insert on public.lead_consents
  for insert to authenticated
  with check (public.callio_is_member(company_id));

-- --- agent_settings --------------------------------------------------------
-- Lecture par tout membre, ecriture reservee a owner/admin.
drop policy if exists agent_settings_select on public.agent_settings;
create policy agent_settings_select on public.agent_settings
  for select to authenticated
  using (public.callio_is_member(company_id));

drop policy if exists agent_settings_insert on public.agent_settings;
create policy agent_settings_insert on public.agent_settings
  for insert to authenticated
  with check (public.callio_can_manage(company_id));

drop policy if exists agent_settings_update on public.agent_settings;
create policy agent_settings_update on public.agent_settings
  for update to authenticated
  using (public.callio_can_manage(company_id))
  with check (public.callio_can_manage(company_id));

-- ---------------------------------------------------------------------------
-- Le role anon n'a acces a rien : l'application privee exige une session.
-- L'ingestion publique des formulaires passera par un endpoint serveur dedie,
-- jamais par PostgREST en anonyme.
-- ---------------------------------------------------------------------------
revoke all on public.companies       from anon;
revoke all on public.company_members from anon;
revoke all on public.leads           from anon;
revoke all on public.lead_consents   from anon;
revoke all on public.calls           from anon;
revoke all on public.appointments    from anon;
revoke all on public.agent_settings  from anon;
revoke all on public.integrations    from anon;
