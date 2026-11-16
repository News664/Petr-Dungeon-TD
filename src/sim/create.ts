import type { GameConfig } from './config';
import { defaultConfig } from './config';
import { initialStructures } from './fortify';
import type { CampaignState, Stratum } from './types';

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
    standardCast: false,
    nextInvasionHour: null,
    resources: { ward_energy: 0, construction_materials: 0, restoration_reagent: 0 },
    // The frontier outpost is bare ground: its defenses are the player's to place.
    structures: [...initialStructures(cfg, 'frontier', false), ...initialStructures(cfg, 'sanctuary', true)],
    seal: { ...state.seal, freeCredits: cfg.roster.starter_free_summons },
  };
}

function createStableCampaign(cfg: GameConfig, seed: number): CampaignState {
  return {
    version: 5,
    standardCast: true,
    playerName: 'Master',
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
    structures: [...initialStructures(cfg, 'frontier', true), ...initialStructures(cfg, 'sanctuary', true)],
    sanctuary: { automatedAmmo: cfg.defense.sanctuary_initial_automated_ammo },
    rebuild: null,
    expedition: null,
    dungeon: { discovered: {}, openGates: [], reachedFloor: {}, gatheredAtHour: {}, eliteRespawnHour: {} },
    armory: {},
    supplies: {},
    milestones: [],
    seal: {
      nextAvailableHour: 0,
      freeCredits: cfg.roster.starter_free_summons + cfg.roster.bonus_early_summon_credits,
      summonCount: 0,
    },
    siegeAttempts: 0,
    log: [],
  };
}
