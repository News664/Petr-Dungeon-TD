# THE LAST SANCTUARY
## Self-contained game-design specification and coding-agent handoff

**Status:** Design discussion consolidated for an initial prototype; not a final content or balance specification.  
**Working title:** The Last Sanctuary (placeholder).  
**Genre:** Hardcore first-person grid dungeon RPG + adventurer-slotted tower defense + lightweight guild/survival economy + calendar-driven campaign crisis.  
**Theme:** A female-only, Japanese anime/game-inspired fantasy isekai setting, under a spreading solidification catastrophe.  
**Player role:** Female guild master / last summoner. The player makes tactical decisions for expedition parties and defenses, but strategically directs an organization, not one fixed protagonist.  
**Tone:** High difficulty, serious consequences, rescue under time pressure, scarce champions, recoverable but severe organizational setbacks.

---

# 1. Elevator pitch

A goddess protects the last sanctuary of a world devastated by a phenomenon that gradually turns women into permanent statues. Most inhabitants and visiting outsiders have already been solidified; monsters are largely immune and now control the wasteland and labyrinth. The goddess exhausts her strength to power a summoning seal for the last surviving summoner: the player. Initially summoned female champions repel an assault; from then onward the guild must survive by delving into a dangerous, multilayer labyrinth, periodically defending its frontier, and maintaining protective wards and resource production in conquered areas.

If an adventurer is defeated, she becomes solidified at her location and cannot simply rejoin the party. She may be retrieved and restored if recovered before **30 in-game days** pass. At 30 days abandoned, solidification becomes permanent. Each failed frontline defense threatens the entire guild, but the goddess's infrequent miracle and the heavily fortified sanctuary offer costly last chances. Only by continuing to explore can the guild expand its safe territory, develop better countermeasures, and ultimately address the origin of solidification.

**Core promise:** "Explore the unknown, deploy irreplaceable champions, protect a fragile society, and fight your way back after a catastrophe."

**Core campaign loop:** explore frontier stratum -> gain knowledge and resources -> prepare for scheduled invasion -> defend using adventurer-occupied positions -> defeat stratum boss -> convert stratum to secured protected production -> advance frontier -> repeat. Losing a frontline battle branches into a resource-constrained rescue/siege/counteroffensive loop instead of immediately ending the game.

---

# 2. Hard design decisions (agreed intent)

1. **Solidification is overwhelmingly a failure condition**, never a desirable production mechanic. No intentional solidification to create gems, buildings, power, buffs, or materials.
2. **Female-only setting and affected humans:** protagonist, summoned adventurers, goddess and surviving inhabitants are female. Monsters generally resist the phenomenon. Character depictions should be anime-like but original.
3. **Guild-master perspective:** same finite, valuable adventurer roster supplies expedition teams and defenses.
4. **Dungeon:** Etrian Odyssey-like first-person/grid labyrinth exploration, party-based turn combat, floors and boss-cleared strata. A stratum normally has 3–5 floors; prototype has 3.
5. **Defense:** GemCraft-like wave/route tower defense where **adventurers, not conjurable gems, are placed into defensive structures**. No gem crafting, fusion, or duplication.
6. **Clock:** foreseeable scheduled invasions, usually every 7 in-game days (prototype assumption). Rare irregular attacks only if legible/telegraphed. Exploring, working, recovery, summoning and traveling spend in-game time; no real-world idle requirement.
7. **Cleared strata:** after killing the final-floor boss, organized monsters become manageable and automated extraction becomes possible; old strata are NOT individually subject to routine monster-wave defenses. Workers still need protective energy to resist ambient solidification.
8. **Frontier:** normal invasions attack the active forward defensive line. Sanctuary attacks occur after frontline collapse or special, warned story events, not randomly across every old stratum.
9. **Economy:** survival/ward protection and crisis reserves, not a large Factorio-style conveyor factory. The initial prototype has abstract production per secured deposit, optional upgrades later. A high-volume factory was considered and deliberately deferred, not canon.
10. **One statue deadline:** any completely solidified adventurer abandoned outside a safe recovery facility becomes permanently solidified after **30 in-game days**. No faster/slower deadline based on dungeon, tower, bunker, or rescue context. Buildings cannot shield abandoned statues once monsters overrun an area. A safely retrieved statue stops accumulating abandoned time; reversal still consumes resources/time.
11. **First failed frontline defense with miracle charged:** goddess banishes invasion and fully restores roughly half the fallen defenders (player chooses the eligible individuals), while her power drain drastically weakens ward-based production; the next scheduled frontier battle is a high-stakes rematch.
12. **If that rematch fails, or a frontier fails without a charged miracle:** retreat into the fortified sanctuary. Sanctuary has automated/inhabitant-operated defenses powered by finite stockpiles, complementing any surviving adventurers. Losing the sanctuary siege is game over.
13. **Winning sanctuary siege:** repels monsters temporarily and yields a longer preparation period, but outside production stays cut off. The player pays a fixed cost and time to **abstractly** rebuild the frontier, with no construction minigame. Goddess-assisted automatic retrieval brings **still-recoverable** frontier statues back after rebuilding; they are **not automatically revived**. Restoring them costs resources/time. The player then fights a new frontier battle. Winning restores access to normal production; losing leads to another sanctuary siege.
14. **Miracle recharge:** one-charge maximum; recharges after **two full stable, successfully defended invasion cycles after production and frontier are restored**. No recharge simply from waiting, and no stacking charges.
15. **No routine defensive resource sink inflated just to justify automation:** adventurers provide most firepower; structure/ward maintenance, restoration, summoning and sanctuary emergency weapons create recurring or burst costs.

Some details (costs, exact exposure-cost curve, time spent per dungeon action, siege duration, recruitment cooldown, round-up of "half") are deliberately tunable and should live in configuration.

---

# 3. Genre inspirations, fully explained (do not require outside research)

## 3.1 What the dungeon RPG should borrow from Etrian Odyssey

Etrian Odyssey is a Japanese hardcore dungeon RPG series in which the player operates an adventuring guild in a town, assembles a customizable small party, and explores a labyrinth tile by tile, commonly in **first-person view**. Movement is discrete: step forward/back and turn left/right on a square grid; floor maps contain walls, doors, stairs, shortcuts, traps, treasure, collection nodes and powerful monsters. The player keeps a top-down map; series entries let the player draw or annotate it, with automapping options in some entries. The dungeon is divided into multiple floors and themed strata, with powerful bosses or gates limiting progress.

The usual party is **up to five characters**, arranged into front/back rows. Front row trades safety for the ability to use melee effectively; back row is safer from many attacks and favors ranged, magical, healing and support characters. Combat is **turn-based**: the player issues attack/skill/guard/item/escape orders for the party; combat then resolves using enemy actions and turn order. Resource management matters: HP, skill-use points, consumables, inventory capacity, escape/return tools and a planned route back to town. Classes define different skill trees and tactical roles; characters level, earn skill points, and develop distinctive builds. An encounter can be dangerous even with a healthy party because of status effects, enemy patterns, or bad composition.

Visible roaming elite enemies (often called "FOEs" in Etrian Odyssey) are represented on the exploration map, follow fixed patrol/chase behaviors, and are often too dangerous when first met. They can be avoided through observation, clever routing or waiting, and beaten later with preparation. Ordinary encounters may be random or triggered from a hazard meter. Dungeon collection points (mining, gathering, chopping, etc.) produce items/materials; mapping them helps revisit valuable sites. Exploration yields both short-term consumables/materials and long-term progress (shortcuts, boss victories, new areas, technology and enemies' weaknesses).

**Implement the essence, not the trademark-specific interface:** first-person grid navigation + readable top-down exploration map + danger/shortcut/elite route puzzle + five-character turn-based party combat with roles + finite supplies + collection points + boss-gated strata. A usable prototype may use auto-drawn discovered tiles rather than a full stylus-like mapping editor. Avoid copying original art, maps, monster names, UI skin, text or icons.

**Our crucial modification:** HP defeat or complete solidification in combat produces a **persistent statue at that dungeon location**. The character does not automatically return to the guild. The party may extract the statue or return later before the universal 30-day deadline. A total party wipe should have explicit consistent consequences and may require reserve members for recovery.

## 3.2 What defense should borrow from GemCraft

GemCraft is a tower-defense series built around enemies traveling along visible paths in timed waves toward a defended objective. The player prepares or constructs structures along those routes and inserts magical **gems into sockets**. The gem determines how a structure attacks: direct damage, splash, slows, poison, armor debuffs or other effects. The structure changes how the gem acts: tower for range/regular attacks, trap for shorter range or stronger on-path effects, amplifier to boost neighboring gem performance in relevant entries. Gems may be switched between structures to react to waves. In the original games, players can create/combine/upgrade gems using mana; our game **deliberately does none of that**.

Our substitution is **female adventurer = socketed combat unit**. Each adventurer has a class, personal stats, skill investments, equipment, condition and vulnerability to solidification. Structure type modifies her behavior. Deployment/repositioning has time cost and cannot be instantaneous free teleportation; no duplicating, fusing or converting adventurers into literal gems. Enemy waves advance on a route toward a frontier gate; some enemies can attack structures or directly expose tower occupants to solidification. A successful battle holds territory. Failure is a strategic crisis, not simply a lost score.

**Examples:**
- Exposed **watchtower**: high damage/range, vulnerable to ranged/flying solidification attackers.
- **Bunker**: heavily protected occupant while intact, limited line of sight/range/output; if area is overrun the structure provides no lingering special statue timer protection.
- **Support station**: healing, status suppression, buffs, crowd control; moderate protection.
- Defender's HP/status and building integrity are separate. Structure may stand while occupant is solidified; the slot then ceases attacking. Conversely a destroyed structure can force a healthy adventurer to retreat.
- Enemy types for prototype: normal runner, armored tank, exposed-defender-targeting petrifier.

**Not required for prototype:** full freeform map building, wall mazes, complex traps/amplifiers, mana-generation mechanics, gems/fusion, huge wave variety.

## 3.3 Why NOT full Factorio, and what survives from it

Factorio's deep gameplay lies in designing complex factory layouts and material throughput: machines, recipes, transport belts, routing, bottlenecks, expansion and optimization. A narrow grid dungeon would force obvious belt routes, and an eight-person roster has finite equipment needs; generating huge amounts of materials would not produce interesting decisions. Increasing costs artificially or making turrets massive consumers would distort the focus.

Our choice: **post-boss secured deposits generate resources automatically over in-game time**, subject to worker safety, ward upkeep, access and optional process upgrades. This borrows the satisfaction of turning a dangerous collection point into a reliable supply chain, but not belt placement or large factory-building. The dungeon has a separate map; logistics connections can be abstracted using conquered floors and paths. A future full automation layer is an open design possibility, NOT prototype scope.

## 3.4 What the economy should borrow from Frostpunk

Frostpunk is a survival-management game in which infrastructure and resource allocation are pressured by a persistent hostile environment (extreme cold). Rather than only buying better weapons, resources are spent to keep people alive and work sites operational; difficult decisions concern whom to protect, how much to stockpile, and what to sacrifice when demand exceeds supply.

Our substitute for cold is **ambient solidification**. Resource outposts need protective ward energy; if underpowered, output drops and workers eventually must evacuate or may become solidified. The player can shut down/evacuate a site to save people at the expense of income. Sanctuary has an emergency baseline of protection and finite war reserves. Resource efficiency matters because losses temporarily cut off production, not because high-level weapons consume silly volumes of materials. Avoid a full city-builder: no individual hunger schedules, politics, housing micromanagement or civilian simulation in prototype.

---

# 4. Lore and tutorial

- The world was once inhabited by women across multiple civilizations, with occasional female champions from other worlds. A mysterious spreading influence solidifies women; monsters are resistant and have occupied the abandoned world. The origin of the phenomenon remains the central mystery.
- A heavily weakened goddess protects the last sanctuary. The player is the last surviving summoner who can use an ancient seal. The goddess spends her residual power to fund the first small wave of free summons and guide a **sanctuary tower-defense tutorial**.
- Following the tutorial, divine protection fades; the guild must establish wards using resources from the labyrinth. Only small remnants of the original population remain as artisans, engineers and workers. Workers are distinct from elite summoned adventurers.
- The goddess may eventually provide a once-charged **large miracle**: defeat a frontier invasion, instantly retrieve and fully reverse about half of the fallen combatants, then spend her energy and depress production. After a crisis, two successful stable invasion cycles recharge it via renewed ward operation. Separate her **minor retrieval guidance** from the major miracle; it does not reverse statues and cannot be a free instant army-wide revival.
- Periodic resonance surges cause monsters to muster and attack the current frontier on a forecast schedule. Exceptional surprise attacks need clearly communicated narrative warning.
- After a stratum boss falls, organized local monster resistance collapses enough to extract resources, but ambient solidification remains; so ongoing ward upkeep is justified.
- Long-term narrative objective: descend through successive strata, discover why solidification spreads, and stop its origin. Clearing a stratum gives territory, materials, story/technology discoveries and the right to operate extraction sites.

---

# 5. Campaign play and spatial design

## 5.1 Areas

- **Sanctuary / guild menus:** summoning, roster, training, treatment, stockpiles, wards, expedition assembly, forecast, preparation; emergency automatic weapons and resident defenders.
- **Active frontier stratum:** usually 3–5 floors (3 in prototype). Dangerous until final-floor boss defeated. Explore in first-person dungeon; defend one frontier battle map on surge days.
- **Cleared strata:** protected extraction sites. No separate routine tower-defense level per stratum. Require ongoing ward energy to operate; can be cut off after collapse of frontier. Ordinary monsters do not spawn new large invasions there.
- **Frontier TD map:** predesigned enemy lanes and structure slots. Structures can be repaired/assigned; the player chooses which finite adventurers to risk.
- **Sanctuary TD map:** advantageous chokepoints, fixed powerful resident/automated defenses, high stockpile drain, shrinking ability to replace lost inhabitants. Different from frontier map, not just a replay with fewer units.

## 5.2 What drives exploration

Exploration is required for (1) new deposit types/quantity and shortcuts; (2) countermeasures, class/equipment recipes, boss knowledge and better restoration techniques; (3) experience and character growth; (4) clearing a boss to secure and exploit a stratum; and (5) eventual campaign victory at the source. A passive productive base may sustain survival but **cannot clear the next stratum or end the menace by waiting**. Discoveries should offer multiple tactical answers, not only hard arbitrary item gates.

## 5.3 Dungeon/TD map separation

Dungeon tiles are corridor-heavy and unsuitable for complex belt puzzles. Avoid laying Factorio belts through the labyrinth. Secured deposit nodes map to abstract production facilities. If relevant, walking routes/shortcuts can affect logistics capacity or access; do not simulate every belt tile.

---

# 6. Adventurers, roster and combat

## 6.1 Recruitment

- Summon female adventurers from other worlds through a guild seal. They are individually named and persist with levels, build, equipment, role and condition; the game must not treat them as fungible gem ammunition.
- Summoning consumes scarce resources and has a significant cooldown and/or limited capacity. It cannot be instantly mass-produced by an optimized economy. Guild accommodation/roster capacity can cap active recruits. Initial tutorial summons are goddess-sponsored and free.
- Prototype target: **8 adventurers available by early campaign**, four classes; five maximum per dungeon expedition; the remaining members are reserves and may defend. Start with five free in tutorial and grant additional starter summon credits to reach eight, or load the eight-person debug scenario directly. Exact schedule configurable.
- Emergency summoning using stockpile may be possible at severe cost to avert softlocks, without trivializing loss. Should not be free unlimited replacement.

## 6.2 Four prototype classes (placeholder names)

| Class | In dungeon | Slotted in TD |
|---|---|---|
| Guardian | Front-row mitigation, guarding, enemy disruption | Strong bunker control/holding, weak long-range attack |
| Gunner | Back-row ranged damage and armor penetration | Long-range watchtower DPS |
| Alchemist | Elemental attacks, area damage, anti-armor/status interactions | Magic/ranged attacks, area coverage |
| Medic | Healing, preventive protection and status management | Support station healing, exposure reduction, buffs |

A small data-driven skill tree (e.g. 4–6 skills/class) is adequate. Skills should affect both modes, but their formulas/effects may have separate implementations for grid combat vs real-time TD. Keep combat explainable and telegraphed.

## 6.3 Solidification state and damage

- An adventurer at zero HP becomes fully solidified (unless a deliberate pre-defeat escape mechanic prevents reaching zero). A specific enemy can also accumulate a petrification/solidification gauge to 100% regardless of remaining HP.
- A fully solidified character cannot act in dungeon or defense, and leaves a persistent statue record with `solidified_at`, `location`, `recovered_at` (nullable) and `restoration_state`.
- **Universal time rule:** any statue not safely recovered before `solidified_at + 30 days` permanently solidifies. The timer is identical for all locations, all classes and all defensive structures. Retrieval to a safe protected facility stops abandonment exposure. At exactly 30 days unrecovered, status becomes permanent. Do not reset the clock with consumables remotely.
- Restoration cost increases with abandoned exposure time, using one transparent progression (e.g. `<10 days`: 1x, `10–<20`: 2x, `20–<30`: 3x). These are example balance brackets, not additional deadlines. A safely recovered statue is curable even if treatment finishes after the former 30-day deadline, provided retrieval occurred before the limit.
- Restoration takes in-game time and consumes reagents and capacity. Goddess's charged miracle **fully restores** chosen fallen defenders immediately as its one explicit exception to ordinary treatment costs/time; it is not a separate statue timer rule.
- Once an enemy occupies an area, old structures are nullified; **no permanent-protection benefit from a bunker or tower for abandoned statues**. Structures can reduce the chance of being solidified *before* defeat, not the subsequent universal 30-day clock.
- Permanent loss removes that adventurer from future missions. Summoning can gradually replenish headcount but not instantly replace invested experience/skills.

## 6.4 Normal dungeon statue rescue

Record a statue marker on the discovered map. A rescue party must navigate to it and secure/extract it (simple pickup/escorted exit mechanic in prototype). The player may abandon the statue, try later, or risk other adventurers to retrieve it. Rescue and transport consume world time. Recovered statues can be restored in a protected guild facility.

## 6.5 Frontier statue retrieval rules

- First divine intervention: goddess banishes attackers and immediately fully recovers approximately half the fallen; the other half remain statues until retrieved/reversed or permanently lost.
- Post-sanctuary: once the player pays the abstract rebuild cost and completes rebuilding the frontier outpost, goddess-guided automatic teams retrieve **all still recoverable frontier casualties they can access** to a protected facility. This is **retrieval only**; the guild then pays restoration resources and waits for recovery. The auto-retrieval simplifies desperate counteroffensive play. It does not apply to distant dungeon statues, and permanent ones stay permanent.
- In both cases, never run an off-screen special timer: the same 30-day deadline applies.

---

# 7. Defense design and crisis state machine

## 7.1 Defense battle rules

- Waves traverse predetermined lanes toward an objective; if too many reach it or objective HP hits zero, frontier is lost. Falling characters are solidified only when actually defeated or at 100% gauge: **the loss condition does not automatically statue the whole roster**.
- Assign available adventurers to structure slots before and (with action/delay cost) during the wave. A defender cannot be in the dungeon or another slot simultaneously. Defensive structures do not generate attacks on their own except specifically automated sanctuary weapons.
- Watchtower = strong offense/long range but occupant exposed to targeted ranged/flying monsters. Bunker = minimal offensive contribution, heavy protection. Support station = healing/cleansing/buffs. Defender HP/gauge separate from building HP. If occupants are solidified, their active structures go silent.
- Prepared defenders risk solidification; reservists kept at home can form rescue or emergency teams. Position choice trades offensive efficiency against future personnel survival.
- Battle UI should indicate incoming waves, target priorities, line-of-sight/range, exposed defenders, structure integrity, status gauges, retreat choices and forecast. Time/clock pauses in planning interfaces.

## 7.2 Stable -> first loss (miracle charged)

- In NORMAL / STABLE FRONTIER, player explores between scheduled invasions and holds attacks.
- If frontline fails AND miracle charge = 1: goddess banishes remaining monsters, **retrieves and fully restores ceil(fallen/2) selectable fallen adventurers** (prototype default rounding; config adjustable), consumes charge, and reduces previously cleared-stratum protection/production severely (e.g. 20% of normal or shutdown/evacuation). The next regular forecasted invasion is the FRONTIER REMATCH.
- Player has the interim calendar days to rescue other statues and use stockpiles to repair/reassign and restore. A rematch win restores frontier and full resource production; miracle recharge starts at zero stable cycles. A rematch loss -> SANCTUARY SIEGE.
- If a normal frontier is lost while miracle uncharged, no divine banishment; retreat directly to SANCTUARY SIEGE.

## 7.3 Sanctuary siege

- Outside extraction unavailable, stored materials/ward energy/repair stock feed automated defensive weapons and inhabitant-operated positions. Valuable surviving adventurers also fight; high fortress advantage allows credible victory with few adventurers. Resident casualties weaken later defenses and are hard to replenish.
- Lose: GAME OVER.
- Win: monsters withdraw for an extended regroup interval (prototype default 14 days), unlocking COUNTEROFFENSIVE PREPARATION. Outside production still inaccessible. Do not auto-reset supplies or miracle.
- Subsequent sanctuary siege wins can repeat, but each consumes finite stores and likely loses inhabitants; indefinite passive turtling should be unsustainable. Do not hard-cap the number of siege wins if a skilled player can sustain them.

## 7.4 Counteroffensive preparation -> breakthrough

- Pay fixed resources and time to rebuild the frontier outpost **without construction placement**. After rebuild, goddess-guided teams automatically retrieve recoverable frontier casualties (not dungeon casualties); treatment consumes stored reagents and time, with player choosing which to restore first.
- At next forecasted attack, fight FRONTIER BREAKTHROUGH with the rebuilt defenses. Win -> restore access to conquered production and enter STABLE FRONTIER with 0 miracle-recharge cycles. Loss -> another SANCTUARY SIEGE. The player should not have to manually rebuild factories or replay many identical rescue dungeons.
- Keep a minimal protected core facility or emergency stockpile/summon option so a won sanctuary siege can plausibly lead to a winnable breakthrough. Do not guarantee victory; avoid unavoidable softlock after a seemingly successful last stand.

## 7.5 Miracle recharge and stability

- Maximum one miracle charge.
- After restored frontier control and full *operational access* to production, each **successfully held scheduled stable invasion** counts one stable cycle. After two counted cycles, miracle becomes charged. Do not count the rematch/breakthrough that merely restores operations as a completed recharge cycle. Failed attacks and calendar waiting alone do not charge it.
- "Full production restored" means the territory's normal access/ward network is available, not that all previously lost workers magically respawn; destroyed facilities/worker losses may require recovery.

## 7.6 State transitions (normative)

```text
STABLE_FRONTIER --defense win--> STABLE_FRONTIER (+1 stable cycle if recharging)
STABLE_FRONTIER --defense loss, miracle charged--> DIVINE_EMERGENCY (charge consumed, half fallen fully restored)
STABLE_FRONTIER --defense loss, miracle empty--> SANCTUARY_SIEGE
DIVINE_EMERGENCY --next frontier rematch win--> STABLE_FRONTIER (production restored; recharge 0/2)
DIVINE_EMERGENCY --next frontier rematch loss--> SANCTUARY_SIEGE
SANCTUARY_SIEGE --loss--> GAME_OVER
SANCTUARY_SIEGE --win--> COUNTEROFFENSIVE_PREPARATION (extended interval, no outside production)
COUNTEROFFENSIVE_PREPARATION --pay/rebuild/retrieve--> FRONTIER_BREAKTHROUGH
FRONTIER_BREAKTHROUGH --win--> STABLE_FRONTIER (production restored; recharge 0/2)
FRONTIER_BREAKTHROUGH --loss--> SANCTUARY_SIEGE
```

**Timing point needing an explicit implementation choice:** whether sanctuary siege occurs immediately after retreat or on a short warning timer. Prototype may trigger it as the next scripted battle with preparation UI and no income in between, as long as the state chain is preserved.

---

# 8. Resource model and time

## 8.1 Minimal three-resource abstraction

| Resource | Acquisition | Recurring / burst spend |
|---|---|---|
| Ward energy | Sanctuary baseline + secured crystal sites | Protect inhabitants and productive sites, enable safe operations and some special defense/summoning costs |
| Construction materials | Exploration/gathering + automated secured extraction | Fortifications, repairs, abstract frontier rebuild, ritual components |
| Restoration reagent | Herbs/monster drops in expedition + secured extraction/processing | Restore statues, preventive consumables, emergency recovery |

Resource numbers are **not canon**; see `prototype_config.json` for editable sample values. Avoid double-counting: ward energy produced by a protected deposit can pay its own ward cost only if the player can bootstrap with initial reserve/baseline, and insufficient protection must give a clear output/evacuation rule. Avoid an economy that permanently collapses when energy momentarily reaches zero.

Production from a cleared stratum should be net-positive under normal conditions but cost protective upkeep; shutting it down/evacuating saves workers while sacrificing income. Production is severely curtailed in DIVINE_EMERGENCY and cut off from outside during sanctuary/counteroffensive crisis. Stockpiles then become strategically valuable. Sanctuary has minimal emergency protection/generation, not unlimited military supplies.

Resources should not turn directly into unlimited offensive power: a large number of empty towers is limited by available trained adventurers and slots, and dungeon bosses require tactics/knowledge. Strong high-efficiency production should broaden options, not automate campaign victory.

## 8.2 Calendar

- Use one deterministic simulation clock, e.g. integer **hours**. Invasion interval default 168 hours / 7 days; statue abandonment threshold 720 hours / 30 days; after a sanctuary siege default 336 hours / 14 days.
- Every dungeon action/time skip/travel/rest/production/recovery/rebuild advances that clock. Planning screens pause time. No background or real-time offline generation.
- For initial prototype: dungeon step might consume 5 minutes, combat a configurable number of minutes, travel/working a few hours; simpler day-granularity is acceptable if it does not make normal exploration consume absurd time or hide deadline crossings. One centralized `advance_time(delta)` must process relevant events consistently and in explicit order.
- Always show next invasion date/time, expected return time, time until statue permanence, treatment completion and time until summoning available. Provide calendar notifications and safe "return before invasion" information.
- Prototype can use simple deterministic waves; eventual game should vary wave composition by stratum and scouting intel, not random surprise attacks without telegraphing.

---

# 9. Initial vertical slice (scope)

**Minimum playable feature set:**

1. Guild UI: roster, expedition selection, summon seal, status of goddess miracle, stocks and production, ward toggle, treatment queue, calendar and looming invasion, quicksave/load.
2. Prologue: goddess-sponsored first summons and a **short tutorial sanctuary defense**; then players get a starter stockpile and the need to secure the first stratum.
3. Dungeon: one 3-floor stratum with first-person tile-by-tile navigation; top-down discovered map; shortcuts/stairs; one gathering node on each of two floors, normal encounters, one telegraphed visible elite, one boss; four classes; five-character party; healing/status, retreat and solidified statues.
4. Defense: frontier battle map with ~6–8 slots across 3 structure types and several waves; sanctuary battle map with strong automated defenses and fixed finite ammunition/energy; 3 enemy categories including targeted petrifier.
5. Economy: three resources; one secured collection site that produces over time after boss; ward protection, a stockpile, fixed-cost abstract reconstruction, summon cooldown and capacity, treatment queue. Worker group as aggregate, with simple evacuation/shutdown option.
6. Campaign state machine: all branches in section 7, 30-day universal clock, major miracle, rematch, sanctuary, restoration/retrieval and 2-cycle recharge.
7. Debug/test controls: jump to each state, cause guaranteed frontier loss/victory, apply casualties, advance time by configurable amount, spawn a recovered/unrecovered statue, modify stocks, force an invasion, simulate a successful defended cycle.

**Potential scope warning:** The fully integrated slice is nontrivial even with placeholders. Build the state machine and test harness first. For earliest proof-of-concept, use text/menus for one or both combat modes while preserving all events; then add graphical dungeon/TD UI. Do not start by modeling ornate anime characters or large maps.

## 9.1 Suggested milestone order

1. **M0: Domain model and balance simulator** — time, states, characters, casualties, deposits, wards, summons, resource ledgers, miracle, victories/losses; deterministic tests.
2. **M1: Tower defense** — wave route, adventurer slots/structure modifiers, targeting, gauges, structure durability, frontier/sanctuary variants, casualty return.
3. **M2: Dungeon** — one first-person grid and automap, five-person party turn combat, hazards, collection, boss, persistent statues/rescue.
4. **M3: Integration** — tutorial, one stratum, progression from boss to production, complete crisis/recovery branches, save/load, UX and balance.

## 9.2 Definition of done

- Start game, receive starter summons, complete a TD tutorial, explore a 3-floor dungeon, gather resources, beat boss, begin protected extraction and prepare a scheduled invasion.
- Characters are persistent and cannot occupy dungeon and defense positions simultaneously. Their actual deaths or 100% solidification create statues at an addressable location.
- All statues use exactly the same 30-day rule, including after repeated siege losses; rescued statues can be restored with escalating costs, while abandoned day-30 statues become permanent.
- Player can naturally reach a charged-miracle frontier loss, emergency rematch, sanctuary last stand, abstract rebuild, auto-retrieval, breakthrough win, production restoration and two-cycle miracle recharge.
- At least one full recovery route is winnable under realistic starter stocks and reserve roster, and the same scenario can fail if resources/defender placement are badly managed.
- Failure at sanctuary correctly ends game. All states can be loaded or replayed via debug menu.
- Save/load preserves location, time, status, deadlines, stockpiles, recruits, slots, enemy wave and campaign phase; no duplicated units or free resources.

---

# 10. Architecture guidance for coding agents

Prefer an engine-agnostic **data-first campaign simulator** with presentation/UI attached to it. Use stable IDs, no hardcoded assumptions that every fallen defender is revived, and deterministic random seeds for reproducible tests.

Suggested entities:

```text
CampaignState { phase, sim_hour, next_invasion_hour, current_stratum_id,
  miracle_charges, stable_cycles_since_recovery, production_access,
  resources, roster_ids, statues, facilities, cleared_strata, siege_attempts }
Adventurer { id, name, class_id, level, xp, skills, equipment,
  hp, max_hp, solidification_gauge, condition, assigned_to }
Statue { adventurer_id, formed_at_hour, location_type, location_id,
  retrieved_at_hour?, permanence_at_hour, permanent, treatment_status }
Stratum { id, floor_ids, boss_defeated, secured_deposit_ids }
Deposit { id, kind, daily_yield, ward_hourly_cost, active, workers, reachable }
DefenseStructure { id, type, position, hp, slot_adventurer_id?, disabled }
DefenseBattle { map_id, waves, gate_hp, enemies, defenders, elapsed_ticks, outcome }
TreatmentJob { adventurer_id, reagent_cost, start_hour, finish_hour }
SummoningSeal { next_available_hour, capacity, ritual_cost, emergency_credits }
```

Core pure functions/events: `advance_time`, `apply_daily_production`, `calculate_ward_coverage`, `solidify_character`, `retrieve_statue`, `queue_restoration`, `complete_restoration`, `summon_adventurer`, `deploy_defender`, `resolve_wave`, `resolve_frontier_defeat`, `trigger_miracle`, `resolve_sanctuary_siege`, `rebuild_frontier`, `retrieve_frontier_statues`, `resolve_breakthrough`, `record_stable_cycle`.

**Event ordering:** consistent at exact time boundaries. In particular, unrecovered statues at `>= formed_at + 720h` become permanent before any retrieval event at that same timestamp; recovered statues are safe from that calculation; miracle instantly revives eligible fallen with a special event. Future global time skips must process every crossed production day, invasion deadline and treatment completion without skipping events. Provide event log to explain each state change.

**UI principle:** always show (a) what is at risk, (b) what action costs, (c) when the next event occurs and (d) why a particular character/resource is unavailable. Avoid opaque campaign softlocks. A clear warning is needed when beginning an excursion that may overlap a scheduled invasion.

**Content/legal guardrail:** No reuse of protected franchise characters, maps, assets, code, text, or exact UI. Use original designs and original name. These references describe mechanics only.

---

# 11. Explicit unresolved questions / balancing knobs

The coding agent should NOT silently canonize these. Choose prototype defaults from the JSON config and expose them for tuning:

- Whether a frontline may be deliberately surrendered with most defenders evacuated, and how retreat action costs/time work; do not automatically solidify every unit on gate breach.
- Exact summon cooldown, active roster cap, emergency summon limit, and initial free summons schedule.
- Rounding of "half" divine restoration, and whether player may choose recovered individuals (recommended yes, ceil). If no defenders were solidified, no one is arbitrarily revived.
- Exact worksite output, ward protection thresholds, worker exposure model and emergency production percentage.
- What if the stratum boss is defeated just before/while the next invasion occurs? Scheduled invasion should remain predictable; boss clear moves the frontier after a controlled transition.
- Exact sanctuary siege delay on retreat, wave balance, attack stockpile drain and resident casualty effects.
- Rebuild duration/cost and precise timing of auto-retrieval relative to future invasion; it must still respect the universal 30-day statue deadline.
- The recovery cost/time curve, maximum concurrent treatment slots, and availability of special anti-solidification counters.
- How a full dungeon party wipe can be rescued when no adventurers remain (emergency reserve, summons, expensive rescue contract, or loss). The prototype should include a non-free safety route.
- Whether the 3-floor slice ends at first boss clear or continues with a short simulated deeper-stratum frontier; for full integration testing, scripted next-state battles are acceptable.

---

# 12. External reference links (optional; spec is self-contained)

- Atlus Etrian Odyssey V system: https://atlus.com/etrian5/system.html — mapmaking, collection, rows and turn-based combat.
- Nintendo Etrian Odyssey overview: https://www.nintendo.com/en-gb/Games/Nintendo-DS/Etrian-Odyssey-270704.html — first-person navigation and dungeon cartography.
- GemCraft: Chasing Shadows official Steam page: https://store.steampowered.com/app/296490/GemCraft__Chasing_Shadows/ — socketed gems in towers/traps/amplifiers, wave defense and combinational tactics (fusion intentionally excluded here).
- GemCraft: Frostborn Wrath Steam page: https://store.steampowered.com/app/1106530/ — highlights structure/gem effects and the socketing model.

These links are for contextual reference only. The agent should be able to implement the vertical slice from this document alone.
