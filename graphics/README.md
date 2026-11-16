# Art requirements

This folder says what pictures the game needs, in a form an image-generation tool (or an artist) can work from. Nothing here is shipped with the game: finished, web-ready files go in `public/art/`.

## How to use it

1. Read `STYLE_GUIDE.md` once. Every prompt in this folder assumes it.
2. Pick assets from `asset_list.json`, lowest `priority` number first. Each entry has an id, where it is used, the canvas, whether it needs transparency, the file to deliver, and a prompt.
3. The files in `briefs/` explain each group in prose: what the picture is for, what must be true of it, and what to avoid.
4. Save each finished picture at the `deliver_to` path given in the list.
5. For characters, add an entry to `public/art/manifest.json` (format in `docs/ART_PIPELINE.md`). The game then shows the pictures with no code change.

The prompts are starting points. Change wording freely; keep the constraints.

## What is in here

| File | Contents |
|---|---|
| `STYLE_GUIDE.md` | Art direction: mood, palette, rendering, how solidification looks, what to avoid |
| `asset_list.json` | Every requested asset, machine-readable |
| `briefs/01_characters.md` | Adventurers: four class designs, 24 named characters, the solidification stages |
| `briefs/02_enemies.md` | Monsters of the labyrinth and of the defense battles |
| `briefs/03_places.md` | Labyrinth textures, battle map pieces, screen backgrounds |
| `briefs/04_interface.md` | Icons, emblems, frames |
| `briefs/05_people_and_key_art.md` | The goddess, guild residents, title and story illustrations |

## Delivery rules

| Rule | Value |
|---|---|
| Character canvas | 1024 × 1536 px, portrait, figure from head to mid-thigh |
| Face position | Head and shoulders inside the top 1024 × 1024 square, face centred horizontally. The game crops this square for small portraits. |
| Background | Transparent for characters, monsters, structures and icons. Painted for places and key art. |
| Master format | PNG with alpha channel. Keep masters outside git. |
| Game format | WebP (keeps transparency), same pixel size as the master unless noted |
| Tileable textures | 512 × 512 px, seamless on all four edges |
| Naming | Lower case, no spaces, exactly the `deliver_to` path |
| Stages | Every stage of one character has the same canvas, pose and framing. Produce later stages by editing the `normal` picture. |

## Priorities

1. **Priority 1** makes the prototype look like a game: the four class designs with all stages, the monsters, the goddess, the class and resource icons.
2. **Priority 2** gives it places: labyrinth textures, battle map pieces, title art, the Collector, and the first statue props for the labyrinth.
3. **Priority 3** is the long tail: the 24 named characters, residents, story illustrations.

A named character without her own pictures uses her class's pictures, so priority 3 can arrive one character at a time.

## Changing the requirements

These briefs are drafts written from the game's current needs. If the art direction changes, edit `STYLE_GUIDE.md` first and the prompts second; the technical rules above are the part the game depends on.
