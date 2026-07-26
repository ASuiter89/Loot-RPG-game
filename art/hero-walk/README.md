# Hero walk art — source masters

Source animations for the three later classes' walk cycles. These are **masters, not
shipped assets**: the game embeds the composed sprite sheets as base64 inside
`HERO_WALK` in `src/legacy/game.js`, so nothing here is fetched at runtime and the
build never touches this folder. They live in the repo so the sheets can be rebuilt
(or the art revised) without re-deriving the frame layout from scratch.

| File | Class | Body type |
|---|---|---|
| `fortune-seeker.gif` | Fortune-Seeker | female |
| `windblade.gif` | Windblade | male |
| `bloodletter.gif` | Bloodletter | male |

All three classes are **single-sex** (`CLASSES[x].sex`), so each ships exactly one
sheet and the name screen hides the body-type picker for them.

## Format

Each GIF is **48×48, 16 frames** — four directions × four walk frames — laid out in
this block order:

| Frames | Facing |
|---|---|
| 0–3 | up (back) |
| 4–7 | right |
| 8–11 | down (front) |
| 12–15 | left |

The game's sheet is a **192×192 PNG**: 4 rows of 4 columns at 48px, in
`HERO_WALK_ROW` order — `down, left, right, up` (see the constant in
`src/legacy/game.js`). So building a sheet is a **row remap**, not a straight
concatenation:

    game row 0 (down)  <- source block 2 (frames  8-11)
    game row 1 (left)  <- source block 3 (frames 12-15)
    game row 2 (right) <- source block 1 (frames  4-7)
    game row 3 (up)    <- source block 0 (frames  0-3)

Columns map straight through, `0,1,2,3`. That is not an accident worth changing: the
shipped four classes put the **wide** (legs-apart) pose at columns 1 and 3 and the
narrow passing pose at 0 and 2, and these sources already match — which matters
because `HERO_WALK_IDLE = 1` is the standing pose *and* the frame baked into every
DOM portrait (`heroFaceDataURL`). Shifting the columns would leave the new heroes
standing mid-stride while the originals stand still.

## Rebuilding a sheet

`build-sheets.py` does the remap and writes `sheet_<class>.png` next to the sources.
It needs Pillow (`pip install pillow`) and is deliberately **not** wired into `npm
run build` — this is a one-off art step, and the repo ships no Python at runtime.

    python3 art/hero-walk/build-sheets.py

Then base64 the PNG into the matching `HERO_WALK` entry in `src/legacy/game.js`:

    python3 -c "import base64,sys; print(base64.b64encode(open(sys.argv[1],'rb').read()).decode())" \
      art/hero-walk/sheet_fortune.png

After any change here, run `node test/smoke/new-classes.mjs` — it asserts each class
resolves to a square 4×4 sheet and that asking for the wrong body type still returns
the one sheet that exists.
