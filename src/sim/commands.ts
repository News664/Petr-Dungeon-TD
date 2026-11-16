import { beginBattle, concedeBattle, finishBattle, repostDefenders, startBattle, tickBattle } from './battle';
import { beginPrologueDefense, chooseMiracleTargets, resolveBattle, skipPrologue, startFrontierRebuild, triggerInvasion } from './campaign';
import type { GameConfig } from './config';
import { defaultConfig } from './config';
import { defeatBoss, setDepositActive } from './economy';
import { debugWinCombat, escapeCombat, resolveRound } from './combat';
import {
  debugRevealMap,
  debugTeleport,
  endExpedition,
  fieldUseItem,
  fieldUseSkill,
  gather,
  moveParty,
  pickUpStatue,
  recallExpedition,
  reportCasualty,
  startExpedition,
  useStairs,
} from './dungeon';
import { buildRecommended, buildStructure, demolishStructure } from './fortify';
import { craftItem, craftSupply, equipItem, learnSkill, refreshDerived, unequipItem } from './growth';
import { assignDefender, repairStructure, restockAmmo, setRow, setTargetPriority, summon, unassignDefender } from './roster';
import { findStatue, getAdventurer } from './selectors';
import { queueTreatment, retrieve, solidify } from './statues';
import { advanceHours, advanceMinutes, ensureClockFree, frontierRecoverySortie } from './time';
import type { CampaignState, Command, CommandResult } from './types';
import { RESOURCE_IDS } from './types';
import { RuleError, fail, log } from './util';

function run(s: CampaignState, cfg: GameConfig, cmd: Command): void {
  if (cmd.type.startsWith('debug_') && !cfg.ui.allow_debug_state_loader) fail('Debug commands are disabled.');
  // While the goddess waits for an answer, nothing else may happen.
  if (s.pendingMiracle && cmd.type !== 'choose_miracle_targets' && !cmd.type.startsWith('debug_')) {
    fail('Choose who Sakuya restores first.');
  }

  switch (cmd.type) {
    case 'advance_time':
      if (cmd.hours) advanceHours(s, cfg, cmd.hours);
      if (cmd.minutes) advanceMinutes(s, cfg, cmd.minutes);
      return;
    case 'summon':
      summon(s, cfg, cmd.classId, cmd.emergency ?? false, cmd.champion);
      return;
    case 'assign_defender':
      assignDefender(s, cfg, cmd.adventurerId, cmd.structureId);
      return;
    case 'unassign_defender':
      unassignDefender(s, cmd.adventurerId);
      return;
    case 'start_expedition':
      ensureClockFree(s);
      startExpedition(s, cfg, cmd.partyIds, cmd.floor ?? 0, cmd.stratumId);
      return;
    case 'end_expedition':
      endExpedition(s, cfg);
      return;
    case 'report_casualty':
      reportCasualty(s, cfg, cmd.adventurerId, cmd.locationId);
      return;
    case 'expedition_pickup_statue':
      pickUpStatue(s, cmd.adventurerId);
      return;
    case 'dungeon_move':
      moveParty(s, cfg, cmd.move);
      return;
    case 'dungeon_stairs':
      useStairs(s, cfg);
      return;
    case 'dungeon_gather':
      gather(s, cfg);
      return;
    case 'dungeon_recall':
      recallExpedition(s, cfg);
      return;
    case 'combat_round':
      resolveRound(s, cfg, cmd.actions);
      return;
    case 'combat_escape':
      escapeCombat(s, cfg);
      return;
    case 'set_row':
      setRow(s, cmd.adventurerId, cmd.row);
      return;
    case 'learn_skill':
      learnSkill(s, cfg, cmd.adventurerId, cmd.skillId);
      return;
    case 'craft_item':
      craftItem(s, cfg, cmd.itemId);
      return;
    case 'equip_item':
      equipItem(s, cfg, cmd.adventurerId, cmd.itemId);
      return;
    case 'unequip_item':
      unequipItem(s, cfg, cmd.adventurerId, cmd.slot);
      return;
    case 'craft_supply':
      craftSupply(s, cfg, cmd.itemId);
      return;
    case 'field_use_item':
      fieldUseItem(s, cfg, cmd.itemId, cmd.target);
      return;
    case 'field_use_skill':
      fieldUseSkill(s, cfg, cmd.adventurerId, cmd.skillId, cmd.target);
      return;
    case 'build_structure':
      buildStructure(s, cfg, cmd.map, cmd.site, cmd.structureType);
      return;
    case 'demolish_structure':
      demolishStructure(s, cmd.structureId);
      return;
    case 'build_recommended':
      buildRecommended(s, cfg, cmd.map);
      return;
    case 'debug_teleport':
      debugTeleport(s, cmd.floor, cmd.x, cmd.y);
      return;
    case 'debug_reveal_map':
      debugRevealMap(s);
      return;
    case 'debug_win_combat':
      debugWinCombat(s, cfg);
      return;
    case 'debug_set_level': {
      const level = Math.max(1, Math.min(cfg.dungeon.level_cap, Math.floor(cmd.level)));
      for (const adv of s.adventurers) {
        if (adv.condition !== 'ready') continue;
        adv.skillPoints += Math.max(0, level - adv.level) * cfg.dungeon.skill_points_per_level;
        adv.level = level;
        adv.xp = 0;
        refreshDerived(cfg, adv);
        adv.hp = adv.maxHp;
        adv.sp = adv.maxSp;
        adv.gauge = 0;
        adv.medium = null;
      }
      log(s, 'debug', `Debug: everyone trained to level ${level}.`);
      return;
    }
    case 'frontier_recovery_sortie':
      frontierRecoverySortie(s, cfg);
      return;
    case 'queue_treatment':
      queueTreatment(s, cfg, cmd.adventurerId);
      return;
    case 'set_deposit_active':
      setDepositActive(s, cmd.depositId, cmd.active);
      return;
    case 'defeat_boss':
      defeatBoss(s, cmd.stratumId);
      return;
    case 'resolve_battle':
      resolveBattle(s, cfg, cmd);
      return;
    case 'choose_miracle_targets':
      chooseMiracleTargets(s, cmd.adventurerIds);
      return;
    case 'set_player_name': {
      const name = cmd.name.replace(/\s+/g, ' ').trim();
      if (name.length < 1 || name.length > 16) fail('A name needs one to sixteen characters.');
      s.playerName = name;
      return;
    }
    case 'prologue_begin_defense':
      beginPrologueDefense(s, cfg);
      return;
    case 'debug_skip_prologue':
      skipPrologue(s, cfg, (classId) => summon(s, cfg, classId, false));
      return;
    case 'battle_start':
      startBattle(s, cfg);
      return;
    case 'battle_repost':
      repostDefenders(s, (adventurerId, structureId) => assignDefender(s, cfg, adventurerId, structureId));
      return;
    case 'battle_begin':
      beginBattle(s);
      return;
    case 'battle_tick':
      tickBattle(s, cfg, cmd.ticks);
      return;
    case 'battle_concede':
      concedeBattle(s);
      return;
    case 'battle_finish':
      finishBattle(s, cfg);
      return;
    case 'set_target_priority':
      setTargetPriority(s, cmd.adventurerId, cmd.priority);
      return;
    case 'repair_structure':
      repairStructure(s, cfg, cmd.structureId);
      return;
    case 'restock_ammo':
      restockAmmo(s, cfg);
      return;
    case 'start_frontier_rebuild':
      ensureClockFree(s);
      startFrontierRebuild(s, cfg);
      return;
    case 'debug_set_resources':
      for (const id of RESOURCE_IDS) {
        const v = cmd.resources[id];
        if (v !== undefined) s.resources[id] = Math.max(0, Math.floor(v));
      }
      log(s, 'debug', 'Debug: stockpile edited.');
      return;
    case 'debug_set_miracle':
      if (cmd.charges !== undefined) s.miracleCharges = Math.max(0, Math.min(cfg.campaign.miracle_max_charges, cmd.charges));
      if (cmd.stableCycles !== undefined) s.stableCycles = Math.max(0, cmd.stableCycles);
      log(s, 'debug', 'Debug: miracle state edited.');
      return;
    case 'debug_set_next_invasion':
      if (cmd.hour <= s.simHour) fail('The next invasion must be in the future.');
      s.nextInvasionHour = cmd.hour;
      log(s, 'debug', 'Debug: invasion rescheduled.');
      return;
    case 'debug_force_invasion':
      ensureClockFree(s);
      s.nextInvasionHour = s.simHour;
      triggerInvasion(s);
      return;
    case 'debug_solidify':
      solidify(s, cfg, cmd.adventurerId, cmd.locationType, cmd.locationId ?? 'debug');
      return;
    case 'debug_retrieve': {
      const statue = findStatue(s, cmd.adventurerId) ?? fail(`${getAdventurer(s, cmd.adventurerId).name} is not solidified.`);
      retrieve(s, statue, 'debug');
      return;
    }
  }
}

/**
 * The only entry point for changing a campaign. Pure from the outside: the
 * input state is never touched, and a rejected command returns it unchanged
 * together with the reason.
 */
export function apply(state: CampaignState, cmd: Command, cfg: GameConfig = defaultConfig): CommandResult {
  const next = structuredClone(state);
  const logStart = next.log.length;
  try {
    run(next, cfg, cmd);
  } catch (e) {
    if (e instanceof RuleError) return { state, ok: false, error: e.message, events: [] };
    throw e;
  }
  return { state: next, ok: true, events: next.log.slice(Math.min(logStart, next.log.length)) };
}

/** Apply a list of commands, throwing on the first rejection. For fixtures and tests. */
export function applyAll(state: CampaignState, cmds: Command[], cfg: GameConfig = defaultConfig): CampaignState {
  let s = state;
  for (const cmd of cmds) {
    const r = apply(s, cmd, cfg);
    if (!r.ok) throw new Error(`Command ${cmd.type} rejected: ${r.error}`);
    s = r.state;
  }
  return s;
}
