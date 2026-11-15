# Characters

## What these pictures are for

Adventurers appear in the roster, the labyrinth party list, combat orders, and the reserve tray in defense battles. Today the game shows them small and square, cropped from the top of the picture; a larger view is planned. The same picture set must work for both, which is why the face position is fixed (see `../README.md`).

Each character needs one picture per solidification stage. The game switches picture as her gauge rises, so the stages must line up exactly: same canvas, same pose, same outfit, same framing. Only the stone and her expression change. Stage definitions are in `../STYLE_GUIDE.md`.

## Order of work

1. **Four class designs** (priority 1). These stand in for every adventurer of that class until she has pictures of her own. Five stages each (`normal`, `early`, `mid`, `late`, `statue`), plus an optional `permanent`.
2. **Named characters** (priority 3). Every name belongs to one class, so a name is always the same person. Do them one at a time, in any order; each one replaces the class design for that character only.

## Class designs

| Class | Accent | Design |
|---|---|---|
| Guardian | steel blue | Broad-shouldered woman in her thirties, short practical hair, layered padded armour with dull steel plates, large shield slung on her back, steel-blue sash |
| Gunner | amber | Lean woman in her late twenties, hair tied back, long weatherproof coat, long-barrelled crystal-lock rifle held at rest, amber lens over one eye |
| Alchemist | violet | Woman in her forties, ink-stained gloves, apron-coat hung with stoppered flasks and tools, satchel, violet lining to her coat |
| Medic | teal | Woman in her thirties, calm face, pale layered robes cut for travel, satchel of salves, a small ward-crystal lantern at her belt glowing teal |

Deliver to `public/art/characters/<class>/<stage>.webp` with the class name in lower case, and use that lower-case class name as the manifest id.

## Named characters

One line each to start from. These are proposals: change anything, including the names (the name lists are in `config/balance.json` under `roster.names_by_class`).

| Name | Class | Starting idea |
|---|---|---|
| Rhosyn | Guardian | Veteran shield-bearer, greying braid, old scar on her jaw, dented tower shield |
| Havela | Guardian | Tall and young, cropped fair hair, mismatched salvaged plates, eager |
| Tamsin | Guardian | Stocky, dark skin, shaved sides, hammer at her belt, former mason |
| Brisa | Guardian | Wiry, wind-burned, fur-collared coat over mail, mountain patrol |
| Edda | Guardian | Broad, in her fifties, heavy cloak, round shield painted with a faded sun |
| Petra | Guardian | Quiet, long black hair bound in cord, lacquered lamellar armour |
| Ysolde | Gunner | Sharp-eyed, auburn hair in a tail, long grey coat, brass-bound rifle |
| Okka | Gunner | Short, cheerful, goggles pushed up, patched jacket, short carbine |
| Quenby | Gunner | Tall, dark skin, close-cropped hair, hunter's leathers, long rifle wrapped in cloth |
| Wren | Gunner | Slight, freckled, scarf over nose and mouth, scout's cloak |
| Calla | Gunner | Elegant, silver-streaked hair, duelling coat, paired pistols |
| Zofia | Gunner | Heavy-set, braided crown, bandolier, wide-brimmed hat |
| Aurel | Alchemist | Scholarly, round spectacles, ink-stained cuffs, book chained at her hip |
| Idris | Alchemist | Lean, brown skin, headscarf, glass vials sewn into a sash |
| Velka | Alchemist | Pale, white-blonde, burn-scarred hands, heavy leather apron |
| Nimue | Alchemist | Dreamy, long dark hair with dried flowers, herb bundles and a copper still on her back |
| Sorrel | Alchemist | Red-haired, soot-smudged, tinker's harness of tools |
| Castane | Alchemist | Stern, in her fifties, high collar, precise glass instruments |
| Oriel | Medic | Gentle, golden-brown skin, hair wrapped in pale cloth, lantern staff |
| Maren | Medic | Weathered sailor-surgeon, rolled sleeves, tattooed forearms |
| Linnet | Medic | Young, small, cropped hair, oversized satchel |
| Thessaly | Medic | Tall, grave, long grey robes, silver circlet |
| Mirelle | Medic | Warm, plump, apron over travelling dress, flask of cordial |
| Ember | Medic | Copper-haired, burn-scarred cheek, practical field kit, steady gaze |

Deliver to `public/art/characters/<name>/<stage>.webp` with the name in lower case, and use the lower-case name as the manifest id.

## Must be true of every character picture

- An adult woman, clothed for dangerous work. See the style guide's section on characters.
- Transparent background with clean edges: check hair, straps and anything translucent against a dark backdrop.
- Head and shoulders inside the top square of the canvas, face centred.
- Nothing cropped at the sides: weapons and shields stay inside the canvas.
- No cast shadow on the ground, no glow baked around the figure. The game adds light.

## Workflow that keeps stages aligned

1. Generate and approve the `normal` picture.
2. Produce `early` by editing `normal` (inpainting or image-to-image at low strength), masking only the areas that turn.
3. Produce each later stage from the one before it, widening the mask.
4. Produce `statue` last: everything stone.
5. Overlay each stage on `normal` at half opacity to check that outlines match before delivering.

## Later, not now

- Expressions for dialogue, wounded variants, and battle sprites are not requested yet.
- Transitions between stages will be made in the game (crossfades first). In-between frames are not needed.
