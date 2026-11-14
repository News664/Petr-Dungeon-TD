import raw from '../../config/balance.json';
import type { Resources } from './types';

/** Shape of config/balance.json. Keys stay snake_case to match the handoff file. */
export interface GameConfig {
  clock: {
    hours_per_day: number;
    invasion_interval_hours: number;
    post_sanctuary_interval_hours: number;
    solidification_permanence_hours: number;
    dungeon_step_minutes: number;
    battle_action_minutes: number;
    sanctuary_siege_delay_hours: number;
  };
  campaign: {
    stratum_floor_count: number;
    miracle_max_charges: number;
    miracle_recharge_stable_victories: number;
    miracle_restore_fraction: number;
    miracle_restore_rounding: string;
    initial_miracle_charges_debug: number;
    emergency_production_multiplier: number;
    siege_outside_production_multiplier: number;
    counteroffensive_outside_production_multiplier: number;
    frontier_recovery_sortie_hours: number;
  };
  roster: {
    starter_free_summons: number;
    bonus_early_summon_credits: number;
    max_roster: number;
    max_dungeon_party: number;
    default_summon_cooldown_hours: number;
    summon_cost: Partial<Resources>;
    emergency_summon_cost: Partial<Resources>;
    classes: string[];
    class_stats: Record<string, { max_hp: number }>;
  };
  resources: {
    starting_stockpile: Resources;
    sanctuary_ward_energy_generation_per_day: number;
    sanctuary_ward_energy_upkeep_per_day: number;
    cleared_stratum_normal_daily_output: Resources;
    cleared_stratum_ward_energy_upkeep_per_day: number;
    deposit_workers: number;
    treatment_base_reagents: number;
    treatment_hours: number;
    treatment_slots: number;
    emergency_rebuild_cost: Partial<Resources>;
    emergency_rebuild_hours: number;
    restoration_cost_brackets: { elapsed_hours_lt: number; multiplier: number }[];
  };
  defense: {
    frontier_layout: string[];
    sanctuary_layout: string[];
    structure_max_hp: Record<string, number>;
    sanctuary_initial_automated_ammo: number;
  };
  ui: {
    allow_debug_state_loader: boolean;
    allow_fast_forward_time: boolean;
  };
}

export const defaultConfig: GameConfig = raw as unknown as GameConfig;
