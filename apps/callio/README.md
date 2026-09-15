# Callio Platform V2

Application SaaS multi-entreprises pour la récupération et la conversion des
demandes entrantes, à destination des entreprises de PAC et climatisation.

Ce dossier est **autonome** : il ne touche ni à `server.js` (proxy
Twilio ↔ ElevenLabs) ni à `project-zero/`, qui restent en l'état à la racine du
dépôt.

## Démarrer

```bash
cd apps/callio
npm install
npm run dev          # http://localhost:3000
```

Sans variables d'environnement, l'application démarre en **mode démonstration** :
espace fictif ClimaNova, aucune base requise, authentification inactive.

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest
npm run build        # build de production
```

## Routes

| Route | Rôle |
| --- | --- |
| `/` | **Emplacement réservé au site commercial.** Placeholder explicite, à remplacer par la vraie landing page. |
| `/login` | Connexion Supabase Auth (e-mail + mot de passe) |
| `/app/dashboard` | Indicateurs et activité récente |
| `/app/leads` | Liste des prospects, fiche détaillée en tiroir (`?lead=<id>`) |
| `/app/calls` | Historique des appels |
| `/app/appointments` | Rendez-vous |
| `/app/settings` | Réglages de l'entreprise et de l'agent |
| `/app/no-company` | Compte authentifié sans appartenance |

`/app/*` est protégé par `src/proxy.ts` (convention `proxy` de Next 16).
La racine `/` n'est jamais interceptée.

## Architecture

```
src/
  app/                 routes (App Router)
  components/          présentation uniquement, aucune logique métier
  lib/
    domain/            logique pure, testée — types, rôles, métriques, routage
    repositories/      frontière d'accès aux données (interface + 2 implémentations)
    providers/         contrats VoiceProvider / CalendarProvider / SmsProvider
    demo/              fixtures ClimaNova, isolées ici et nulle part ailleurs
    supabase/          clients navigateur et serveur, résolution de la source
    auth/              session applicative et entreprise active
    validation/        schémas Zod partagés client/serveur
supabase/migrations/   SQL, non appliqué à distance
```

### Multi-tenant

Toute donnée métier porte un `company_id`. L'appartenance et le rôle
proviennent **exclusivement** de la table `company_members` : ni
`user_metadata`, ni `app_metadata`, ni le JWT ne servent de source d'autorité,
car ils sont modifiables.

Rôles : `owner` > `admin` > `member` (`src/lib/domain/roles.ts`).

Un utilisateur peut appartenir à plusieurs entreprises. L'entreprise active est
mémorisée dans un cookie, mais **toujours revalidée** contre la liste réelle de
ses appartenances : un cookie forgé est ignoré.

### Source de données

`CALLIO_DATA_SOURCE` vaut `demo` ou `supabase`. Non renseignée, elle vaut
`supabase` si les deux variables publiques Supabase existent, `demo` sinon.

Le mode démonstration contourne l'authentification : il est **refusé en
production** sauf `CALLIO_ALLOW_DEMO_IN_PRODUCTION=1`. Quand il est actif, un
bandeau permanent le signale dans l'interface — aucune donnée fictive ne peut
être confondue avec une donnée réelle.

Basculer vers Supabase ne demande aucune modification de composant : renseigner
les variables suffit.

## Migrations

Dans `supabase/migrations/`, **non appliquées à distance** :

- `0001_callio_core.sql` — tables, index, déclencheurs et politiques RLS.
  Additive et idempotente. Elle s'interrompt avec un message explicite si une
  table `public.calls` préexistante et sans `company_id` est détectée.
- `0002_legacy_calls_bridge.sql` — reprise progressive d'une table `calls`
  historique : renommage sans perte, colonne `company_id` nullable, vue de
  compatibilité. À n'appliquer que si 0001 s'est interrompue.

Les politiques RLS s'appuient sur trois fonctions `security definer`
(`callio_is_member`, `callio_role_in`, `callio_can_manage`) qui lisent
`company_members` en contournant la RLS — ce qui évite la récursion infinie
classique d'une politique sur `company_members` qui interrogerait
`company_members`.

**La clé `service_role` n'apparaît nulle part dans l'application.** Seule la clé
anon est utilisée, côté navigateur comme côté serveur, et toutes les requêtes
passent donc par la RLS.

## Identité visuelle

Fond noir, violet Callio, cartes sombres. Tous les jetons vivent dans
`tailwind.config.ts` ; la police se change en redéfinissant la seule variable
`--font-sans` dans `src/app/globals.css`.

Les teintes sont une **reconstruction à partir de la description du produit** :
le site commercial n'étant pas présent dans ce dépôt, les valeurs exactes
n'ont pas pu être relevées. Les recaler dans `tailwind.config.ts` suffit à
aligner l'application sur le site.

## Ce qui n'est pas là, volontairement

L'écriture (formulaires de réglages, invitation de membres, déclenchement
d'appel) n'est pas branchée : elle suppose des migrations appliquées sur une
base réelle, ce qui n'est pas fait. Plutôt que d'afficher des commandes sans
effet, chaque section indique ce qui manque.

Aucune dépendance à n8n. Pas de Stripe. Pas d'automatisation Vapi : seulement
les contrats d'interface dans `src/lib/providers/`.
