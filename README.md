# Cue Point — Pool Parlour & player platform

Full-stack app for **Cue Point**, a pool parlour in **Pitipana, Homagama**: a
premium motion-driven site, a table-booking system, and a player platform
(accounts, rankings, profiles, matches, tournaments, membership, loyalty,
promotions).

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
  Framer Motion · Lenis · **PostgreSQL via raw SQL (`pg`, no ORM)**
- **Theme:** Teal `#00C2A8` · Deep Navy `#0B1F33` · Black · White as negative space

## Run it

```bash
npm install
cp .env.example .env          # point DATABASE_URL at your Postgres
npm run db:setup             # apply schema + insert business config
npm run dev                  # http://localhost:3000
```

`npm run db:setup` applies `db/schema.sql` (drops & recreates the `public`
schema) and inserts the venue's **configuration only** — the 3 membership
tiers, the achievement catalogue, the loyalty-reward catalogue and the Cue
Point venue record (all editable in `scripts/setup.ts` or the staff console).

**No demo players, matches, tournaments or promotions are created.** Everything
is real data entered through the app:

1. Open **`/account`** and register — the **first account becomes the admin**.
2. As admin, open **`/admin`** to add players, create tournaments, generate
   brackets, record official results, and manage offers & membership.
3. Players self-register at `/account`, register for tournaments, and appear on
   the leaderboard once they have a recorded ranked/tournament match.

## Accounts & roles

- Session auth (signed `cp_session` cookie, `node:crypto` scrypt hashing —
  `lib/auth.ts`). `getViewer()` in `lib/ecosystem/identity.ts`.
- Roles: `player` (default), `staff`, `admin`. Staff/admin see the console link
  and can hit `/api/staff/*`. Admins can promote others in the Players tab.
- Scripts / integrations can also authorise staff API calls with an
  `x-staff-key` header matching `STAFF_KEY`.

## Pages

| Route | What it is |
| --- | --- |
| `/` | The experience — hero video, scroll-story, pinned pricing, gallery, stat counters, booking widget, map, plus live preview strips (rankings · tournament · community) with graceful empty states |
| `/book` | 4-step booking flow |
| `/account` | Sign in / create account |
| `/rankings` | Podium + leaderboard, scope filters, form + movement |
| `/players` · `/players/[slug]` | Player community + premium profiles |
| `/matches` | Global match history with filters (`?player=<slug>`) |
| `/tournaments` · `/tournaments/[slug]` | Cards, detail, countdown, register, interactive bracket (desktop horizontal / mobile round-tabs) |
| `/membership` · `/offers` | Plans + loyalty rewards; date-aware promotions |
| `/dashboard` | Logged-in player control centre (redirects to `/account`) |
| `/admin` | Staff console — Record result · Players · Tournaments · Offers · Membership · Bookings · Audit |

## API

`auth/register` · `auth/login` · `auth/logout` · `me` ·
`availability` · `bookings` · `rankings` · `players` · `players/[slug]` ·
`matches` · `tournaments` · `tournaments/[slug]` (GET + POST register) ·
`promotions` · `memberships` ·
`staff/matches` · `staff/players` · `staff/tournaments` · `staff/promotions` ·
`staff/memberships` · `staff/loyalty` — all `staff/*` require a staff session
or the `x-staff-key` header.

## Where things live

```
db/schema.sql            full schema (enums, FKs, indexes, constraints)
scripts/setup.ts         applies schema + inserts business config
lib/pg.ts                lazy Postgres pool + query / transaction helpers
lib/auth.ts              password hashing + signed session tokens
lib/db.ts                bookings data layer (SQL)
lib/ecosystem/
  store.ts               players / matches / rankings / tournaments / … (SQL)
  ranking.ts             pure Elo-style engine (RANKING_CONFIG = the tweak point)
  identity.ts            session viewer + staff guard
lib/config.ts            business info, hours, MAIN_NAV, copy
components/               marketing sections + components/eco/* for the platform
```

## Data & correctness

- Player stats (matches played, W/L, win %, ranking points, rank, recent form)
  are **derived** — recomputed by replaying the `matches` table through the
  ranking engine (cached per process by match count). Recording a result writes
  the match + point snapshots + `ranking_history` and advances any linked
  tournament bracket, in a transaction.
- Booking capacity is per table type (3 pool, 2 VIP); concurrent bookings for a
  day + type are serialised with a Postgres advisory lock.
- Players can only edit their own basic profile, register for tournaments, and
  read public data. All stat / ranking / bracket / membership / promotion
  writes are server-validated behind the staff guard and audited.

## Deferred

Password reset & email verification; membership self-checkout / billing; the
challenge system (data + UI placement exist); the multi-venue Sri-Lanka
directory (schema + venue record exist, homepage teaser only).
