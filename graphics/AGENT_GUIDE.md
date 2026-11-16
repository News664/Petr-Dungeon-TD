# Guide for an image-generation agent

You are here to make pictures for a game called The Last Sanctuary. This file and the others in `graphics/` are everything you need. You do not need to read the game's code, and you should not change it.

## Your scope

| You may | You may not |
|---|---|
| Read everything in `graphics/` | Change anything in `graphics/`, `src/`, `config/`, `docs/`, `lore/` or the workflows |
| Read `lore/` for background, if you want it | Add characters, monsters or places that are not in `asset_list.json` |
| Add picture files under `public/art/`, at the exact paths given | Add any other kind of file, or put pictures anywhere else |

If a requirement seems wrong or impossible, do not work around it. Say so to the person you are working with, and make the pictures that are not affected.

## What to make

`asset_list.json` lists every picture the game wants. Each entry has:

| Field | Meaning |
|---|---|
| `id` | A name for the picture |
| `priority` | 1 first, then 2, then 3 |
| `used_in` | Where the game shows it |
| `size` | `[width, height]` in pixels. Exact. |
| `transparent` | `true` means the background must be fully transparent |
| `deliver_to` | The exact path and file name to save it under |
| `prompt` | A starting prompt. It already includes the shared style. |
| `negative` | Things that must not appear |
| `manifest_id`, `stage` | For characters only: which character and which solidification stage |

Work in priority order. Within priority 1, finish one character's whole set of stages before starting the next character.

Before making anything, read `STYLE_GUIDE.md`. For the group you are working on, read its brief in `briefs/`.

## Rules that are checked automatically

Every change is checked by a script. A picture that breaks one of these fails the check:

1. **Exact size.** The pixel size must equal `size`. Resize or pad before delivering; do not deliver "close enough".
2. **Exact path.** Lower case, no spaces, exactly `deliver_to`. A file with any other name or in any other folder is reported as unknown.
3. **Format.** WebP is preferred. PNG is accepted at the same path with `.png` in place of `.webp`. Nothing else.
4. **Complete enough to show.** A character folder must contain at least `normal` and `statue`. Until both are there the game shows none of her pictures.

## Rules that a person will check

These cannot be checked by a script, and they matter more.

- **Every character is an adult woman, clothed for her work.** No nudity, no sexualised pose or framing, nobody who looks underage.
- **Original designs only.** Nothing that resembles a character from an existing game, series, film or other work, and no real person.
- **A statue is whole.** A person turned to stone is never cracked, chipped, broken or missing a part, at any stage. Only her clothing and gear may look worn.
- **No gore.** Solidification is a change of substance, not an injury.
- **Stages line up.** All stages of one character share the same canvas, pose, outfit and framing. Only the stone and her expression change.
- **Face position.** Head and shoulders inside the top 1024 × 1024 square of a 1024 × 1536 canvas, face centred. The game crops that square for small portraits.
- **Clean transparency.** No halo, no leftover background, no shadow on the ground, no glow baked around the figure.
- **No text, logos, signatures or watermarks.**

## How to make a character's stages line up

1. Generate `normal`. Get it right before going on.
2. Make `early` by editing `normal`: change only the areas the stage description says have turned.
3. Make `mid` from `early`, `late` from `mid`, and `statue` from `late`, widening the changed area each time.
4. Lay each stage over `normal` at half opacity and confirm the outlines match.

Generating each stage from a fresh prompt will not line up. Always edit the previous stage.

## Delivering

**If you can write to the repository:**

1. Work on a branch named `art/<short-description>`, for example `art/guardian-class-set`.
2. Add only picture files under `public/art/`.
3. Open a pull request. In its description list the `id` of every picture added, and note anything you were unsure about.
4. The check runs on the pull request. If it reports a problem, fix the picture and push again.

**If you cannot write to the repository:** give the pictures to the person you are working with, each named with the last part of its `deliver_to` path and grouped in folders matching the rest. They will upload them.

You never need to edit a manifest or any other data file. The game builds its list of pictures from the files that are present.

## Checking progress

Someone with the repository checked out can run:

```bash
npm run art:check
```

It prints how many pictures of each priority are delivered, the next ones to make, and any problems. Add `-- --next 30` to see more of the queue.

## When in doubt

- If the prompt and the brief disagree, the brief wins. If the brief and the style guide disagree, the style guide wins. If any of them disagrees with the rules in this file, this file wins.
- If a prompt produces something that breaks a rule above, change the prompt. The prompts are starting points; the rules are not.
- If you cannot meet a requirement, skip that picture and report it.
