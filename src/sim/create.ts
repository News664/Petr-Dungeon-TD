import type { GameConfig } from './config';
import { defaultConfig } from './config';
import type { CampaignState, DefenseMapId, DefenseStructure, Stratum } from './types';

function buildStructures(map: DefenseMapId, layout: string[], cfg: GameConfig): DefenseStructure[] {
  const counts: Record<string, number> = {};
  return layout.map((type) => {
    counts[type] = (counts[type] ?? 0) + 1;
    const maxHp = cfg.defense.structure_max_hp[type] ?? 100;
    return { id: `${map}_${type}_${counts[type]}`, map, type, hp: maxHp, maxHp, occupantId: null };
  });
}

function buildStratum(id: string, name: string, cfg: GameConfig): Stratum {
  return {
    id,
    name,
    floorCount: cfg.campaign.stratum_floor_count,
    bossDefeated: false,
    secured: false,
    deposits: [
      {
        id: `${id}_deposit`,
        stratumId: id,
        dailyYield: { ...cfg.resources.cleared_stratum_normal_daily_output },
        wardUpkeepPerDay: cfg.resources.cleared_stratum_ward_energy_upkeep_per_day,
        active: false,
        workers: cfg.resources.deposit_workers,
        lastStatus: 'unsecured',
      },
    ],
  };
}

/** A brand-new campaign: empty guild hall, goddess-sponsored summons waiting at the seal. */
export function createCampaign(cfg: GameConfig = defaultConfig, seed = 1, options: { prologue?: boolean } = {}): CampaignState {
  const state = createStableCampaign(cfg, seed);
  if (!options.prologue) return state;
  // The very beginning: the goddess holds the hour still, the stores are empty,
  // and only her five sponsored summons are on offer until the sanctuary is safe.
  return {
    ...state,
    phase: 'PROLOGUE',
    nextInvasionHour: null,
    resources: { ward_energy: 0, construction_materials: 0, restoration_reagent: 0 },
    seal: { ...state.seal, freeCredits: cfg.roster.starter_free_summons },
  };
}

function createStableCampaign(cfg: GameConfig, seed: number): CampaignState {
  return {
    version: 2,
    seed,
    rngState: seed | 0,
    phase: 'STABLE_FRONTIER',
    simHour: 0,
    minuteCarry: 0,
    nextInvasionHour: cfg.clock.invasion_interval_hours,
    pendingBattle: null,
    pendingMiracle: null,
    battle: null,
    miracleCharges: Math.min(cfg.campaign.miracle_max_charges, cfg.campaign.initial_miracle_charges_debug),
    stableCycles: 0,
    resources: { ...cfg.resources.starting_stockpile },
    adventurers: [],
    statues: [],
    treatmentJobs: [],
    strata: [buildStratum('stratum_1', 'The Pale Galleries', cfg), buildStratum('stratum_2', 'The Drowned Cloister', cfg)],
    frontierStratumId: 'stratum_1',
    structures: [
      ...buildStructures('frontier', cfg.defense.frontier_layout, cfg),
      ...buildStructures('sanctuary', cfg.defense.sanctuary_layout, cfg),
    ],
    sanctuary: { automatedAmmo: cfg.defense.sanctuary_initial_automated_ammo },
    rebuild: null,
    expedition: null,
    dungeon: { discovered: {}, openGates: [], reachedFloor: {}, gatheredAtHour: {}, eliteRespawnHour: {} },
    seal: {
      nextAvailableHour: 0,
      freeCredits: cfg.roster.starter_free_summons + cfg.roster.bonus_early_summon_credits,
      summonCount: 0,
    },
    siegeAttempts: 0,
    log: [],
  };
}
