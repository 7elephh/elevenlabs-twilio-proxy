# LE KING BARBER — site & réservation

Site vitrine premium + moteur de réservation + espace salon (`/admin`).
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (PostgreSQL, Auth, Storage) · Vercel.

> **Statut : démonstration.** Les horaires, durées et prestations de `supabase/seed.demo.sql`
> sont des exemples (seul « Coupe + barbe : 20 € » vient du salon). Adresse, téléphone,
> Instagram, photos, mentions légales : à saisir dans `/admin/site`. Aucun avis n'est inventé :
> la section avis reste masquée tant que le salon n'en saisit pas.

## Fonctionnalités

**Site public** — accueil Black Heritage (hero, salon, carte des prestations, galerie, avis, infos
pratiques, horaires), mobile-first, animations discrètes (respecte `prefers-reduced-motion`),
SEO local (JSON-LD `BarberShop`, Open Graph, sitemap, robots), mentions légales & politique de
confidentialité alimentées par les réglages.

**Réservation** (`/reserver`) — prestation → jour → créneau → coordonnées → confirmation.
Page `/rendez-vous/<jeton>` : récapitulatif, ajout à l'agenda (.ics / Google), itinéraire,
annulation en ligne jusqu'au délai configuré.

**Espace salon** (`/admin`) — tableau de bord (jour, à venir, réservations du mois, nouveaux
clients, historique, liste de mise en service), agenda jour/semaine/mois, création / modification /
déplacement / annulation de rendez-vous, statuts (honoré, absent), clients (notes, effacement RGPD),
horaires hebdomadaires avec pauses, congés / fermetures / blocages, prestations, contenus du site
(textes, photos, galerie, avis, coordonnées, mentions légales, règles de réservation), intégrations.

## Garanties du moteur de réservation

| Règle | Où elle est appliquée |
| --- | --- |
| Horaires, pauses, congés, durée, délai minimum, fenêtre max | `src/lib/booking/availability.ts` (fonction pure, testée) — recalculée côté serveur à la confirmation |
| **Jamais deux rendez-vous sur le même créneau** | Contrainte PostgreSQL `EXCLUDE USING gist` sur `bookings` + verrou transactionnel dans `create_booking()` |
| Fuseau Europe/Paris & changements d'heure | `date-fns-tz`, tests dédiés (29 mars / 25 octobre 2026) |
| Abus | champ piège, validation Zod, contrôle d'origine, limite par IP/heure, limite de rendez-vous actifs par client |
| Données personnelles | RLS : le public ne lit aucune réservation ni client ; clé service uniquement côté serveur ; jetons de gestion HMAC dont seul le hash est stocké ; purge automatique |

Google Calendar et les emails sont **secondaires** : s'ils échouent, la réservation est quand même enregistrée.

## Tests

```bash
npm test          # 32 tests unitaires (disponibilités, DST, validation, chiffrement)
npm run test:db   # 23 tests sur un vrai PostgreSQL éphémère (conflits, concurrence, annulation, RLS, RGPD)
```

`test:db` nécessite les binaires PostgreSQL ≥ 15 (`pg_ctl`, `initdb`).

## Mise en ligne (≈ 20 min)

1. **Supabase** — créer un projet (région UE, ex. Paris `eu-west-3`). Dans *SQL Editor*, exécuter
   dans l'ordre `supabase/migrations/0001_schema.sql`, `0002_security.sql`, `0003_storage.sql`,
   puis (optionnel, démo) `supabase/seed.demo.sql`.
2. **Compte du barbier** — *Authentication > Users > Add user* (email + mot de passe, « Auto confirm »).
   Puis dans *SQL Editor* :
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'email-du-barbier@exemple.fr';
   ```
   Désactiver les inscriptions publiques : *Authentication > Sign In / Providers > Allow new users to sign up* = off.
3. **Vercel** — importer le dépôt, *Root Directory* = `le-king-barber`, renseigner les variables de
   `.env.example`, déployer. `vercel.json` déclare la tâche quotidienne (rappels de la veille,
   statut « honoré », purge RGPD) à 16 h UTC.
4. **Emails (optionnel)** — compte Resend, vérifier le domaine (DNS), renseigner `RESEND_API_KEY`,
   `EMAIL_FROM`, `BARBER_NOTIFICATION_EMAIL`. Bouton « Envoyer un email de test » dans `/admin/integrations`.
5. **Google Calendar (optionnel)** — Google Cloud Console : activer *Google Calendar API*, écran de
   consentement (scope `calendar.events`), identifiants OAuth « Application Web » avec l'URI de
   redirection `https://<domaine>/api/google/oauth/callback`. Renseigner les 3 variables Google, puis
   « Connecter mon Google Calendar » dans `/admin/integrations`.

## Ce qui est vérifié / ce qui ne l'est pas

- ✅ Testé sur PostgreSQL 16 + Supabase Auth v2.180 + PostgREST v12 en local : parcours complet dans
  Chromium (iPhone 13 et 1440 px), 8 réservations simultanées du même créneau → 1 seule acceptée,
  annulation client → créneau de nouveau proposé, accès admin protégé, API publique sans fuite.
- ⚠️ **Non testé de bout en bout** : envoi réel d'emails (pas de clé Resend), Google Calendar (pas de
  projet OAuth), envoi de photos (Supabase Storage absent de l'environnement de test). Le code est
  écrit et typé, mais doit être validé une fois les comptes créés.
- Synchronisation Google **unidirectionnelle** (site → Google) + option de lecture des occupations
  Google pour bloquer des créneaux. Une modification faite dans Google n'est pas reportée sur le site.
- Rappels : email uniquement, la veille, pour les clients ayant donné leur email. Pas de SMS.
