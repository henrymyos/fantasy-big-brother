# 👁️ Fantasy Big Brother

**Live app: https://fantasy-big-brother-iota.vercel.app**

A draft-and-track app for your family's annual Big Brother fantasy league. Draft
the cast onto teams, log what happens each week with a configurable scoring
system, mark houseguests as they get evicted, and watch the standings shift all
season long.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL (e.g. http://localhost:3000).

## How it works

The app has five tabs:

0. **Auto-sync** — pull the cast and live results straight from the season's
   **Wikipedia page** instead of typing anything (see below).
1. **Houseguests** — paste the cast (one name per line). As the season plays
   out, set each person's status: _in the house → evicted / jury → runner-up /
   winner_.
2. **Draft** — set the number of teams and picks per team (defaults to 4×4),
   name each team and owner, then run a **snake draft** (pick order reverses
   each round). The app tracks who's on the clock; click a houseguest to draft
   them.
3. **Scoring** — log weekly events (e.g. "Alex — Win Head of Household, Week 3").
   Points roll up to each houseguest and their team. The **scoring rules** are
   fully editable — change any point value or add your own custom rules.
4. **Standings** — live leaderboard. Each team's total is the sum of all points
   their drafted houseguests have earned, with a per-team roster and progress
   bar. Crowns the league winner once a houseguest is marked the Big Brother
   champion.

### Default scoring system

| Event | Points |
|---|---|
| Win Head of Household | +10 |
| Win Power of Veto | +8 |
| Win other competition | +4 |
| Win a special power / America's vote | +6 |
| Saved off the block by veto | +4 |
| Survive eviction while nominated | +5 |
| Survive the week | +2 |
| Make it to Jury | +5 |
| Reach Final 3 | +10 |
| Runner-up (Final 2) | +20 |
| Win Big Brother | +40 |
| America's Favorite Player | +10 |
| Self-evict / expelled | −10 |

Tweak any of these on the Scoring tab — totals recalculate instantly.

## Auto-sync from Wikipedia

The **Auto-sync** tab fetches the season's Wikipedia article (e.g. _Big Brother
28 (American season)_) directly from the browser — no backend, no API key — and
parses two tables:

- **Houseguests** → the full cast list, each person's final placement, and the
  day they were evicted.
- **Voting history** → every HOH, Power of Veto, and Block Buster competition
  winner.

From there you can:

- **Import cast** — adds every houseguest so you never type the roster by hand.
- **Sync results** — marks evictions/winner/runner-up and logs all the
  competition wins as scoring events. It's **idempotent**: re-syncing replaces
  the previous Wikipedia data without touching anything you logged manually.
- **Keep in sync automatically** — re-pulls every 10 minutes while the tab is
  open, so standings update on their own during the season.

Enter just a number (`28`) for the US season, or paste any season's Wikipedia
URL. Names from the voting grid are first-name-only and are fuzzily matched back
to the full cast (including nicknames like _Cliffton "Will" Williams_).

**Caveats worth knowing:**

- There's no official Big Brother API and the live feeds are paid/closed, so
  "live" means _as fast as Wikipedia's editors_ — typically within hours of an
  episode, not the instant it happens on the feeds.
- Parsing is tuned to the **current** Wikipedia table format (verified against
  seasons 26 & 27). Much older seasons used different layouts and may import only
  partially. The preview shows exactly what will be applied before you commit.

## Shared, real-time league (Supabase backend)

The header has a **Share with family** button. Click it once and the league is
saved to a shared Supabase database and you get an invite link
(`…/?league=<id>`). Anyone who opens that link joins the **same live league** —
edits, draft picks, evictions and scores sync in real time across everyone's
devices, no logins required. **Join** lets you paste an invite link to hop into
an existing league.

How it works:

- The whole league state is stored as one JSON row in a `bb_leagues` table, with
  Supabase **Realtime** broadcasting changes to everyone viewing it.
- Leagues are shared by their unguessable `id` — open access policies keyed by
  that id (no per-user auth), which suits a low-stakes family game with no
  sensitive data. Edits are last-write-wins, which is fine for a handful of
  editors.
- If the `NEXT_PUBLIC_SUPABASE_*` env vars aren't set, the app silently falls
  back to **local-only mode** (per-browser `localStorage`).

Configure it by copying `.env.example` to `.env.local` and filling in your
Supabase project URL and publishable (anon) key. The schema lives in
`supabase/migrations/0001_bb_leagues.sql`.

## Backup & portability

Even in shared mode, **Export** downloads the league as a JSON file and
**Import** loads one — handy for backups or starting a new season.

## Deploy

This is a static Next.js app and deploys to Vercel with zero config:

```bash
npx vercel
```

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4. All state is
client-side — no database or backend required.
