-- ===========================================================================
-- Callio V2 — reprise progressive d'une table `calls` historique
--
-- A N'APPLIQUER QUE SI la migration 0001 s'est interrompue en signalant une
-- table `public.calls` preexistante sans colonne `company_id`.
--
-- Ce fichier n'est PAS applique automatiquement et n'a pas ete execute sur la
-- base distante. Il decrit un chemin en trois temps, sans perte de donnees et
-- reversible a chaque etape.
--
-- Principe : on ne remplace pas la table historique, on la met de cote sous un
-- nom explicite et on laisse une vue a l'ancien emplacement, pour que
-- l'ancien systeme continue de lire et d'ecrire pendant la transition.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Etape 1 — mettre la table historique de cote
--
-- RENAME, pas DROP : les donnees et les index suivent la table, rien n'est
-- perdu, et l'operation s'annule par un rename inverse.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'calls' and table_type = 'BASE TABLE'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'calls' and column_name = 'company_id'
  ) then
    alter table public.calls rename to calls_legacy_v1;
    raise notice 'public.calls renommee en public.calls_legacy_v1 (aucune donnee supprimee).';
  else
    raise notice 'Aucune table calls historique a deplacer : etape 1 sans effet.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Etape 2 — rattacher les lignes historiques a une entreprise
--
-- La colonne est ajoutee NULLABLE : les lignes existantes restent valides tant
-- que le rattachement n'est pas fait. Aucune contrainte NOT NULL n'est posee
-- ici — elle ne pourra l'etre qu'une fois le remplissage verifie, a l'etape 3.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'calls_legacy_v1'
  ) then
    alter table public.calls_legacy_v1
      add column if not exists company_id uuid references public.companies (id);

    create index if not exists calls_legacy_v1_company_idx
      on public.calls_legacy_v1 (company_id);
  end if;
end
$$;

-- Remplissage : a adapter au critere de rattachement reel (numero appele,
-- identifiant d'agent, compte du fournisseur...). Laisse volontairement
-- commente : ecrire un UPDATE global sans connaitre le critere serait une
-- migration destructive deguisee.
--
--   update public.calls_legacy_v1
--      set company_id = '<uuid de l entreprise>'
--    where company_id is null
--      and <critere de rattachement>;
--
-- Controle avant de continuer :
--   select count(*) from public.calls_legacy_v1 where company_id is null;

-- ---------------------------------------------------------------------------
-- Etape 3 — vue de compatibilite
--
-- L'ancien systeme continue d'interroger `public.calls_v1` sans modification.
-- La vue est en lecture ; si l'ancien systeme ecrit encore, ajouter une regle
-- INSTEAD OF plutot que de le faire basculer en force.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'calls_legacy_v1'
  ) then
    execute 'create or replace view public.calls_v1 as select * from public.calls_legacy_v1';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Etape 4 — rejouer 0001_callio_core.sql
--
-- Le nom `public.calls` est desormais libre : la migration 0001 cree la table
-- V2 avec company_id et sa RLS, sans jamais avoir touche aux donnees d'origine,
-- qui restent lisibles dans public.calls_legacy_v1.
--
-- Reprise arriere, si necessaire :
--   drop view if exists public.calls_v1;
--   drop table if exists public.calls;               -- la table V2, vide
--   alter table public.calls_legacy_v1 rename to calls;
-- ---------------------------------------------------------------------------
