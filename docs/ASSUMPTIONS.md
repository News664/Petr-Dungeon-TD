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

`clock.sanctuary_siege_delay_hours`, `campaign.frontier_recovery_sortie_hours`, `roster.class_stats`, `resources.deposit_workers`, `defense.frontier_layout`, `defense.sanctuary_layout`, `defense.structure_max_hp`, `roster.rest_hp_per_day`, `roster.rest_gauge_per_day`, and the battle values under `defense` (`ticks_per_second`, `reposition_seconds`, `repair_materials_per_10_hp`, `sanctuary_max_automated_ammo`, `ammo_restock`, `enemy_stats`, `structure_stats`, `class_combat`, `turret`). Map layouts and wave scripts are in `config/defense_maps.json`.

## Decisions made in M1 (defense battles)

| Topic | Choice | Where |
|---|---|---|
| Simulation | Fixed 30 ticks per second, no randomness. The battle lives in the campaign state, so a mid-battle save resumes exactly. | `battle.ts` |
| Campaign time | A defense battle takes no calendar time. | `battle.ts` |
| Fewer slots than defenders | Intended: the frontier has seven slots for a roster of eight, so someone is always in reserve. More slots would come from upgrades. | `balance.json` |
| Structures | A structure multiplies its occupant's range and damage and sets how exposed she is to petrifying attacks (watchtower 100%, support station 50%, bunker 15%). Guardians get extra reach and damage in a bunker. | `balance.json` |
| Classes in defense | Gunner: long range, pierces armor. Alchemist: splash damage that also corrodes armor. Guardian: slows what she hits. Medic: eases the gauge and heals allies in reach, and fires only when nobody needs her. | `battle.ts` |
| Targeting | Each adventurer has a standing priority: nearest the gate, strongest, or petrifiers first. | `battle.ts` |
| Enemies | Runners only run. Armored brutes damage structures they pass. Petrifiers attack the most exposed defender in reach, filling her gauge and wounding her. | `battle.ts` |
| Solidified in battle | The moment the gauge reaches 100 or health reaches 0. Her post goes silent. | `battle.ts` |
| Wrecked structure | Its occupant falls back to reserve unharmed. Damage persists after the battle; repairs cost materials (1 per 10 points). | `battle.ts`, `roster.ts` |
| Moving under fire | A defender posted or moved during a battle cannot act for 6 seconds. Withdrawing is immediate. | `roster.ts` |
| Sounding the retreat | The player may concede: an immediate loss with no further casualties. | `battle.ts` |
| Gate | Starts every battle at full strength. | `battle.ts` |
| Sanctuary weapons | Three automated weapons, one unit of ammunition per shot. Ammunition does not regenerate; 10 units cost 6 materials, up to 100. | `battle.ts`, `roster.ts` |
| Rest | Each day, adventurers who are not on an expedition recover 40 health and lose 30 gauge. | `time.ts` |
| Waves | One fixed wave script per map (`config/defense_maps.json`). Attacks do not yet grow over the campaign. | `defense_maps.json` |

## Balance, first pass

Checked by simulated battles with no player input during the fight:

- Frontier, seven well-posted defenders hunting petrifiers first: holds with no casualties.
- Same garrison on default targeting: holds but loses a defender.
- Three defenders, or a careless posting of seven: the gate falls.
- Sanctuary with nobody posted: falls even with full ammunition. With three adventurers: holds, spending most of an ammunition stock in a siege or two.

Known weakness: "petrifiers first" is close to always correct. It has not been tuned by hand play yet.

## Differences from the handoff files

- **T03 deploys seven, not eight.** The scenario says eight defenders are deployed; the frontier has seven slots by design, so the test deploys seven (six fall, one escapes) and keeps the eighth in reserve.

## Still open (needs a design decision)

- What conceding a battle should cost. At the moment it is free apart from losing the battle.
- Whether attacks should grow stronger over the campaign, and how scouting changes the forecast.
- Slot upgrades: how extra structure slots are unlocked.
- Whether emergency summoning should be limited per crisis. At the moment only resources and the roster cap limit it.
- Resident and worker casualties in a siege and their effect on later defenses.
- How many statues an expedition can carry, and what carrying costs.
- Whether the slice ends at the first boss or continues into the second stratum. A second stratum exists as a stub so the loop keeps running.
