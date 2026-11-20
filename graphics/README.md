# Art requirements

This folder says what pictures the game needs, in a form an image-generation tool (or an artist) can work from. It is written to stand on its own: someone who reads only this folder can do the work. Nothing here is shipped with the game: finished, web-ready files go in `public/art/`.

## How to use it

**If you are an image-generation agent:** read `AGENT_GUIDE.md`. It says what you may touch, how to deliver, and which rules are checked.

**If you are a person working with one:**

1. Give the agent read access to this folder. It needs nothing else.
2. It works through `asset_list.json`, lowest `priority` number first, and saves each picture at its `deliver_to` path under `public/art/`.
3. If it cannot write to the repository, upload its pictures yourself: on GitHub, open the target folder under `public/art/` (create it by typing the path when adding a file), choose "Add file → Upload files", and commit. Keep the exact file names.
4. Run `npm run art:check` to see progress and problems. The same check runs on every push and pull request.
5. Nothing else needs editing. The game finds the pictures when it is next built, and the playtest page shows them after the next deploy.

The prompts are starting points. Change wording freely; keep the constraints.

## What is in here

| File | Contents |
|---|---|
| `AGENT_GUIDE.md` | Instructions for an image-generation agent: scope, rules, delivery |
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
| Character canvas | About 1024 × 1536 px, portrait 2:3, figure from head to mid-thigh. Larger is fine; the build scales it. |
| Face position | Head and shoulders inside the top 1024 × 1024 square, face centred horizontally. The game crops this square for small portraits. |
| Background | Transparent for characters, monsters, structures and icons. Painted for places and key art. |
| Master format | PNG with alpha channel. Keep masters outside git. |
| Game format | WebP (keeps transparency) or PNG at the same path. Any size of the right shape: the build scales pictures down to the target size. |
| Tileable textures | 512 × 512 px, seamless on all four edges |
| Naming | Lower case, no spaces, exactly the `deliver_to` path |
| Stages | Every stage of one character has the same canvas size, pose and framing. Produce later stages by editing the `normal` picture. |

## Priorities

1. **Priority 1** makes the prototype look like a game: the four class designs with all stages, the monsters, Sakuya, the class and resource icons.
2. **Priority 2** gives it places: labyrinth textures, battle map pieces, title art, Iwanaga, and the first statue props for the labyrinth.
3. **Priority 3** is the long tail: the 24 named characters, residents, story illustrations.

A named character without her own pictures uses her class's pictures, so priority 3 can arrive one character at a time.

## Changing the requirements

These briefs are drafts written from the game's current needs. If the art direction changes, edit `STYLE_GUIDE.md` first and the prompts second; the technical rules above are the part the game depends on.
