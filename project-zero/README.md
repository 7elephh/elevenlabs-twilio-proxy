# PROJECT ZERO — Football Development System

Answering one question: **am I actually getting better at football, how fast, and on
which axes?**

Minimum input, maximum insight. You play; the app measures, structures, compares and
explains. No FIFA-style overall rating, no invented statistics, no twenty-field form
after every session.

---

## Architecture

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15, App Router, React 19, TypeScript strict | Server Components read the data, Server Actions write it — no separate API layer for a single-user app. |
| Styling | Tailwind CSS 3, dark performance-tool palette | Mobile-first utility classes; the design tokens live in `tailwind.config.ts`. |
| Data | Supabase (PostgreSQL + Auth + RLS) | Real multi-user-capable persistence with row-level isolation from day one. |
| Charts | Recharts | One line chart with a baseline reference line — that is all the app needs. |
| Validation | Zod + React Hook Form | The same schemas validate the client form and the server action. |
| Tests | Vitest | The progression maths is the part that must not be wrong. |

Layout:

```
src/lib/domain/    pure domain logic — no I/O, fully unit-tested
  types.ts         measurement type, reliability, improvement direction, positions, roles
  protocols.ts     the V0.1 test catalogue
  scoring.ts       raw attempts -> stored value + detail + variant
  progress.ts      baseline deltas, best value, linear-regression trend
  priorities.ts    deterministic dashboard priorities and suggested tests
  checkpoints.ts   checkpoint computation and next-due date
  positions.ts     PositionMetricWeight matrix + role profiles
src/lib/data/      persistence boundary: one interface, two implementations
src/actions/       server actions (sessions, tests, checkpoints, profile)
src/app/           routes
src/components/    UI, mobile-first
supabase/migrations/  SQL schema, RLS, protocol reference data
scripts/seed.ts    demo data, every row flagged DEMO
```

**Storage abstraction.** `DataStore` has a Supabase implementation and a local
file-backed implementation (`.data/store.json`). Without Supabase credentials the app,
the seed and every page still work end to end; with credentials set, the exact same
code paths hit Postgres. No user id is hard-coded anywhere — it comes from the Supabase
session, or from the single local identity.

### Data philosophy, enforced in the model

Every metric carries three qualifiers that travel all the way to the screen:

- `measurement_type` — `OBJECTIVE` / `SEMI_OBJECTIVE` / `SUBJECTIVE`
- `reliability_level` — `HIGH` / `MEDIUM` / `LOW`, per result, not just per protocol
- `improvement_direction` — `HIGHER_IS_BETTER` / `LOWER_IS_BETTER`

Plus `protocol_version` on every result: if a protocol changes in a way that breaks
comparability, the UI warns instead of comparing blindly.

### Trends

`computeTrend()` never reads a direction from a single measurement:

- fewer than 3 observations → `INSUFFICIENT_DATA`
- otherwise a least-squares fit of value against elapsed days, over the last 8
  observations
- the modelled change across the window is normalised by the mean; under 3 % it is
  reported as `STABLE`
- `improvement_direction` decides whether the slope means progress
- wording stays cautious: *Likely progress · Stable · Likely decline · Insufficient data*

---

## Database

All tables live in `supabase/migrations/`.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `profiles` | one row per auth user | `user_id` (unique, FK `auth.users`), `primary_position`, `secondary_positions[]`, `preferred_role`, `baseline_date` |
| `test_protocols` | shared reference data, mirrors `src/lib/domain/protocols.ts` | `slug` (unique), `category`, `position_relevance` jsonb, `measurement_type`, `improvement_direction`, `default_reliability`, `protocol_version` |
| `training_sessions` | the quick entry | `user_id`, `date`, `session_type`, `duration_minutes`, optional `position`, `rpe`, `notes` |
| `test_results` | one row per test performed | `user_id`, `protocol_slug` (FK), `protocol_version`, `performed_at`, `value`, `attempts` jsonb, `detail` jsonb, `variant`, `measurement_method`, `reliability_level`, `conditions`, `is_baseline` |
| `checkpoints` | computed periodic snapshots | `user_id`, `date`, `kind`, `sessions_since_previous`, `training_hours_since_previous`, `matches_since_previous`, `metrics` jsonb |

Relations: `profiles`, `training_sessions`, `test_results`, `checkpoints` →
`auth.users(id)` on delete cascade; `test_results.protocol_slug` → `test_protocols.slug`.

Constraints worth knowing:

- a partial unique index guarantees **one ZERO BASELINE per metric** (`user_id`,
  `protocol_slug`, `variant`)
- `variant` separates non-comparable runs of the same protocol (a 1000 m run is never
  compared with a 2000 m run)
- every user table has RLS enabled with `auth.uid() = user_id` for select/insert/update/
  delete; `test_protocols` is read-only to authenticated users
- a trigger on `auth.users` creates the profile row for every new account
- `is_demo` marks seeded rows so they can be wiped in one statement

`PositionMetricWeight` and the role profiles are typed configuration
(`src/lib/domain/positions.ts`) derived from a single source of truth — the
`position_relevance` map on each protocol — rather than a duplicated table.

---

## Features that actually work

- **Quick session entry** — type, duration (± 15 min buttons and presets), date. Position,
  RPE and notes are behind an "optional details" fold. Well under 15 seconds.
- **START TEST flow** — read protocol → record attempts → save → immediate comparison
  with baseline, best and trend, with reliability shown.
- **ZERO BASELINE** — the first result recorded for a metric becomes its baseline and
  sets the profile baseline date. Every later value is compared against it.
- **Progress view** — metric selector, baseline / latest / best / measurement count,
  change vs baseline, change vs previous, trend, reliability, history chart with a
  baseline reference line, and 30d / 90d / 6m / 1y / all-time filters.
- **Checkpoints** — pick a date and a cadence; sessions, hours, matches and every metric
  delta (vs baseline and vs previous checkpoint) are computed from the stored history.
  Next-due date is derived from the baseline (30 days simple, 90 days full).
- **Current priorities** — at most three, deterministic: position × role weight, plus
  staleness, plus stagnation. Never-measured relevant metrics come first.
- **Position & role specialisation** — 12 positions, role profiles for full-backs
  (`ATTACKING_FULLBACK` and `COMPLETE_FULLBACK` fully weighted in V0.1; the other three
  are declared but neutral). Weights order the UI — they never produce a rating.
- **Demo data** — seeded rows are flagged and removable in one click from the profile.
- **Mobile first, installable** — bottom tab bar, 48 px touch targets, 16 px inputs (no
  iOS zoom), safe-area padding. Web manifest, app icons and Apple web-app meta, so
  Safari's "Add to Home Screen" gives a standalone app.
- **Works without a connection** — a service worker keeps every page you have already
  opened available offline, and sessions or test results recorded without signal are
  stored on the device and replayed automatically on reconnection. A drain is guarded
  against concurrent runs, so one entry is never submitted twice.

Deliberately **not** built: social feed, followers, badges, leaderboards, levels, overall
rating, LLM features.

---

## Test protocols (V0.1)

| Slug | Name | Category | Unit | Direction | Default reliability |
| --- | --- | --- | --- | --- | --- |
| `juggling` | Juggling | TECHNICAL | touches | higher | HIGH |
| `slalom-ball-control` | Slalom Ball Control (6 cones, 2 m, 14 m total, +0.5 s per fault) | TECHNICAL | s | lower | MEDIUM |
| `passing-accuracy-strong-foot` | Passing Accuracy — Strong Foot (20 passes, 1 m gate at 15 m) | TECHNICAL | /20 | higher | HIGH |
| `passing-accuracy-weak-foot` | Passing Accuracy — Weak Foot | TECHNICAL | /20 | higher | HIGH |
| `crossing-accuracy` | Crossing Accuracy (12 crosses, 3 zones, 0/1/2) | POSITIONAL | /24 | higher | MEDIUM |
| `finishing-accuracy` | Finishing Accuracy (20 strikes; goals / on target / misses) | TECHNICAL | goals /20 | higher | HIGH |
| `sprint-10m` | Sprint 10 m (3 attempts, best + mean) | PHYSICAL | s | lower | MEDIUM |
| `sprint-20m` | Sprint 20 m | PHYSICAL | s | lower | MEDIUM |
| `sprint-30m` | Sprint 30 m | PHYSICAL | s | lower | MEDIUM |
| `timed-run` | Timed Run (1000–5000 m, pace derived, distance = variant) | PHYSICAL | s | lower | MEDIUM |

Yo-Yo, beep test and repeated-sprint protocols plug into the same `TestProtocol` shape
later; they are intentionally not implemented now.

---

## Setup

```bash
cd project-zero
npm install
cp .env.example .env.local     # optional: leave empty to use the local file store
npm run seed                   # demo data, all flagged DEMO
npm run dev                    # http://localhost:3000
```

Other commands:

```bash
npm run test        # Vitest — progression, scoring, priorities, checkpoints
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # production build
npm run seed:clear  # delete every DEMO row
```

---

## Supabase

Environment variables (`.env.local`):

| Variable | Used by | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | to enable Supabase mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | to enable Supabase mode |
| `SUPABASE_SERVICE_ROLE_KEY` | `npm run seed` only | to seed Supabase |
| `SEED_USER_ID` | `npm run seed` only | auth user id owning the demo rows |

Both public variables present → Supabase mode: real auth (`/login`, email + password),
RLS-scoped queries. Either missing → local file store at `.data/store.json`, auth
bypassed, everything else identical.

Setup:

1. Create a Supabase project.
2. Run the migrations, in order:
   ```bash
   supabase db push                       # with the Supabase CLI linked to the project
   # or paste supabase/migrations/0001_init.sql then 0002_protocols_seed.sql
   # into the SQL editor
   ```
3. Put the project URL and anon key in `.env.local`.
4. Start the app, open `/login`, create the account. The trigger creates the profile row.
5. To seed demo data, add the service role key and the new user's id, then `npm run seed`.

---

## Validation

Run on Node 22, from `project-zero/`:

| Check | Command | Result |
| --- | --- | --- |
| Unit tests | `npm run test` | **79 passed** (5 files) |
| TypeScript | `npm run typecheck` | **no errors** (strict) |
| Lint | `npm run lint` | **no warnings or errors** |
| Build | `npm run build` | **success**, 13 routes |
| Routes | production server smoke test | `/`, `/sessions`, `/sessions/new`, `/tests`, `/tests/[slug]`, `/progress`, `/checkpoints`, `/profile` → 200; unknown slug → 404 |
| Seed | `npm run seed` / `npm run seed:clear` | 102 sessions, 41 results, 3 checkpoints created and removed cleanly |

Test coverage focuses on what must not be wrong:

- `HIGHER_IS_BETTER` and `LOWER_IS_BETTER` deltas, in both directions, including the
  spec examples (3.48 s → 3.31 s = −4.9 %, 17 → 64 = +276 %)
- `INSUFFICIENT_DATA` with 0, 1 and 2 observations, and when every measurement lands on
  the same day
- stability threshold vs real progress, and the trailing-window behaviour
- best value as max/min according to direction, baseline selection, variant separation,
  protocol-version mismatch, mixed reliability
- protocol scoring rules (slalom penalty, crossing zones, finishing counts, run pace)
  and their validation rules
- position/role weighting, and priority ordering (stagnating before improving at equal
  weight)
- checkpoint windows, baseline vs previous-checkpoint deltas, next-due dates
- the offline queue: ordering, removal, corrupt storage, size cap, and telling a network
  failure apart from a server rejection

The offline path was additionally verified in a real browser with the server stopped:
the service worker takes control, a previously visited page still renders, an unvisited
one falls back to the static offline page, a session recorded with the server down is
queued on the device, and firing three `online` events at once drains it exactly once.

---

## Offline behaviour, and its limits

The service worker caches pages network-first: you always get fresh data when the network
allows, and the last rendered version when it does not. Two consequences worth knowing:

- a page you have **never opened online** cannot be shown offline — you get the static
  offline page instead;
- a page served from the cache shows the data as of your last visit, so figures can be
  stale until the connection returns.

Writes are never cached by the service worker. They go to a `localStorage` queue and are
replayed sequentially on reconnection; an entry the server rejects on its merits is
dropped and reported rather than blocking everything behind it.

## Next steps (V0.2)

1. **Session ↔ test linkage and load context** — attach a test result to the session it
   was run in, so a result can be read against recent training load (RPE × duration).
2. **Cardio protocols** — Yo-Yo IR1 and a repeated-sprint test on top of the existing
   `TestProtocol` shape, with the same variant handling as `Timed Run`.
3. **Automatic checkpoint reminders** — generate the due checkpoint automatically and
   surface it on the dashboard instead of relying on the user to create it.
4. **Measurement-error bands** — store an uncertainty per measurement method so a
   phone-timed sprint delta smaller than the timing error is reported as noise.
5. **Export / import** — CSV or JSON export of sessions and results, for backup and for
   analysis outside the app.
