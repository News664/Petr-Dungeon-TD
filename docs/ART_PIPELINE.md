# Character art pipeline

Status: the stage-per-picture approach, transparent cut-outs, canvas size and crop are decided. The requirements for each picture are in `graphics/`.

## How the game uses the pictures

Each character has one picture per key solidification stage. The game chooses the picture from her solidification gauge (0–100) and her condition. The mapping is data in an art manifest (`src/art/manifest.ts`), so adding a character or a stage needs no code change.

```json
{
  "id": "ysolde",
  "stages": [
    { "key": "normal", "fromGauge": 0,  "file": "ysolde/normal.webp" },
    { "key": "early",  "fromGauge": 25, "file": "ysolde/early.webp" },
    { "key": "mid",    "fromGauge": 50, "file": "ysolde/mid.webp" },
    { "key": "late",   "fromGauge": 75, "file": "ysolde/late.webp" }
  ],
  "statue": "ysolde/statue.webp",
  "permanent": "ysolde/permanent.webp"
}
```

- The number of stages and their thresholds are free per character. Four living stages plus the statue is only an example.
- `permanent` is optional; without it the statue picture is used.
- Transitions between stages (crossfades now, generated in-between frames or animation later) are keyed by stage name, so they can be added without touching the stage pictures.

## Conventions

1. **Same canvas for every stage of one character.** Same pixel size, same framing, same pose anchor. Transitions only look right if the pictures line up. In practice: produce the later stages by editing the base picture, not from fresh prompts.
2. **Folder and names.** `public/art/characters/<character_id>/<stage_key>.webp`, lower case, no spaces. WebP keeps transparency.
3. **Masters stay out of git.** Keep full-resolution originals elsewhere. The repo gets web-ready WebP files.
4. **Canvas.** Portrait 2:3, 1024 × 1536, head and shoulders inside the top 1024 × 1024 square.
5. **Transparent cut-outs (decided).** Every character picture is the figure alone on a transparent background, so it can be placed over the guild, dungeon and battle screens. Generate on a plain, flat background and remove it, or generate with transparency directly; check the edges (hair, weapons, translucent cloth) at full size, because halos show up badly over dark screens. Soft shadows and glows belong to the game, not the picture.
6. **Crops.** Small portraits are cut from the top square automatically. Sprites for the defense map are separate pictures.

## What to draw

The list of pictures the game needs, with sizes, prompts and delivery paths, is in `graphics/`: start with `graphics/README.md`. The canvas and crop rules that were open here are settled there (1024 × 1536, face in the top square).

## Adding a character's art

1. Put her pictures in `public/art/characters/<id>/`.
2. Add an entry to `public/art/manifest.json` with the same `"id"`.
3. Reload.

The game looks for an adventurer's pictures in this order:

1. An entry whose id is her name in lower case (for example `ysolde`).
2. An entry whose id is her class in lower case (`guardian`, `gunner`, `alchemist`, `medic`).
3. The built-in class emblem.

So four class sets are enough to give every adventurer a picture, and named characters can be added one at a time. Each champion belongs to one class; the cast is in `config/balance.json` under `roster.champions`.

A manifest with mistakes is ignored as a whole and the problems are printed in the browser console.

## Not built yet

- Portraits are shown small and square, cropped from the top of the picture. There is no full-figure view yet, and no transition between stages.
- Monster, place, icon and goddess pictures have delivery paths in `graphics/asset_list.json`, but the game does not load them yet. They will be wired in as they arrive.
- No image conversion script: files must already be web-ready.
- The class emblems that stand in for missing art are placeholders, not a proposal for the final look.
