# Prototype assumptions and open questions

The design spec leaves some rules open and asks that each choice be logged. These are the choices made so far. All of them are easy to change; the numbers are in `config/balance.json`.

## Decisions made in M0

| Topic | Choice | Where |
|---|---|---|
| Clock | Whole hours. Sub-hour actions (dungeon steps, battle turns) add minutes that roll over into hours. | `time.ts` |
| Event order at one hour | Permanence, then treatment completion, then rebuild completion with its retrieval, then daily production, then the invasion. | `time.ts` |
| Invasions | When the attack is due, time stops and nothing but deployment changes is allowed until the battle is resolved. A long time-skip stops at the attack. | `time.ts`, `campaign.ts` |
| Sanctuary siege timing | The siege arrives 24 hours after the retreat (`clock.sanctuary_siege_delay_hours`). Only the sanctuary baseline ticks in between. | `campaign.ts` |
| Frontier lost | Only defenders who actually fell become statues. Survivors fall back to reserve. | `campaign.ts` |
| Miracle | Restores `ceil(fallen / 2)` of the defenders who fell in that battle; the player picks them. With no casualties nobody is restored, but the charge is still spent. | `campaign.ts` |
| Statues after a won frontier battle | Brought to the ward automatically (retrieval only, no revival), since the ground is held. | `campaign.ts` |
| Statues inside the sanctuary | Count as safely retrieved once the siege is won. | `campaign.ts` |
| Statues at a banished frontier (divine emergency) | Stay where they fell. A recovery sortie brings all of them back: it needs one idle adventurer and 8 hours (`campaign.frontier_recovery_sortie_hours`). | `time.ts` |
| Frontier never rebuilt | If the attack comes during counteroffensive preparation, it is another sanctuary siege. A rebuild that cannot finish before the attack is refused. | `campaign.ts` |
| Treatment cost | Fixed by exposure at the moment of retrieval, paid when queued. Two beds, 48 hours each. | `statues.ts` |
| Emergency production | Output and ward upkeep are both scaled to 20%. | `economy.ts` |
| Ward shortfall | A site that cannot pay its upkeep produces nothing that day and its workers shelter. Workers are never solidified automatically. The sanctuary baseline lets the economy recover from zero on its own. | `economy.ts` |
| Summoning | Eight free summons at the start (five plus three bonus). After that: cost plus a 14-day cooldown. Emergency summoning ignores the cooldown at a higher cost. Permanently lost adventurers free their roster place. | `roster.ts` |
| Party wipe | Statues stay in the labyrinth; a new expedition must secure them and return. Emergency summoning is the paid safety route if nobody is left. | `roster.ts` |
| Boss defeated | The stratum is secured at once and the frontier moves to the next stratum. The invasion schedule does not change. | `economy.ts` |
| Expeditions during a crisis | Possible whenever the frontier is held (stable, divine emergency, breakthrough). | `roster.ts` |

## Keys added to the balance file

`clock.sanctuary_siege_delay_hours`, `campaign.frontier_recovery_sortie_hours`, `roster.class_stats`, `resources.deposit_workers`, `defense.frontier_layout`, `defense.sanctuary_layout`, `defense.structure_max_hp`, `roster.names`, `roster.rest_hp_per_day`, `roster.rest_gauge_per_day`, `roster.rest_sp_per_day`, the whole `dungeon` section, and the battle values under `defense` (`ticks_per_second`, `reposition_seconds`, `repair_materials_per_10_hp`, `sanctuary_max_automated_ammo`, `ammo_restock`, `enemy_stats`, `structure_stats`, `class_combat`, `turret`). Map layouts and wave scripts are in `config/defense_maps.json`; labyrinth floors are in `config/dungeon_maps.json`.

## Decisions made in M1 (defense battles)

| Topic | Choice | Where |
|---|---|---|
| Simulation | Fixed 30 ticks per second, no randomness. The battle lives in the campaign state, so a mid-battle save resumes exactly. | `battle.ts` |
| Campaign time | A defense battle takes no calendar time. | `battle.ts` |
| Fewer slots than defenders | Intended: the frontier has seven slots for a roster of eight, so someone is always in reserve. More slots would come from upgrades. | `balance.json` |
| Structures | A structure multiplies its occupant's range and damage and sets how exposed she is to petrifying attacks (watchtower 100%, support station 50%, bunker 15%). Guardians get extra reach and damage in a bunker. | `balance.json` |
| Classes in defense | Gunner: long range, pierces armor. Alchemist: splash damage that also corrodes armor. Guardian: slows what she hits. Medic: eases the gauge and heals allies in reach, and fires only when nobody needs her. | `battle.ts` |
| Targeting | Each adventurer has a standing priority: nearest the gate, strongest, or petrifiers first. | `battle.ts` |
| Enemies | Runners only run. An armored brute halts beside the first manned structure in its reach, winds up, and batters it three times before moving on; it leaves empty structures alone. Petrifiers attack the most exposed defender in reach, filling her gauge and wounding her. | `battle.ts` |
| Solidified in battle | The moment the gauge reaches 100 or health reaches 0. Her post goes silent. | `battle.ts` |
| Wrecked structure | Its occupant falls back to reserve unharmed. Damage persists after the battle; repairs cost materials (1 per 10 points). | `battle.ts`, `roster.ts` |
| Deployment | Every battle opens with a deployment phase: no time passes and posts can be changed freely until the player begins. | `battle.ts` |
| Moving under fire | Once the fighting has begun, a defender posted or moved cannot act for 6 seconds. Withdrawing is immediate. | `roster.ts` |
| After a battle | All defenders stand down to reserve. Each remembers her post, and the next deployment can restore them in one step. | `campaign.ts`, `battle.ts` |
| Sounding the retreat | The player may concede: an immediate loss with no further casualties. | `battle.ts` |
| Gate | Starts every battle at full strength. | `battle.ts` |
| Sanctuary weapons | Three automated weapons, one unit of ammunition per shot. Ammunition does not regenerate; 10 units cost 6 materials, up to 100. | `battle.ts`, `roster.ts` |
| Rest | Each day, adventurers who are not on an expedition recover 40 health and lose 30 gauge. | `time.ts` |
| Waves | One fixed wave script per map (`config/defense_maps.json`). Attacks do not yet grow over the campaign. | `defense_maps.json` |

## Decisions made in M2 (labyrinth)

| Topic | Choice | Where |
|---|---|---|
| Maps | Hand-made grids in `config/dungeon_maps.json`: three floors, two gathering sites, one one-way gate, mist tiles, one roaming elite, one boss. | `dungeon_maps.json` |
| Time | A step takes 5 minutes, a combat round 10, gathering 30. Turning is free. | `dungeon.ts`, `combat.ts` |
| Charting | The party charts its own tile and the eight around it. The chart persists between expeditions. | `dungeon.ts` |
| Encounters | A hidden danger meter rises 4–9 per step and starts a fight at 100. Entrances, stairs and gathering sites are safe ground. In a secured stratum it rises at 30% of that. | `dungeon.ts` |
| Getting in and out | Enter at the entrance, or at the stairs of any floor already reached (one hour of walking per floor). Leave from the entrance or from stairs leading up, at the same cost. | `dungeon.ts` |
| Recall | The seal can pull the party home from anywhere outside a fight for 10 ward energy and 2 hours. | `dungeon.ts` |
| Loot | Gathered and looted resources are carried and only banked on return. A wiped party loses them. | `expeditionCore.ts` |
| Gathering | Each site can be worked once per 24 hours, and working it raises the danger meter. | `dungeon.ts` |
| One-way gate | Opens only when first entered from its far side, then stays open for every later expedition. | `dungeon.ts` |
| Roaming elite | Visible on the chart. Walks a fixed loop, one step per party step. Contact starts the fight. Once beaten it stays away for 7 days. | `dungeon.ts` |
| Combat rounds | One order per adventurer, then everything resolves in speed order. Guards and party-wide protections apply before anyone moves. An adventurer given no order guards. | `combat.ts` |
| Enemy behaviour | Each enemy follows a fixed move pattern, so its next move is always shown. Big attacks are preceded by a charge turn. Targets are picked with the seeded generator. | `combat.ts` |
| Rows | Melee attacks cannot reach the back row while anyone stands in the front row. A melee fighter in the back row deals half damage. | `combat.ts` |
| Damage | Attack power times the move's multiplier, minus the target's armor; no random variance. | `combat.ts` |
| Falling in the labyrinth | Health 0 or gauge 100 makes a statue on the party's tile. A rescue party must stand on that tile to secure her; each living member can carry one statue. | `combat.ts`, `dungeon.ts` |
| Party wipe | The expedition ends, carried statues drop where the party fell, loot is lost. | `expeditionCore.ts` |
| Fleeing | 60% in ordinary fights, 35% against the elite, impossible against the boss. A failed attempt gives the enemies a free round. | `combat.ts` |
| Growth | Experience from fights; a level needs 100 times the current level. Each level adds 10% health and 12% attack. All class skills are available from the start (no skill tree yet). | `combat.ts` |
| Skill points | Spent on skills, restored by 20 per day of rest. | `time.ts` |
| Mist | Each step onto a mist tile adds 8 gauge to everyone. | `dungeon.ts` |
| Invasion during an expedition | The expedition pauses until the battle is resolved; its members cannot defend. If the frontier falls for good, the party is called home with its loot. | `campaign.ts` |
| After the boss | The stratum is secured and the frontier moves on. The cleared stratum can still be entered. The second stratum has no map yet. | `dungeon.ts` |

## Decisions made in M3 (prologue and integration)

| Topic | Choice | Where |
|---|---|---|
| Prologue | A new game starts in a prologue phase: empty stores, five sponsored summons, the clock held still. Nothing outside the walls can be done. | `create.ts`, `campaign.ts` |
| First defense | A short three-wave battle on the sanctuary map that introduces each enemy once. The automated weapons use no ammunition in it. | `defense_maps.json`, `battle.ts` |
| Losing the first defense | The goddess turns the hour back: everyone is restored and the battle is offered again. It cannot end the game. | `campaign.ts` |
| After the first defense | Everyone is restored, the starter stockpile and three more sponsored summons are granted, and the first attack is scheduled seven days out. | `campaign.ts` |
| Hall capacity | The limit (eight at the time, now ten) counts adventurers fit to fight plus statues lying in the ward. A champion still out there as a statue holds no bed, so replacements can be summoned while she is missing; rescuing her is never refused, even if that leaves the hall over capacity. No summoning while the hall is at or over capacity. | `selectors.ts` |
| Saving | The game autosaves in the browser after every action outside a running battle. Quicksave and quickload are separate. | `App.tsx` |

## Decisions made in the growth and fortification iteration

| Topic | Choice | Where |
|---|---|---|
| Hall capacity | Raised to 10. Still counts fighters plus statues in the ward. | `balance.json` |
| Emergency summons | Temporary: she arrives at once, holds no place in the hall, and fades after 14 days. At most three at a time. If she is on an expedition or a post when her time comes, she holds on until she is back. Her gear returns to the armory. | `roster.ts`, `time.ts` |
| Skill trees | Each class has six nodes: its three active skills (known from the start at rank 1) and three passives. One point at summoning and one per level; three ranks per node; some passives need level 2 or 3. Each rank above the first adds 20% to a skill's main number, or one round to a buff. No way to take points back yet. | `growth.ts`, `balance.json` |
| Passives and both modes | Passives can raise attack, armor, speed, health, skill points, resistance to solidification, healing, and damage or reach on a defensive post. Healing and resistance apply in the labyrinth and on the walls. | `growth.ts`, `battle.ts`, `combat.ts` |
| Levels on the walls | Each level above the first adds 5% damage on a defensive post. | `battle.ts` |
| Equipment | Three slots (weapon, armor, charm). Made at the workshop from resources once the recipe is found: from the start, by reaching floor 2 or 3 on foot, by killing the elite, by killing the boss. Kept in an armory; changed only at the guild. A permanently lost or faded adventurer's gear returns to the armory. | `growth.ts` |
| Supplies | Three consumables made from reagent: heal, purge, restore skill points. An expedition packs up to three of each automatically and brings back what it does not use. A wiped party loses them. | `growth.ts`, `dungeon.ts` |
| Field menu | Between fights the party can use supplies and its healing and purging skills. Each use takes 5 minutes. | `dungeon.ts` |
| Supplies in a fight | Using one is that adventurer's action for the round. | `combat.ts` |
| Building defenses | Structures stand on building sites the player chooses. Each map has more sites than structures and a cap per type (frontier: 3 watchtowers, 2 bunkers, 2 support stations). Building and removing are free and happen while taking up positions or between battles, never during the fighting. | `fortify.ts`, `defense_maps.json` |
| Bare frontier | A new game starts with no frontier structures. The first deployment there is where they are placed; a "recommended layout" button builds the standard one. Ready-made debug states start with the standard layout. | `create.ts` |
| Sanctuary structures | Its four posts are fixed and cannot be removed. The player may add one watchtower and one bunker on the remaining sites. | `fortify.ts`, `balance.json` |

## Decisions made from the lore answers (16 November 2026)

The answers themselves are recorded in `lore/04_open_questions.md`. These are the rule changes that followed.

| Topic | Choice | Where |
|---|---|---|
| The player's name | Entered in the prologue, up to 16 characters, "Master" by default. Shown in the header and the game-over text. | `commands.ts`, `PrologueScreen.tsx` |
| Temporary champions | Emergency summons get a name put together from syllables, never one of the known characters. They use class art. | `roster.ts`, `balance.json` |
| Gear on a statue | Stays with her. Home with her if she is rescued; perished if she becomes permanent while abandoned. (Before, it returned to the armory.) | `statues.ts` |
| Memorial | A permanently lost champion can still be carried out of the labyrinth, or is brought in when the frontier she fell at is held. She stands in the memorial and stays lost. It has no effect on play: a buff would contradict the specification's first rule. | `statues.ts`, `dungeon.ts` |
| Wording | The game says "solidified", not "stone", so that other materials remain possible. | interface text |
| Existing characters | Not used. The roster, lore and art prompts contain only original characters. | — |
| Saves | Saves from the previous build load; the missing field is filled in. | `save.ts` |

## Decisions made in the cast iteration

| Topic | Choice | Where |
|---|---|---|
| The cast | Twenty-four original champions in `roster.champions`, six to a class, with names drawn from many traditions. Each has an epithet and one fixed trait (a small bundle of stat changes). | `balance.json`, `roster.ts` |
| Choosing | The seal lists the champions who have not yet answered; the player picks one. Each can be summoned once, ever. Asking only for a class picks one at random. | `roster.ts`, `SidePanels.tsx` |
| Aptitudes | On summoning, health (±8), attack (±2), armor (±1), speed (±1) and skill points (±3) are each rolled once and kept. | `roster.ts`, `balance.json` |
| Standard cast | Ready-made debug and test campaigns summon champions with no trait and no aptitude rolls, so their numbers stay exact. Real campaigns (started from the prologue) use both. | `create.ts` |
| Emergency summons | Strangers: a made-up name, no epithet, no trait; aptitudes are rolled. | `roster.ts` |
| Medium | Every champion and statue carries a medium. Whatever first raises her gauge decides it until the gauge is back at zero. A stratum declares its medium; the first is stone, and attackers carry the frontier stratum's medium. Nothing else uses it yet. | `growth.ts`, `dungeon_maps.json` |
| Goddesses | Sakuya and Iwanaga in all game text. Sakuya's colour changed from violet to blossom pink. | interface text, `styles.css` |

## Decisions made in the first-stratum expansion

| Topic | Choice | Where |
|---|---|---|
| Floor 1 | Widened with an east wing: a key room, and a locked store holding a one-time cache. | `dungeon_maps.json` |
| Keys and locks | A floor's key opens that floor's locked door for good. | `dungeon.ts` |
| Floor 2 | Two dust traps, and a secret door to the Keeper's rooms. | `dungeon_maps.json` |
| Traps | A plate adds 14 gauge to everyone and raises the danger meter by 30. It springs once per expedition and is drawn on the chart as soon as the party has seen the tile, so it can be walked around. | `dungeon.ts` |
| Floor 3 | An exhibition hall of statues (scenery, solid), a statue holding the boss approach's short door open, and a baited side room. The old short way to the boss is walled; the long way round always remains. | `dungeon_maps.json` |
| Carrying the long lost home | A statue standing beside the party can be taken up; it uses one member's carrying place. On return it joins the memorial as one of the nameless. It gives nothing. If the party is wiped, she is set back where she stood. | `dungeon.ts`, `expeditionCore.ts` |
| The held door | Taking the statue that holds it shuts the door for good, and her niche closes with it. | `dungeon.ts` |
| Bait | Stepping into the side room on floor 3 starts a fixed, hard fight once. Behind it is a clue. | `dungeon.ts` |
| The hidden Keeper | The clue from floor 3 opens the secret door on floor 2. She cannot be fled, moves first, and her "Rearrange" swaps the party's front and back rows. Beating her does not secure the stratum; it unlocks a charm recipe. | `combat.ts`, `balance.json` |
| Rebalance | A level now needs 115 experience per current level (was 100). The Warden has 800 health and 44 attack; the Colossus 1050 and 45. | `balance.json` |

## Decisions made for terms, the Keeper's charge and art delivery

| Topic | Choice | Where |
|---|---|---|
| Terms | The game's text says the Flowering (miracle), blossom-light (ward energy), the Blossom Seal, the Last Garden, the Still Grove (memorial), the Still Tide (the weekly attack) and "a blossom out of season" (emergency summon). Rules and code keep the plain names. | interface and log text |
| The Keeper's charge | A prized statue stands behind the Keeper. It can be taken only after she is beaten, uses a carrying place, and on reaching home unlocks a story from Sakuya. It gives nothing else. The quest line it points to does not exist yet. | `dungeon.ts`, `expeditionCore.ts`, `stories.ts` |
| Stories | Unlocked stories are kept in the campaign and can be reread from the Still Grove panel. Their text lives in the interface, not the rules. | `stories.ts` |
| Art manifest | Generated from the files under `public/art/` before every `dev` and `build`; not committed and never edited by hand. PNG is accepted in place of WebP. | `scripts/art-manifest.mjs` |
| Art check | `npm run art:check` compares delivered pictures with `graphics/asset_list.json` and fails on an unknown file, a non-picture file, or a character set without both `normal` and `statue`. Size is not checked strictly: a different shape, a very small or very large file, or stages of one character at different sizes are reported as advice. It runs in CI. | `scripts/art-check.mjs` |
| Art sizes | The build scales any delivered picture larger than its target down to fit (keeping its shape; never enlarged or cropped). The displayed size is set by the interface, so any size works. | `scripts/art-optimize.mjs` |

## Decisions made for the second stratum

| Topic | Choice | Where |
|---|---|---|
| The Drowned Cloister | Three floors: the Flooded Narthex, the Cloister Walk (with a roaming elite, the Bellringer, and a trap), and the Still Chapel (the Abbess of Still Water). Medium: stone. | `dungeon_maps.json` |
| Tide | The stratum's water is low for six hours in every twelve (06:00–12:00 and 18:00–24:00). Corridors marked as flooded can be entered only at low tide. The way onward on every floor is dry; the water guards shortcuts and the second floor's gathering hall. A party standing in a corridor when the water rises is not harmed. | `dungeon.ts` |
| Ice | The lower two floors of the Cloister have frozen floor. A party that steps onto it slides on in the same direction until it reaches a tile that is not ice (and stops there) or the last ice before anything it cannot or should not enter: wall, statue, closed water or gate, a boss, a roaming elite. The whole slide is one step: one step's time and one step of danger. The dry way to the Abbess runs over the ice. | `dungeon.ts` |
| Speech | An enemy may have lines; one is spoken at the start of each round until they run out. The Abbess has five. | `combat.ts`, `balance.json` |
| Entering | With more than one stratum charted, an expedition chooses which to enter; the default is the frontier. | `dungeon.ts`, `RosterPanel.tsx` |
| Discoveries | The first stratum's recipe unlocks keep their short names; deeper ones are prefixed with the stratum (`stratum_2:floor_2`, `stratum_2:boss`). | `dungeon.ts`, `combat.ts` |
| Third stratum | Exists by name only (the Gilded Exchange), so the frontier can move on after the Abbess. | `create.ts` |
| Not done | The second stratum's numbers are a first guess and have not been tuned. Attacks on the frontier do not yet change when the frontier moves down. Saves made before this build have no third stratum. | — |

## Decisions made for deeper attacks and earned structures

| Topic | Choice | Where |
|---|---|---|
| Attackers follow the frontier | A map may have a wave script per frontier stratum. A battle uses the script for the stratum the frontier is in when it starts, or the map's own if there is none. The first stratum uses the original script; the second and third have their own on the frontier, the second also at the sanctuary. The prologue's first defense keeps its own. | `defense_maps.json`, `battle.ts` |
| Swarmling | Small, fast, weak, in large groups. | `balance.json` |
| Wisp | Flies straight from its lane's mouth to the gate. Bunkers and mortar pits cannot hit it, splash from them does not reach it, and it cannot be slowed. It does not batter structures. | `battle.ts` |
| Mender | Heals every wounded attacker within 80 for 12, then waits 2 seconds. | `battle.ts` |
| Binder | Pins the most exposed unpinned defender within 200: she cannot act for 4 seconds times her structure's exposure (a bunker occupant is pinned for 0.6 seconds). Uses the same "cannot act" timer as moving under fire. | `battle.ts` |
| Husk | Bursts into four swarmlings where it dies. | `battle.ts` |
| Bulwark | Armor 14, and other attackers within 70 of it gain 6 armor (the strongest aura counts; they do not stack). | `battle.ts` |
| "Casters first" | The targeting option that used to favour petrifiers now favours anything that solidifies, pins or heals. | `battle.ts` |
| Mortar pit | Range ×1.5, damage ×1.3, every shot bursts over 55, shots take 1.8 times as long, nothing closer than 100, no flyers. Exposure 10%. Earned by defeating the master of the first stratum. One per map. | `balance.json`, `fortify.ts` |
| Signal post | Its occupant does not fight. While manned and standing, every other manned post within 200 deals 20% more damage and reaches 10% further (several posts would add up; only one may be built). Exposure 40%. Earned by beating the Warden of Dust. One on the frontier, none at the sanctuary. | `balance.json`, `battle.ts` |
| Balance | Measured with fixed garrisons and no hand play. Second-stratum attackers: a level-5 garrison on the original seven posts barely holds (gate at 9 of 100); with a mortar pit and a signal post it holds comfortably; ignoring the casters loses. Third-stratum attackers: level 6 on the original posts barely holds; level 8 with both earned structures holds easily. The sanctuary at second-stratum depth is still easy with its four fixed posts. | — |

## Decisions made for story in the game

| Topic | Choice | Where |
|---|---|---|
| Story moments | The rules record a story id once when its moment first happens (`tell` in `story.ts`). The interface shows the words from `content/stories.json` as soon as the moment happens, and lists every story told so far under "Words spoken" to reread. | `story.ts`, `content/stories.json`, `App.tsx` |
| Moments | First tide held; the Flowering spent; the frontier lost without it; a siege held; the Flowering ready again; the first champion lost for good; each stratum secured; first entry into each stratum after the first; the Keeper laid to rest; the Keeper's charge brought home. | the rules, at each of those points |
| "Stratum secured" | The separate notice is gone; Sakuya's story for that stratum replaces it. | `App.tsx` |
| Champion backgrounds | A few lines per champion in `roster.champions[].story`, shown on her sheet and when hovering her name at the seal. | `balance.json` |

## Balance, first pass

Checked by simulated battles with no player input during the fight:

- Frontier, seven well-posted defenders hunting petrifiers first: holds with no casualties.
- Same garrison on default targeting: holds but loses a defender.
- Three defenders, or a careless posting of seven: the gate falls.
- Sanctuary with nobody posted: falls even with full ammunition. With three adventurers: holds, spending most of an ammunition stock in a siege or two.

Known weakness: "petrifiers first" is close to always correct. It has not been tuned by hand play yet.

Labyrinth, checked with a scripted player that uses skills sensibly:

- Whole campaign, played by a scripted guild master (`src/sim/__tests__/director.ts`) who trains one floor at a time, rests before attacks and takes on the boss at level 5: the first stratum is secured between day 19 and day 26 across eight seeds, with nobody lost and the miracle unspent.
- The same player attempting the boss at level 4 is usually wiped at its door. Since the hall-capacity change, that is recoverable: emergency summons, rescue expeditions, and the boss falls about a week later. Before that change the same wipe ended in game over by day 23.
- After the cast, skill, gear and floor changes, and the rebalance above: the careful scripted player (who spends no skill points and makes no gear) secures the stratum between day 11 and day 24 on six seeds, usually with one to four champions solidified along the way and all of them recovered. The same player attempting the boss at level 4 loses the campaign on two seeds of six. A human using skills, gear and supplies will find it easier than that.
- The figures below this line were measured before those changes and are kept for comparison.
- A level-1 party of five (Guardian, two Gunners, Alchemist, Medic) clears floor-1 fights but runs out of skill points within a few.
- The roaming elite wipes a level-1 party, is a narrow win at level 2 and a solid win at level 3.
- The boss wipes a level-1 party and is a narrow win for a fresh level-3 party; level 4 or 5 is comfortable. Reaching it tired makes it harder.

## Differences from the handoff files

- **T03 deploys seven, not eight.** The scenario says eight defenders are deployed; the frontier has seven slots by design, so the test deploys seven (six fall, one escapes) and keeps the eighth in reserve.

## Still open (needs a design decision)

- What conceding a battle should cost. At the moment it is free apart from losing the battle.
- Whether attacks should grow stronger over the campaign, and how scouting changes the forecast.
- How the build caps grow: upgrades, discoveries, or secured strata.
- Whether building and moving structures should cost materials or time. At the moment only the caps limit it.
- Whether skill points can be taken back, and at what price.
- Whether a party should choose what it packs. At the moment it takes up to three of everything.
- Resident and worker casualties in a siege and their effect on later defenses.
- Whether the tree needs new active skills to unlock, not only ranks and passives.
- A carrying limit for loot.
- Whether the slice ends at the first boss or continues into the second stratum. A second stratum exists as a stub so the loop keeps running.
