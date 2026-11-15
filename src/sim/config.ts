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
    /** Names given to summoned adventurers. A character's art is matched to her name. */
    names: string[];
    class_stats: Record<string, { max_hp: number }>;
    rest_hp_per_day: number;
    rest_gauge_per_day: number;
    rest_sp_per_day: number;
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
    sanctuary_max_automated_ammo: number;
    frontier_gate_max_hp: number;
    sanctuary_gate_max_hp: number;
    ticks_per_second: number;
    reposition_seconds: number;
    repair_materials_per_10_hp: number;
    ammo_restock: { ammo: number; construction_materials: number };
    enemy_stats: Record<string, EnemyStats>;
    structure_stats: Record<string, StructureStats>;
    class_combat: Record<string, ClassCombat>;
    turret: WeaponStats;
  };
  dungeon: {
    floor_travel_hours: number;
    recall: { ward_energy: number; hours: number };
    gather_minutes: number;
    gather_cooldown_hours: number;
    gather_danger: number;
    encounter: { gain_min: number; gain_max: number; secured_multiplier: number };
    mist_gauge: number;
    elite_respawn_hours: number;
    escape_chance: { normal: number; elite: number };
    back_row_melee_dealt: number;
    guard_multiplier: number;
    shield_wall_multiplier: number;
    ward_mist_multiplier: number;
    xp_per_level: number;
    level_cap: number;
    level_hp_bonus: number;
    level_atk_bonus: number;
    class_stats: Record<string, DungeonClassStats>;
    skills: Record<string, SkillData>;
    attacks: Record<string, EnemyAttack>;
    enemies: Record<string, DungeonEnemyData>;
  };
  ui: {
    allow_debug_state_loader: boolean;
    allow_fast_forward_time: boolean;
  };
}

export interface DungeonClassStats {
  atk: number;
  def: number;
  speed: number;
  max_sp: number;
  row: 'front' | 'back';
  melee: boolean;
  skills: string[];
}

export type SkillEffect =
  | { kind: 'damage'; power: number; pierce?: boolean; status?: 'corrode' | 'slow'; rounds?: number }
  | { kind: 'status'; status: 'corrode' | 'slow'; rounds: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'purge'; gauge: number }
  | { kind: 'party_buff'; buff: 'shield_wall' | 'ward_mist'; rounds: number }
  | { kind: 'taunt'; rounds: number };

export interface SkillData {
  name: string;
  sp: number;
  target: 'enemy' | 'all_enemies' | 'ally' | 'party' | 'self';
  text: string;
  effect: SkillEffect;
}

export interface EnemyAttack {
  name: string;
  /** A charge turn does nothing but warn of the next move. */
  charge?: boolean;
  telegraph?: string;
  kind?: 'melee' | 'ranged';
  target?: 'single' | 'row' | 'all';
  power?: number;
  gauge?: number;
}

export interface DungeonEnemyData {
  name: string;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  pattern: string[];
  xp: number;
  loot: Partial<Resources>;
}

export interface WeaponStats {
  damage: number;
  range: number;
  cooldown_seconds: number;
  /** Share of the target's armor that is ignored (0–1). */
  armor_pierce: number;
}

export interface ClassCombat extends WeaponStats {
  slow?: { factor: number; seconds: number };
  splash_radius?: number;
  corrode?: { armor_factor: number; seconds: number };
  support?: { gauge: number; heal: number };
  /** Extra multipliers when she holds a particular structure type. */
  affinity?: Record<string, { range_mult?: number; damage_mult?: number }>;
}

export interface StructureStats {
  range_mult: number;
  damage_mult: number;
  /** Share of a petrifying attack that reaches the occupant (1 = fully exposed). */
  exposure: number;
  support_mult: number;
}

export interface EnemyStats {
  hp: number;
  /** Map units per second. */
  speed: number;
  armor: number;
  gate_damage: number;
  /** Halts beside a manned structure and batters it: this many blows, on this many structures. */
  structure_attack?: { range: number; damage: number; cooldown_seconds: number; blows: number; max_structures: number };
  petrify_attack?: { range: number; gauge: number; damage: number; cooldown_seconds: number };
}

export const defaultConfig: GameConfig = raw as unknown as GameConfig;
