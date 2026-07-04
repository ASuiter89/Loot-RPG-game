# Cloud Saves (cross-device sync)

Dungeon Loot can optionally link a player's **save slots** to an account so
progress carries across devices. It's built on the **same Supabase project** as
the [global leaderboard](LEADERBOARD.md) — it reuses the existing
`LB_SUPABASE_URL` / `LB_SUPABASE_KEY` values in `index.html`, talking directly to
Supabase Auth and a `saves` table over the publishable (anon) key. No SDK and no
build step: the game stays a single self-contained `index.html`.

Signing in is **entirely optional**. When a player is logged out (or no backend
is configured), the game saves only to `localStorage` exactly as before. When
logged in, `localStorage` stays the fast local cache and every save is also
mirrored to the cloud; on boot and on login the two are reconciled per slot by
**last-write-wins** using each save's own timestamp.

## How it works

- **Login** is email + password via Supabase Auth (the GoTrue REST API:
  `/auth/v1/signup` and `/auth/v1/token`). The session (access + refresh tokens)
  is kept in `localStorage` so a login survives reloads, and the access token is
  refreshed automatically.
- **Saves** live in a `saves` table, one row per `(user_id, slot)`, with the
  whole save JSON in a `jsonb` column. A row-level-security policy scopes every
  row to its owner (`auth.uid()`), so the public key can only ever read or write
  the signed-in player's own saves.
- The account UI is reachable from the **landing page** ("☁️ Cloud Save" / the
  "Sign in to carry your save across devices" callout) and from the in-game
  **⚙️ Settings → CLOUD** button, so players can sign in before or during play.

## One-time Supabase setup

In the Supabase **SQL Editor**, run this once to create the saves table and its
access policies:

```sql
create table if not exists public.saves (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  slot       int         not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

alter table public.saves enable row level security;

create policy "own saves select" on public.saves
  for select using (auth.uid() = user_id);
create policy "own saves insert" on public.saves
  for insert with check (auth.uid() = user_id);
create policy "own saves update" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saves delete" on public.saves
  for delete using (auth.uid() = user_id);
```

### Settings sync (optional, same project)

Signed-in players also carry their **preferences** across devices — sound levels,
keybinds, UI font, cursor, sprint mode, music vibe, hero bars, and the panel /
minimap collapse states. These live in a separate `settings` table, one row per
account. Run this once alongside the `saves` table above:

```sql
create table if not exists public.settings (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

alter table public.settings enable row level security;

create policy "own settings select" on public.settings
  for select using (auth.uid() = user_id);
create policy "own settings insert" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "own settings update" on public.settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings delete" on public.settings
  for delete using (auth.uid() = user_id);
```

Like the shared stash, settings are **last-writer-wins** by the blob's own
timestamp: the most recently changed preferences win across devices. Two
form-factor-specific settings are deliberately **left per-device** and never
synced — the UI scale (tuned to each screen) and the touch d-pad layout. If the
`settings` table is missing, settings sync silently no-ops and everything else
(saves, stash, leaderboard) keeps working.

Then, in **Authentication → Providers → Email**, make sure **Email** sign-ups
are enabled. For the smoothest experience, turn **"Confirm email" off** so new
accounts can sign in immediately. If you leave confirmation **on**, sign-up still
works — the game tells the player to confirm via the emailed link and then log
in. (Email auth needs an SMTP sender configured for confirmation mails; the
built-in Supabase mailer is rate-limited and meant for testing only.)

That's all the backend needs. The same project URL and publishable key already
used by the leaderboard cover cloud saves too.

## Notes

- **No backend configured?** If `LB_SUPABASE_URL` / `LB_SUPABASE_KEY` are blank,
  the Cloud Save panel says so and the game just uses local saves.
- **Nothing gets overwritten by a different hero.** Each character carries a
  stable id (`cid`), and the cloud's slot layout is the shared source of truth.
  On sync, a character the account already has takes the **newer** of the two
  copies (last-write-wins by timestamp) in its existing slot, while a character
  the cloud has never seen — e.g. a different hero that happens to sit in the same
  slot index on a second device — is **appended to the next free slot** and
  pushed up. So if a PC holds heroes in slots 1–2 and a phone independently holds
  two heroes in slots 1–2, syncing lands the phone's pair in slots 3–4 and the
  account ends up with all four; signing in on the PC then pulls slots 3–4 down so
  both devices converge. A sync never deletes a save on its own — only heroes you
  deliberately delete are removed (see next).
- **Deletions sync across devices.** Deleting a hero (Save Slots → Del, Reset Run,
  or starting a New Game over a slot) records the character's `cid` in an
  append-only **deletion ledger** that mirrors to its own account row (like the
  hardcore death ledger) and is **union-merged** on every sync — it only ever
  grows. On sync, a hero whose `cid` is in the ledger is scrubbed from **both**
  sides (local cache and cloud row), so it can never be mistaken for a brand-new
  character and pushed back up. The moment either device syncs, the deletion
  propagates and the hero stays gone **everywhere** — no more "delete on PC,
  reappears on mobile" ping-pong. (A legacy save made before ids has no
  cross-device identity, so its deletion only removes its own slot's row; every
  hero created since carries a `cid` and syncs its deletion fully.)
- **Unlimited slots.** There's no fixed slot cap — the Save Slots menu shows every
  occupied slot plus one fresh "New Game" row, growing as you add heroes (and as
  cross-device syncs append more).
- **Blank slots never win.** A hero who hasn't begun (no class, no progress) is
  never saved, pushed, or counted in a sync — so signing in on a fresh device
  pulls your existing account saves down instead of letting the empty title-screen
  slot overwrite them.
- **Privacy.** Only the player's own save JSON is stored, and RLS prevents anyone
  else's key from reading it. Passwords are handled entirely by Supabase Auth —
  the game never stores them.
</content>
</invoke>
