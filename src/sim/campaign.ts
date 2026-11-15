import type { GameConfig } from './config';
import { finishExpedition } from './expeditionCore';
import { battleKindForPhase, getAdventurer, getStructure, miracleRestoreCount } from './selectors';
import { clearAssignment, restoreAdventurer, retrieveAllAt, solidify } from './statues';
import type { BattleKind, CampaignState, Command } from './types';
import { fail, log, pay } from './util';

/** The scheduled attack arrives. Time stops until the battle is resolved. */
export function triggerInvasion(s: CampaignState): void {
  if (s.phase === 'GAME_OVER' || s.pendingBattle) return;
  if (s.phase === 'COUNTEROFFENSIVE_PREPARATION') {
    // The frontier was never retaken, so the monsters come for the sanctuary again.
    s.phase = 'SANCTUARY_SIEGE';
    if (s.rebuild) {
      s.rebuild = null;
      log(s, 'rebuild_lost', 'The unfinished frontier outpost was overrun.');
    }
  }
  const kind = battleKindForPhase(s.phase);
  const map = kind === 'sanctuary_siege' ? 'sanctuary' : 'frontier';
  if (kind === 'sanctuary_siege') s.siegeAttempts += 1;
  s.pendingBattle = { kind, map, dueHour: s.simHour };
  log(s, 'invasion', `Monsters attack: ${kind.replace(/_/g, ' ')}.`);
}

function evacuateMap(s: CampaignState, map: 'frontier' | 'sanctuary'): void {
  for (const d of s.structures) {
    if (d.map === map && d.occupantId) clearAssignment(s, getAdventurer(s, d.occupantId));
  }
}

function recordStableCycle(s: CampaignState, cfg: GameConfig): void {
  const max = cfg.campaign.miracle_max_charges;
  if (s.miracleCharges >= max) return; // one charge at most, never stacked
  const needed = cfg.campaign.miracle_recharge_stable_victories;
  s.stableCycles = Math.min(needed, s.stableCycles + 1);
  if (s.stableCycles >= needed) {
    s.miracleCharges = Math.min(max, s.miracleCharges + 1);
    log(s, 'miracle_charged', "The goddess's miracle is charged again.");
  } else {
    log(s, 'stable_cycle', `Stable cycle ${s.stableCycles}/${needed} towards the goddess's miracle.`);
  }
}

function fallToSiege(s: CampaignState, cfg: GameConfig): void {
  if (s.expedition) {
    // Nobody can stay in the labyrinth once the way to it is lost.
    s.expedition.combat = null;
    finishExpedition(s, 'The expedition was called back as the frontier fell.');
  }
  s.phase = 'SANCTUARY_SIEGE';
  s.stableCycles = 0;
  s.nextInvasionHour = s.simHour + cfg.clock.sanctuary_siege_delay_hours;
  log(s, 'retreat', 'The frontier has fallen. The guild retreats behind the sanctuary walls; outside production stops.');
}

function restoreFrontier(s: CampaignState, cfg: GameConfig, what: string): void {
  s.phase = 'STABLE_FRONTIER';
  s.stableCycles = 0; // the battle that restores operations does not count as a cycle
  s.nextInvasionHour = s.simHour + cfg.clock.invasion_interval_hours;
  retrieveAllAt(s, 'frontier', 'frontier secured');
  log(s, 'frontier_restored', `${what} The frontier holds and access to secured production is restored.`);
}

/** Undo every wound of the prologue: nobody stays stone, nothing stays broken. */
function restoreEveryone(s: CampaignState): void {
  for (const adv of s.adventurers) {
    if (adv.condition !== 'ready') restoreAdventurer(s, adv.id);
    adv.hp = adv.maxHp;
    adv.gauge = 0;
    adv.sp = adv.maxSp;
  }
  for (const d of s.structures) d.hp = d.maxHp;
}

/** The champions are called; the monsters are at the sanctuary's own gate. */
export function beginPrologueDefense(s: CampaignState, cfg: GameConfig): void {
  if (s.phase !== 'PROLOGUE') fail('The prologue is over.');
  if (s.pendingBattle) fail('The attack is already at the gate.');
  if (s.seal.freeCredits > 0) {
    fail(`Call all ${cfg.roster.starter_free_summons} champions first; ${s.seal.freeCredits} of the goddess's summons remain.`);
  }
  s.pendingBattle = { kind: 'tutorial_defense', map: 'sanctuary', dueHour: s.simHour };
  log(s, 'invasion', 'Monsters reach the sanctuary. The first defense begins.');
}

/** The sanctuary is safe for now: the clock starts and the guild is on its own. */
export function completePrologue(s: CampaignState, cfg: GameConfig): void {
  restoreEveryone(s);
  evacuateMap(s, 'sanctuary');
  s.phase = 'STABLE_FRONTIER';
  s.resources = { ...cfg.resources.starting_stockpile };
  s.seal.freeCredits += cfg.roster.bonus_early_summon_credits;
  s.nextInvasionHour = s.simHour + cfg.clock.invasion_interval_hours;
  s.sanctuary.automatedAmmo = cfg.defense.sanctuary_initial_automated_ammo;
  log(s, 'prologue_done', "The sanctuary holds. The goddess's protection fades; the guild must now find its own strength in the labyrinth.");
}

/** Debug: call the remaining champions and skip the first defense. */
export function skipPrologue(s: CampaignState, cfg: GameConfig, summonOne: (classId: string) => void): void {
  if (s.phase !== 'PROLOGUE') fail('The prologue is over.');
  let i = 0;
  while (s.seal.freeCredits > 0) summonOne(cfg.roster.classes[i++ % cfg.roster.classes.length] as string);
  s.battle = null;
  s.pendingBattle = null;
  completePrologue(s, cfg);
}

/** Debug / headless shortcut: declare the outcome of the pending battle without fighting it. */
export function resolveBattle(s: CampaignState, cfg: GameConfig, cmd: Extract<Command, { type: 'resolve_battle' }>): void {
  const battle = s.pendingBattle ?? fail('There is no battle to resolve.');
  const named = [...new Set(cmd.solidified ?? [])];
  const placements = named.map((id) => {
    const adv = getAdventurer(s, id);
    const structure = adv.assignment.type === 'defense' ? getStructure(s, adv.assignment.structureId) : undefined;
    if (!structure || structure.map !== battle.map) fail(`${adv.name} is not deployed on the ${battle.map} map.`);
    return { id, structureId: structure.id };
  });
  // Only defenders who actually fell become statues; a lost gate does not solidify everyone.
  for (const p of placements) solidify(s, cfg, p.id, battle.map, p.structureId);
  if (battle.map === 'sanctuary') {
    s.sanctuary.automatedAmmo = Math.max(0, s.sanctuary.automatedAmmo - (cmd.ammoSpent ?? 0));
  }
  const fallen = [...(s.battle?.fallen ?? []), ...named];
  s.battle = null;
  s.pendingBattle = null;
  concludeBattle(s, cfg, battle.kind, cmd.result === 'win', fallen, cmd.miracleChoices);
}

/** Apply a decided battle to the campaign: this is the crisis state machine. */
export function concludeBattle(
  s: CampaignState,
  cfg: GameConfig,
  kind: BattleKind,
  won: boolean,
  fallen: string[],
  miracleChoices?: string[],
): void {
  // Whatever the outcome, the defenders stand down. Their posts are remembered for next time.
  const map = kind === 'sanctuary_siege' || kind === 'tutorial_defense' ? 'sanctuary' : 'frontier';
  for (const d of s.structures) {
    if (d.map === map && d.occupantId) getAdventurer(s, d.occupantId).lastPost = d.id;
  }
  evacuateMap(s, map);
  switch (kind) {
    case 'tutorial_defense':
      if (won) completePrologue(s, cfg);
      else {
        // The first defense cannot end the story: she turns the hour back and they try again.
        restoreEveryone(s);
        s.pendingBattle = { kind: 'tutorial_defense', map: 'sanctuary', dueHour: s.simHour };
        log(s, 'prologue_retry', 'The gate breaks, and the goddess turns the hour back. The defenders stand ready once more.');
      }
      break;
    case 'frontier_defense':
      if (won) {
        s.nextInvasionHour = s.simHour + cfg.clock.invasion_interval_hours;
        retrieveAllAt(s, 'frontier', 'frontier held');
        log(s, 'defense_won', 'The frontier held against the invasion.');
        recordStableCycle(s, cfg);
      } else if (s.miracleCharges > 0) {
        evacuateMap(s, 'frontier');
        s.miracleCharges -= 1;
        s.stableCycles = 0;
        s.phase = 'DIVINE_EMERGENCY';
        s.nextInvasionHour = s.simHour + cfg.clock.invasion_interval_hours;
        log(s, 'miracle', 'The frontier fell. The goddess spends her miracle to banish the invasion; ward-based production is crippled.');
        const count = miracleRestoreCount(cfg, fallen.length);
        if (count > 0) {
          s.pendingMiracle = { eligibleIds: fallen, count };
          if (miracleChoices) chooseMiracleTargets(s, miracleChoices);
        }
      } else {
        evacuateMap(s, 'frontier');
        fallToSiege(s, cfg);
      }
      break;
    case 'frontier_rematch':
    case 'frontier_breakthrough':
      if (won) {
        restoreFrontier(s, cfg, kind === 'frontier_rematch' ? 'The rematch was won.' : 'The breakthrough succeeded.');
      } else {
        evacuateMap(s, 'frontier');
        fallToSiege(s, cfg);
      }
      break;
    case 'sanctuary_siege':
      if (won) {
        s.phase = 'COUNTEROFFENSIVE_PREPARATION';
        s.nextInvasionHour = s.simHour + cfg.clock.post_sanctuary_interval_hours;
        // Statues inside the walls are already in protected ground.
        retrieveAllAt(s, 'sanctuary', 'sanctuary held');
        log(s, 'siege_won', 'The sanctuary held. The monsters withdraw to regroup, but the outside is still cut off.');
      } else {
        s.phase = 'GAME_OVER';
        s.nextInvasionHour = null;
        log(s, 'game_over', 'The sanctuary gate was destroyed. The last sanctuary has fallen.');
      }
      break;
  }
}

/** The one exception to treatment cost and time: chosen defenders are fully restored at once. */
export function chooseMiracleTargets(s: CampaignState, adventurerIds: string[]): void {
  const pending = s.pendingMiracle ?? fail('The goddess is not offering a miracle right now.');
  const chosen = [...new Set(adventurerIds)];
  if (chosen.length !== pending.count) fail(`Choose exactly ${pending.count} fallen defender(s) for the goddess to restore.`);
  for (const id of chosen) {
    if (!pending.eligibleIds.includes(id)) fail(`${getAdventurer(s, id).name} did not fall in this battle.`);
  }
  for (const id of chosen) {
    restoreAdventurer(s, id);
    log(s, 'miracle_restored', `${getAdventurer(s, id).name} was fully restored by the goddess.`);
  }
  s.pendingMiracle = null;
}

export function startFrontierRebuild(s: CampaignState, cfg: GameConfig): void {
  if (s.phase !== 'COUNTEROFFENSIVE_PREPARATION') fail('The frontier can only be rebuilt after the sanctuary has held.');
  if (s.rebuild) fail('The frontier outpost is already being rebuilt.');
  const finishHour = s.simHour + cfg.resources.emergency_rebuild_hours;
  if (s.nextInvasionHour !== null && finishHour > s.nextInvasionHour) {
    fail('There is not enough time to finish the outpost before the next attack.');
  }
  pay(s, cfg.resources.emergency_rebuild_cost, 'rebuild the frontier outpost');
  s.rebuild = { finishHour };
  log(s, 'rebuild_started', `Rebuilding the frontier outpost (${cfg.resources.emergency_rebuild_hours} hours).`);
}

export function completeRebuild(s: CampaignState): void {
  s.rebuild = null;
  s.phase = 'FRONTIER_BREAKTHROUGH';
  for (const d of s.structures) if (d.map === 'frontier') d.hp = d.maxHp;
  log(s, 'rebuild_done', 'The frontier outpost stands again. The next attack will be fought there.');
  // Retrieval only: anyone already past the deadline stays lost, nobody is revived.
  const n = retrieveAllAt(s, 'frontier', 'goddess-guided retrieval');
  if (n === 0) log(s, 'retrieval_none', 'No recoverable statues remained at the frontier.');
}
