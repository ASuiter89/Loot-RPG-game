#!/usr/bin/env python3
"""Compose the hero walk sheets from the source GIFs in this folder.

The sources are 48x48, 16-frame GIFs in the block order up / right / down / left;
the game wants a 192x192 PNG whose rows follow HERO_WALK_ROW (down, left, right,
up). See README.md for why the columns map straight through.

One-off art step — NOT part of `npm run build`. Needs Pillow:

    pip install pillow
    python3 art/hero-walk/build-sheets.py
"""
from pathlib import Path
import sys

try:
    from PIL import Image, ImageSequence
except ImportError:  # pragma: no cover - developer tooling
    sys.exit("this script needs Pillow:  pip install pillow")

HERE = Path(__file__).resolve().parent
TS = 48                      # tile size, matching HERO_WALK_TS
COLS = ROWS = 4
# game row (down, left, right, up)  ->  source 4-frame block (up, right, down, left)
ROW_FROM_BLOCK = {0: 2, 1: 3, 2: 1, 3: 0}

SOURCES = {
    "fortune": "fortune-seeker.gif",
    "windblade": "windblade.gif",
    "bloodletter": "bloodletter.gif",
}


def build(cls: str, filename: str) -> Path:
    src = HERE / filename
    if not src.exists():
        sys.exit(f"missing source art: {src}")
    im = Image.open(src)
    frames = [f.convert("RGBA") for f in ImageSequence.Iterator(im)]
    if len(frames) != COLS * ROWS:
        sys.exit(f"{filename}: expected {COLS * ROWS} frames, got {len(frames)}")
    if frames[0].size != (TS, TS):
        sys.exit(f"{filename}: expected {TS}x{TS} frames, got {frames[0].size}")

    sheet = Image.new("RGBA", (TS * COLS, TS * ROWS), (0, 0, 0, 0))
    for row in range(ROWS):
        block = ROW_FROM_BLOCK[row]
        for col in range(COLS):
            sheet.paste(frames[block * COLS + col], (col * TS, row * TS))

    out = HERE / f"sheet_{cls}.png"
    sheet.save(out, optimize=True)
    return out


def main() -> None:
    for cls, filename in SOURCES.items():
        out = build(cls, filename)
        print(f"{cls}: {out.relative_to(HERE.parent.parent)} "
              f"({TS * COLS}x{TS * ROWS}, {out.stat().st_size} bytes)")
    print("\nNow base64 each PNG into its HERO_WALK entry in src/legacy/game.js,")
    print("then run: node test/smoke/new-classes.mjs")


if __name__ == "__main__":
    main()
