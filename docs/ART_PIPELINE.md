# Character art pipeline

Status: the stage-per-picture approach and transparent cut-outs are decided. Canvas size and crops (marked **Decide**) are still open; settle them before producing art in bulk, because changing them later means redoing files.

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
4. **Decide: canvas size and shape.** Suggested: portrait 2:3, masters at least 1024×1536.
5. **Transparent cut-outs (decided).** Every character picture is the figure alone on a transparent background, so it can be placed over the guild, dungeon and battle screens. Generate on a plain, flat background and remove it, or generate with transparency directly; check the edges (hair, weapons, translucent cloth) at full size, because halos show up badly over dark screens. Soft shadows and glows belong to the game, not the picture.
6. **Decide: which crops are needed.** A full figure can be cropped automatically to a bust and a face thumbnail if the manifest records where the face is. Separate small sprites for the defense map would be extra pictures.

## Adding a character's art

1. Put her pictures in `public/art/characters/<name>/`, where `<name>` is her name in lower case (for example `ysolde`).
2. Add an entry for her to `public/art/manifest.json` with `"id"` set to that same lower-case name.
3. Reload. Wherever she appears (roster, labyrinth party, combat orders, the reserve tray in battles) her picture replaces the class emblem, and it changes with her gauge and condition.

Names come from the `roster.names` list in `config/balance.json`. Change that list to match the characters you are drawing; a new summon takes a random unused name from it.

A manifest with mistakes is ignored as a whole and the problems are printed in the browser console.

## Not built yet

- Portraits are shown small and square, cropped from the top of the picture. There is no full-figure view yet, and no transition between stages.
- No image conversion script: files must already be web-ready.
- The class emblems that stand in for missing art are placeholders, not a proposal for the final look.
