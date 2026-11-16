# Style guide

## One sentence

A quiet, mournful fantasy world seen by lantern and ward-light: anime-influenced character art with painterly shading, where living colour is slowly giving way to pale stone.

## Mood

- **Dark, not grim.** Sorrow, stillness, resolve. No gore, no horror shocks, no cruelty played for effect.
- **Stillness is the threat.** The enemy of this world is things stopping: dust in shafts of light, empty rooms, figures that will never finish a gesture.
- **Warmth is small and precious.** Lantern amber, ward teal, a living face. Use warm light sparingly so it matters.

## Palette

The interface already uses these; art should sit comfortably next to them.

| Role | Colour | Use |
|---|---|---|
| Night ground | `#0d0f12`, `#15181d` | Backgrounds, deep shadow |
| Ward light | `#74c7b6` | Protective magic, safe places, the sanctuary |
| Lantern amber | `#d8a64a` | Fire, gathered resources, warnings |
| Blossom pink | `#f2b7cf` | Sakuya and her miracle only |
| Danger red | `#cf5f55` | Threats; use small |
| Pale stone | `#a3a8b0`, `#6d727a` | Solidified matter |
| Parchment | `#dcd8cf` | Text, pale cloth, highlights |

Class accents: Guardian `#6f9bd8` (steel blue), Gunner `#d8a64a` (amber), Alchemist `#b07fd8` (violet), Medic `#74c7b6` (teal). Each character carries her class accent somewhere visible (a sash, lining, lens, cord).

## Rendering

- Anime-influenced proportions and faces, semi-realistic bodies, painterly cel shading with soft gradients. Clean silhouettes that read at 40 px.
- One key light from upper left, cool rim light from the right. Consistent across all characters so they can stand side by side.
- Line work present but thin; colour does most of the work.
- Materials should be readable: worn leather, quilted cloth, dull steel, glass, ward-crystal.

## Characters

- Every character is an **adult woman**. Vary age (twenties to fifties), build, height, skin tone and hair. They come from many different worlds, so cultures and clothing traditions should differ: no single culture's fantasy should dominate the cast, and each design should be inspired by a tradition without being a costume of it.
- Practical clothing for dangerous work: layers, boots, belts, tools. Personality through detail, not through exposure. No sexualised poses, no nudity.
- Neutral standing pose facing three-quarters toward the viewer, arms away from the body enough that the silhouette is clear. The pose must hold up when frozen as a statue.
- Expression in the `normal` picture: composed, alert. Later stages change expression (see below).

## How solidification looks

This is the visual heart of the game, so it must be consistent.

- **Material.** Matte, pale grey-blue stone, like weathered limestone. Fine grain, no gloss. Clothing and gear turn with the body and keep their shape and folds.
- **Direction.** It starts at the extremities and edges (fingertips, hair ends, hems, boots) and closes toward the heart and face. The face is the last thing to turn.
- **Edge.** Where stone meets living matter there is a soft, slightly lighter boundary with fine veins of cold white light. No blood, no wounds, no cracks: this is a change of substance, not an injury.
- **Never damaged.** A statue of a person is always whole. No chips, breaks, missing parts or cracks, at any stage and however long she has stood. Only what she wore and carried decays.
- **Pose.** The body does not move between stages. Only what is still living can change: the eyes, the mouth, the tension in the face.

| Stage | Gauge | What has turned | Expression |
|---|---|---|---|
| `normal` | 0–24 | Nothing | Composed, alert |
| `early` | 25–49 | Fingertips, hair ends, hem and boots; a dusting on one shoulder | Aware of it; controlled concern |
| `mid` | 50–74 | Forearms, lower legs, most of the clothing, half the hair | Strain; breath held |
| `late` | 75–99 | Everything but the face, throat and the chest over the heart | Eyes still living; fear held down, or defiance |
| `statue` | 100 | Everything | Whatever the face showed at the last moment, in stone |
| `permanent` | lost | The same statue long abandoned. The figure is whole; dust lies on her, and her clothing and gear have worn soft and begun to crumble | Unchanged; time has passed |

`permanent` is optional. Without it the game shows `statue`.

## Other materials

Stone is the material of the first stratum and of every picture requested so far. Deeper strata may solidify in other media (ice, metal, glass are suggested in `lore/06_strata_outline.md`), but not early. One person is always one medium, never a mixture. Nothing made for stone would be wasted: other media would be extra late-stage and statue pictures, and the rules above (direction, edge, pose, never damaged) would apply to them unchanged.

## Sakuya and Iwanaga

The two goddesses are original characters who carry names from Japanese myth: the blossom princess and the rock princess, sisters. Their dress may draw on old Japanese court and shrine clothing (many layers, long sleeves, bound hair), designed fresh and not copied from any existing depiction.

- **Sakuya** keeps the sanctuary. Blossom pink is hers alone: petals, a flowering branch, soft light. She is fading, and it shows as her outline thinning into petals.
- **Iwanaga**, the Collector, should not look like a monster. She looks like someone who runs a great museum and has never once raised her voice: immaculate, austere, appraising. Her signs are rock, evergreen pine and a ring of keys; her colour is the cold white-violet that marks every solidifying creature.
- They are sisters and should look it: the same bearing, opposite warmth.

## Monsters

- Not people. Mineral, chitinous or hollow things native to a world of stone: they are immune to solidification because they are already half of it.
- Pale and dusty with one accent colour each, so they read against the dark labyrinth.
- Petrifying creatures share one visual sign: a cold white-violet glow in the eye or mouth.

## Places

- The labyrinth is old and built: galleries, cloisters, courts. Architecture half swallowed by pale mineral growth. Light sources are the party's lantern and occasional ward-crystal.
- The sanctuary is the only place with living colour: green, wood, cloth, warm windows, teal ward-light on its walls.

## Avoid

- Likeness to any existing game, series, character or real person.
- Text, logos, watermarks or signatures in the picture.
- Gore, wounds, nudity, sexualised framing.
- Characters who look underage.
- Busy backgrounds behind anything that must be cut out.
- Changing the pose, framing or outfit between stages of the same character.

## Shared prompt fragments

Use these so prompts stay consistent. `asset_list.json` already includes them.

- **Style:** `anime-influenced fantasy illustration, painterly cel shading, soft gradients, thin line work, muted desaturated palette with a single accent colour, key light from upper left, cool rim light, somber and quiet mood`
- **Variety:** `original design; dress and features drawn from a named real-world tradition as inspiration, not a costume of it`
- **Character framing:** `adult woman, standing three-quarter view, figure from head to mid-thigh, head and shoulders in the upper part of the frame, arms slightly away from the body, clear silhouette, transparent background, no text`
- **Negative:** `nudity, sexualised pose, child, gore, blood, wounds, text, watermark, logo, signature, busy background, extra limbs, likeness of existing characters`
