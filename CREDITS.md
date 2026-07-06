# Credits

## Art

The in-game pixel-art sprites (hero, enemies, bosses, NPCs, chests, pickups,
world features, UI and status icons) are bespoke, hand-generated art made for
this project — no third-party sprite art. They are packed into a single base64
atlas embedded in the build to keep the game a self-contained set of static
files, and each sprite key maps to exactly one image (no fallback art).

Procedural terrain (walls, floors, water, lava) is drawn in code. Outdoor
scenery and indoor props come from the **[LPC]** (Liberated Pixel Cup) packs
(CC-BY-SA 4.0) — see [`docs/asset-credits.md`](docs/asset-credits.md) for the
full per-pack attribution.

The inventory/equipment panels also use the project's own hand-drawn vector icons.
