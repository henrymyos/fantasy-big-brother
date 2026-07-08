# 👁️ Fantasy Big Brother — Family League

**Live app: https://fantasy-big-brother-iota.vercel.app**

One family, one league, one season: **Big Brother 28** (_Time Trip_). Open the
link on any device — no accounts, no sign-in — and everyone sees the same live
league. Draft the cast, let the results sync themselves from Wikipedia, and
watch the standings shift all season.

## How it works

- **No logins.** There is exactly one league, shared by everyone who opens the
  app. Edits sync in real time to every device (Supabase Realtime,
  last-write-wins — fine for a family-sized group). Without the Supabase env
  vars the app falls back to per-browser localStorage.
- **The season runs itself.** On load and every 5 minutes, the app pulls the
  _Big Brother 28 (American season)_ Wikipedia article and folds it in: the
  cast list imports automatically, evictions / winner / runner-up update
  statuses, and every HOH / Veto / other comp win is logged as scoring events.
  The sync is idempotent and deterministic, so devices never fight and manual
  edits you log yourself are never touched. "Live" means _as fast as
  Wikipedia's editors_ — typically within hours of an episode.
- **Cast photos** are found automatically on the
  [Big Brother fan wiki](https://bigbrother.fandom.com); evicted houseguests go
  grayscale.

## The four tabs

1. **Standings** — live leaderboard plus **The race**, a week-by-week chart of
   each team's cumulative points (hover any week for a full readout, or expand
   the table view).
2. **Houseguests** — photo stat cards for the cast: status, exit week, points,
   HOH / Veto / comp tallies, and who drafted them. Statuses sync themselves;
   you can still override anything by hand.
3. **Draft** — name the teams and owners, then run a **snake draft** (defaults
   to 4 teams × 4 picks). The app tracks who's on the clock.
4. **Scoring** — log the events Wikipedia can't know (survive the week, make
   jury, special powers…). Rules and point values are fully editable; totals
   recalculate instantly.

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

HOH, Veto, other comps, winner, runner-up and AFP are logged automatically by
the Wikipedia sync; the rest are for the family scorekeeper.

## Run it

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` with the Supabase project URL and
publishable (anon) key to get the shared league; otherwise it runs
local-only. Schema lives in `supabase/migrations/` (`0003` is the current
no-accounts "family mode"). The league is a single well-known row in
`bb_leagues` with open anon read/write — anyone with the app URL is family,
which is exactly the threat model this app needs.

## Deploy

```bash
npx vercel --prod
```

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase
(one JSONB row + Realtime). Wikipedia and the fan wiki are both fetched
straight from the browser — no backend of our own.
