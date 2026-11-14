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

`clock.sanctuary_siege_delay_hours`, `campaign.frontier_recovery_sortie_hours`, `roster.class_stats`, `resources.deposit_workers`, `defense.frontier_layout`, `defense.sanctuary_layout`, `defense.structure_max_hp`.

## Differences from the handoff files

- **T03 deploys seven, not eight.** The scenario says eight defenders are deployed, but the config gives the frontier seven slots. The test deploys seven (six fall, one escapes) and keeps the eighth in reserve.

## Still open (needs a design decision)

- Whether the player may deliberately surrender the frontier, and what retreating costs.
- Whether emergency summoning should be limited per crisis. At the moment only resources and the roster cap limit it.
- Deployment and repositioning time during a battle (belongs to M1).
- Resident and worker casualties in a siege and their effect on later defenses.
- How many statues an expedition can carry, and what carrying costs.
- Whether the slice ends at the first boss or continues into the second stratum. A second stratum exists as a stub so the loop keeps running.
