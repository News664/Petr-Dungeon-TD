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

Twenty-four champions, six to a class. They come from many different worlds, so their dress and features should come from many different traditions; no single culture's fantasy should dominate, and each design should be an original one inspired by a tradition, not a costume of it. These are starting points: change anything. The names, epithets and traits live in `config/balance.json` under `roster.champions`.

| Name | Class | Epithet | Starting idea |
|---|---|---|---|
| Kaede | Guardian | the Unmoved | Composed woman in her thirties, black hair in a high tail, layered lamellar armour in dark lacquer, tall rectangular shield |
| Ingrid | Guardian | Shieldwall | Tall broad woman in her forties, braided fair hair, mail under a fur-collared cloak, round shield with iron boss |
| Adaeze | Guardian | the Bulwark | Strong woman in her forties, dark skin, close-cropped hair, bronze-scaled cuirass over indigo cloth, broad oval shield |
| Meilin | Guardian | Iron Lotus | Lean woman in her late twenties, hair pinned up, fitted brigandine with jade-green cord, long-handled blade and a small buckler |
| Zarina | Guardian | the Gatekeeper | Weathered woman in her fifties, headscarf under a steel cap, quilted long coat with patterned hem, tower shield |
| Itzel | Guardian | Stonebreaker | Stocky woman in her thirties, brown skin, hair bound with woven cord, padded armour with turquoise beads, heavy maul |
| Haruka | Gunner | the Longshot | Calm woman in her twenties, long dark hair tied low, fitted travelling coat with wide sleeves bound back, very long slender rifle |
| Yevgenia | Gunner | Winter's Eye | Pale woman in her thirties, fur hat, white-grey greatcoat, scoped rifle wrapped in cloth strips |
| Sooah | Gunner | Quickdraw | Slight quick woman in her twenties, short bobbed hair, cropped riding jacket, two short carbines |
| Leilani | Gunner | the Wayfinder | Sun-browned woman in her thirties, long wavy hair with a shell clasp, light open coat over wrapped cloth, harpoon-rifle |
| Amira | Gunner | Falcon | Keen-eyed woman in her late twenties, headscarf, leather falconer's glove, long desert coat, ornate long musket |
| Catalina | Gunner | Last Round | Elegant woman in her fifties, silver-streaked dark hair, embroidered short jacket and sash, paired pistols |
| Rin | Alchemist | Emberhand | Energetic woman in her twenties, hair tied up with a cloth band, soot-marked work coat with rolled sleeves, belt of paper-wrapped charges |
| Priya | Alchemist | the Distiller | Graceful woman in her thirties, long braid, layered wrap in deep violet, glass vials sewn into a sash |
| Noor | Alchemist | Lamp of Glass | Thoughtful woman in her forties, round spectacles, headscarf, long robe with ink-stained cuffs, lantern of coloured glass |
| Xiulan | Alchemist | Jade Smoke | Nimble woman in her twenties, hair in two coiled buns, high-collared short robe, gourd flasks on a cord, long pipe |
| Brigid | Alchemist | the Tinker | Red-haired woman in her thirties, soot-smudged, leather tinker's harness hung with tools, brass sprayer on her back |
| Thandiwe | Alchemist | Rainmaker | Tall woman in her forties, dark skin, beaded headband, patterned wrap over a work apron, clay jars in a net bag |
| Aiko | Medic | Gentle Hand | Warm woman in her thirties, hair in a low bun, pale layered robe tied back for work, medicine box on a shoulder strap |
| Sigrun | Medic | Battle Surgeon | Weathered woman in her forties, braids, rolled sleeves with tattooed forearms, leather surgeon's roll, short axe at her belt |
| Ngozi | Medic | the Blessing | Serene woman in her forties, dark skin, headwrap, flowing white-and-teal robe, string of small bells |
| Haeun | Medic | Still Water | Young woman in her early twenties, cropped hair, short padded jacket over a long skirt, oversized satchel |
| Paloma | Medic | the Dove | Cheerful plump woman in her thirties, kerchief, apron over a travelling dress, flask of cordial and a basket |
| Anahera | Medic | Dawn Watch | Tall woman in her thirties, long dark hair, woven cloak with a feathered collar, carved staff with a ward-lantern |

Deliver to `public/art/characters/<name>/<stage>.webp` with the name in lower case, and use the lower-case name as the manifest id.

## Who is not on the list

Emergency summons are random and temporary and never get pictures of their own; they use the class designs. No character from an existing game, series or other work is requested, here or anywhere in this folder.

## Must be true of every character picture

- An adult woman, clothed for dangerous work. See the style guide's section on characters.
- As a statue she is whole: nothing chipped, cracked or missing, at any stage.
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
