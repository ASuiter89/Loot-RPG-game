# Global Leaderboards

Dungeon Loot has a global leaderboard shared across **everyone who plays** —
ranking heroes by **furthest floor**, **highest level**, **most gold**, and
**highest Power**.

Each board comes in two ladders, chosen with the **Standard / Hardcore** switch
at the top of the leaderboard: **Standard** ranks ordinary heroes, **Hardcore**
ranks only one-life permadeath heroes against each other. Both ladders share the
same table — Hardcore rows are just flagged with a `hardcore` column and
filtered.

The game is still a single self-contained `index.html`. The leaderboard talks
directly to a free [Supabase](https://supabase.com) project over its REST API.
Supabase's public **anon / publishable key** is *designed* to be embedded in
client code: a row-level-security (RLS) policy decides what that key may do, so
shipping it in the page is safe.

If the two config values are left blank (or the network is down), the game falls
back to a **device-local** leaderboard stored in `localStorage`, so the feature
always works.

Every submitted score is taken at face value — there is no server-side
validation of the numbers. Any value a player reaches is treated as real.

## Where the config lives

In `index.html`, in the `GLOBAL LEADERBOARD` section:

```js
const LB_SUPABASE_URL = 'https://YOURPROJECT.supabase.co'; // base URL, no trailing path
const LB_SUPABASE_KEY = 'sb_publishable_...';              // anon / publishable key
```

Use the **base** project URL (no `/rest/v1/`) — the code appends the REST path
itself.

## One-time Supabase setup

In the Supabase **SQL Editor**, run this once to create the table and its access
policies:

```sql
create table if not exists public.leaderboard (
  name         text not null,
  player_class text,
  ascension    text,
  max_floor    int  not null default 1,
  level        int  not null default 1,
  gold         int  not null default 0,
  power        int  not null default 1,
  hardcore     boolean not null default false,
  loadout      jsonb,
  updated_at   timestamptz not null default now(),
  primary key (name, hardcore)
);

-- If you created the table before the Power board existed, add the column:
alter table public.leaderboard add column if not exists power int not null default 1;

-- If you created the table before rows showed the hero's ascension (subclass),
-- add the column. Until it exists the board still loads — the client selects it
-- optionally and falls back to the base columns — so this is safe to run anytime.
alter table public.leaderboard add column if not exists ascension text;

-- If you created the table before clicking a row showed the hero's build, add the
-- `loadout` column. It stores a small JSON snapshot of each hero (attributes, worn
-- gear, learned skills), fetched only when a row is opened. Safe to run anytime:
-- until it exists, submissions automatically drop the snapshot (so scores still
-- record) and the hero-detail panel simply reports "no snapshot".
alter table public.leaderboard add column if not exists loadout jsonb;

alter table public.leaderboard enable row level security;

create policy "public read"   on public.leaderboard for select using (true);
create policy "public insert" on public.leaderboard for insert with check (true);
create policy "public update" on public.leaderboard for update using (true) with check (true);
```

That's all the backend needs. Each character upserts a single row; the boards
are just that table filtered by `hardcore` and sorted by `max_floor`, `level`,
`gold`, or `power`.

### Already have a leaderboard table? (Hardcore migration)

If your table predates the Hardcore ladder it is still keyed by `name` alone and
has no `hardcore` column. Run this once to add the flag and widen the primary key
to `(name, hardcore)` so a Standard and a Hardcore hero can share a name without
colliding — existing rows default to Standard (`hardcore = false`):

```sql
alter table public.leaderboard add column if not exists hardcore boolean not null default false;
alter table public.leaderboard drop constraint if exists leaderboard_pkey;
alter table public.leaderboard add primary key (name, hardcore);
```

The existing read / insert / update policies already cover the new column, so
there is nothing else to change.

### Already have a leaderboard table? (Hero-snapshot migration)

Clicking a board row opens a snapshot of that hero's **attributes, worn gear and
learned skills**. It's stored in a `loadout` JSON column. If your table predates
it, add the column once:

```sql
alter table public.leaderboard add column if not exists loadout jsonb;
```

This is safe to run anytime and needs no policy change (the existing read / insert
/ update policies already cover it). Until the column exists everything still
works: score submissions automatically retry without the snapshot, and opening a
hero just says there's no snapshot yet. The board list itself never fetches
`loadout` — it's pulled one row at a time only when a hero is clicked, so a large
board stays fast.

## Shared vault & crafting materials (no leaderboard change)

The account-wide **Vault** and the shared **crafting-material** wallet — including
the split that gives **Standard and Hardcore separate** vaults and materials — ride
entirely on the existing **`saves`** table (see [CLOUD_SAVES.md](CLOUD_SAVES.md)):
each ladder's pool is just another row keyed by a reserved negative `slot`. There
is **no leaderboard or schema change** to make for those features — signing in is
all that's needed to sync them across devices.

## Rotating the key

If the publishable key ever needs to change, rotate it in the Supabase dashboard
and paste the new value into `LB_SUPABASE_KEY` in `index.html`.
</content>
