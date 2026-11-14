# Character art pipeline (proposal)

Status: proposal. The conventions marked **Decide** should be confirmed before art is produced in bulk; changing them later means redoing files.

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
2. **Folder and names.** `public/art/characters/<character_id>/<stage_key>.webp`, lower case, no spaces.
3. **Masters stay out of git.** Keep full-resolution originals elsewhere. The repo gets web-ready WebP files.
4. **Decide: canvas size and shape.** Suggested: portrait 2:3, masters at least 1024×1536.
5. **Decide: background.** Transparent cut-outs can be placed over the guild, dungeon and battle screens. Pictures with painted backgrounds can only be shown as framed cards. This affects how every picture is generated.
6. **Decide: which crops are needed.** A full figure can be cropped automatically to a bust and a face thumbnail if the manifest records where the face is. Separate small sprites for the defense map would be extra pictures.

## Not built yet

The manifest format and the stage lookup exist and are tested. Nothing displays portraits yet, there is no image conversion script, and roster characters are not linked to art entries.
