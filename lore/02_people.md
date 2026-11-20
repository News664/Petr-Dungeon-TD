# People

## The guild master

**Fixed.** The player: a woman, the last summoner, who leads the guild. She makes the tactical decisions for expeditions and defenses but does not fight in person. She directs an organisation, not a single hero.

**Fixed.** The champions call her "Master", or by a name the player enters at the start (up to 16 characters).

**Fixed.** If the sanctuary falls she is not killed. Iwanaga sets her into the seal as a statue that goes on summoning, forever, for the collection.

**Proposed.** She was the youngest keeper of the seal when the others turned. She is not a chosen one. She is the one who was left, and she is learning the work as she does it. The game never shows her face.

## Sakuya

See `01_world.md`. She speaks at the campaign's turning points.

**In the game now.** Her words, and Iwanaga's one message, are in `content/stories.json`. Each is told once, when its moment first happens, and can be reread from "Words spoken" in the guild view.

| Moment | Story id | Written |
|---|---|---|
| Opening | (the prologue screen) | Yes |
| Before the first defense, and during it | (hints on the battle screen) | Yes |
| The first Still Tide is held | `first_tide_held` | Yes |
| The frontier falls and she spends the Flowering | `flowering` | Yes |
| The frontier falls and she cannot | `no_flowering` | Yes |
| The garden is held through a siege | `siege_held` | Yes |
| The Flowering is ready again | `flowering_returns` | Yes |
| A champion is lost for good for the first time | `first_lost` | Yes |
| The Pale Galleries are secured | `stratum_1_secured` | Yes |
| The Keeper is laid to rest | `keeper_beaten` | Yes |
| The Keeper's charge is brought home | `the_first` | Yes |
| The party first enters the Cloister (Iwanaga speaks) | `stratum_2_entered` | Yes |
| The Drowned Cloister is secured | `stratum_2_secured` | Yes |
| The sanctuary falls | (the game-over screen) | Yes; Iwanaga's own words are not written |
| Each of the five first summons | — | No |
| A lost champion is carried home to the Still Grove | — | No |

## The residents

**Fixed.** A small remnant: artisans, engineers, workers. They run the extraction sites under wards and crew the sanctuary's defenses in a siege. They are hard to replace.

**Proposed.** Three of them deal with the player directly.

| Role | Place | Sketch |
|---|---|---|
| The quartermaster | Workshop | In her fifties, a builder by trade. Keeps the ledger. Counts everything twice and gives it away anyway. |
| The ward-keeper | Territory and wards | In her forties, precise and anxious. Trained as a lamp-priest of the goddess; now an engineer of crystal because someone had to be. |
| The physician | Recovery ward | Old. Has restored more statues than anyone alive and lost more than she will say. Talks to the statues while she works. |

**Open.** Their names.

## The four callings

Champions come from many worlds, but the work of the guild sorts them into four callings.

| Calling | In the labyrinth | On the walls | What kind of woman answers |
|---|---|---|---|
| Guardian | Stands in front, draws the blow, shields the rest | Holds a bunker; slows whatever she strikes | Someone who has already stood between harm and other people, and would again |
| Gunner | Strikes hard from behind the line; pierces armor | Long reach from a watchtower | Someone patient, who has learned to wait for one clear chance |
| Alchemist | Burns groups, strips armor, chills | Splash and corrosion | Someone who trusts what she can test, and tests everything |
| Medic | Mends wounds, pushes back the stone | Heals and steadies those near her | Someone who has kept people alive with too little, for too long |

## The champions

**Fixed.** The cast is original. Twenty-four women can answer the seal, six to each calling. Each has a name, an epithet that says what she is known for, and one trait that is hers alone. Champions of one calling share a skill tree; the trait, and small differences in attributes rolled when she is summoned, are what set two of them apart. At the seal the player chooses whom to call. Each can be called only once.

**Fixed.** They come from many different worlds, and their names and dress should show it. No single culture's fantasy should dominate.

**Fixed.** Emergency summons are not on this list. They are strangers with made-up names and no trait, here for two weeks and gone.

**Proposed.** The individuals. Names, epithets, traits and the few lines about each are in `config/balance.json` under `roster.champions`, and the game shows them on her sheet and at the seal. Change them there; this table is a copy.

| Name | Calling | Epithet | Trait | Who she is |
|---|---|---|---|---|
| Kaede | Guardian | the Unmoved | Rooted | From a world of mountain clans. She held a pass alone for three days so a village could get away, and answered the seal on the fourth, when there was nothing left to hold. Speaks seldom, and never twice. |
| Ingrid | Guardian | Shieldwall | Wallborn | The last of a longship's crew, called from a cold sea in the hour the ship went down. Loud, warm, and quick to laugh at herself. Stands wherever the line is thinnest because someone has to. |
| Adaeze | Guardian | the Bulwark | Hardy | Captain of a city wall that outlasted its city by a winter. Counts everyone twice, at dawn and at dusk, and does not sleep until both counts match. |
| Meilin | Guardian | Iron Lotus | Poised | A temple guard from a world of river kingdoms who left when the temple stopped needing guarding. Precise, courteous, faintly amused by everything. Calls the guild master 'abbess' by mistake and does not correct it. |
| Zarina | Guardian | the Gatekeeper | Watchful | Kept the gate of a desert caravanserai for twenty years. Has seen every kind of trouble arrive politely and every kind of friend arrive late. Offers tea to people who are about to fight her. |
| Itzel | Guardian | Stonebreaker | Heavy hand | A quarry foreman's daughter from a world of terraced cities. Knows where stone cracks and where it does not, which makes her uneasy about the Stilling in ways she will not explain. |
| Haruka | Gunner | the Longshot | Far sight | A festival archer who took up the long gun when her world stopped having festivals. Patient, gentle, and the best shot in the guild. Keeps a ribbon from the last festival tied to her rifle. |
| Yevgenia | Gunner | Winter's Eye | Cold patience | From a world of long winters. Once waited two days in snow for one shot, and still thinks it was worth it. Dry, precise, and kinder than she sounds. |
| Sooah | Gunner | Quickdraw | Fast hands | A courier who learned to shoot from the saddle and never learned to stand still. Talks fast, eats fast, and is always the first to volunteer for anything that involves running. |
| Leilani | Gunner | the Wayfinder | Light pack | A navigator from an island world who reads corridors the way she read currents. Hums when she is lost, which is rarely, and when she is not lost, which is often. |
| Amira | Gunner | Falcon | Marksman | A falconer's apprentice turned sharpshooter in a city of towers. Whistles when she aims, a habit from calling birds. Misses her falcon more than anything else she left behind. |
| Catalina | Gunner | Last Round | Grit | A duellist from a world of salt ports, older than she ever expected to be. Elegant, tired, and kind. Has outlived every rival she had and does not count it as winning. |
| Rin | Alchemist | Emberhand | Hot mix | A fireworks maker from a world of lantern towns. Misses the crowds more than the fireworks. Treats every fight as a show with a terrible audience. |
| Priya | Alchemist | the Distiller | Deep stores | A perfumer turned field chemist from a world of spice roads. Still wears scent, on principle. Believes most problems can be solved by distilling them carefully enough. |
| Noor | Alchemist | Lamp of Glass | Clear head | The scholar daughter of a family of glassblowers. Wants to understand the Stilling more than she fears it, which frightens everyone else more than the Stilling does. |
| Xiulan | Alchemist | Jade Smoke | Quick mixer | An apothecary's runaway apprentice. Faster than she is careful and cleverer than she is patient. Has an opinion about every reagent in the ward and shares all of them. |
| Brigid | Alchemist | the Tinker | Siegecraft | A tinker from a world of iron hills, always in the middle of fixing something. Has rebuilt the guild's kettle twice and the frontier's gate hinge once, without being asked. |
| Thandiwe | Alchemist | Rainmaker | Wide burn | Called rain for her village for thirty years. Calls other things down now. Grave, generous, and the only person in the guild Iwanaga's letters seem to make angry. |
| Aiko | Medic | Gentle Hand | Healer's gift | A village healer who talks to her patients, including the ones who cannot answer. Sits with the statues in the ward at night and tells them what happened that day. |
| Sigrun | Medic | Battle Surgeon | Tough | A ship's surgeon who stitched people up on a moving deck. Steady hands, salt in her speech, and no patience at all for anyone who will not drink their water. |
| Ngozi | Medic | the Blessing | Ward-singer | Sang at births and burials in a world of wide plains. Sings in the labyrinth, very quietly, and claims it keeps the stone off. Nobody has proved her wrong. |
| Haeun | Medic | Still Water | Calm | The youngest in the guild: a field orderly promoted by attrition in a war she does not talk about. Organised to the point of terror. Keeps a list of everyone she has brought home. |
| Paloma | Medic | the Dove | Swift aid | An innkeeper's cook from a world of crossroads who learned medicine because someone had to. Feeds people first and treats them second, and is right about the order more often than not. |
| Anahera | Medic | Dawn Watch | Lamp-keeper | Kept a signal fire on a headland so the boats could find their way home. Answered the seal because it felt like a light she had been asked to keep. Calm, tall, and very hard to frighten. |

**Still needed for each:** a voice sample, and what she says when another champion is brought back as a statue.
