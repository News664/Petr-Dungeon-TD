/**
 * Campaign domain model. Everything here is plain JSON-serialisable data:
 * no classes, no Dates, no functions. That is what makes exact save/load and
 * deterministic replay possible.
 */

export type Phase =
  | 'PROLOGUE'
  | 'STABLE_FRONTIER'
  | 'DIVINE_EMERGENCY'
  | 'SANCTUARY_SIEGE'
  | 'COUNTEROFFENSIVE_PREPARATION'
  | 'FRONTIER_BREAKTHROUGH'
  | 'GAME_OVER';

export const RESOURCE_IDS = ['ward_energy', 'construction_materials', 'restoration_reagent'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];
export type Resources = Record<ResourceId, number>;

export type ClassId = string;
export type StructureType = string;
export type DefenseMapId = 'frontier' | 'sanctuary';

/** `lost` = permanently solidified. */
export type Condition = 'ready' | 'solidified' | 'lost';

export type Assignment =
  | { type: 'idle' }
  | { type: 'expedition' }
  | { type: 'defense'; structureId: string };

export interface Adventurer {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  /** Solidification gauge, 0–100. At 100 she is fully solidified. */
  gauge: number;
  condition: Condition;
  assignment: Assignment;
  /** Skill points for labyrinth combat. */
  sp: number;
  maxSp: number;
  /** Where she stands in a labyrinth fight. */
  row: Row;
  /** Her standing name among the champions, e.g. "the Longshot". Null for a passing stranger. */
  epithet: string | null;
  /** The one thing that is hers alone. */
  trait: { name: string; text: string; stats: Record<string, number> } | null;
  /** Small differences in her attributes, rolled when she is summoned. */
  aptitude: Record<string, number>;
  /** What she is turning into while her gauge is above zero. Never a mixture. */
  medium: string | null;
  /** Rank in each skill she has learned (0 or absent = not learned). */
  skills: Record<string, number>;
  /** Unspent points for her skill tree. */
  skillPoints: number;
  equipment: Equipment;
  /** Set for an emergency summon: the hour she fades back to her own world. */
  fadesAtHour: number | null;
  /** The post she held in the last battle, offered again at the next deployment. */
  lastPost: string | null;
  /** Who she shoots first when holding a defensive structure. */
  targetPriority: TargetPriority;
  summonedAtHour: number;
}

export type Row = 'front' | 'back';

export type EquipSlot = 'weapon' | 'armor' | 'charm';
export type Equipment = Record<EquipSlot, string | null>;

export type TargetPriority = 'first' | 'strongest' | 'petrifier';

/** `memorial`: a permanently lost champion who was carried home anyway. */
export type StatueLocationType = 'dungeon' | 'frontier' | 'sanctuary' | 'memorial';

export interface Statue {
  adventurerId: string;
  formedAtHour: number;
  /** Always formedAtHour + the universal threshold. Never varies by location. */
  permanenceAtHour: number;
  locationType: StatueLocationType;
  locationId: string;
  /** Set when she reaches a safe facility. Abandonment exposure stops here. */
  retrievedAtHour: number | null;
  permanent: boolean;
  /** What she is made of now. */
  medium: string;
  treatment: 'none' | 'queued' | 'in_progress';
}

export interface TreatmentJob {
  adventurerId: string;
  reagentCost: number;
  queuedAtHour: number;
  startHour: number | null;
  finishHour: number | null;
}

export type DepositStatus = 'unsecured' | 'producing' | 'shut_down' | 'cut_off' | 'unpowered';

export interface Deposit {
  id: string;
  stratumId: string;
  dailyYield: Resources;
  wardUpkeepPerDay: number;
  /** Player toggle: false = site evacuated / shut down. */
  active: boolean;
  /** Aggregate worker group. Never solidified automatically in the prototype. */
  workers: number;
  lastStatus: DepositStatus;
}

export interface Stratum {
  id: string;
  name: string;
  floorCount: number;
  bossDefeated: boolean;
  secured: boolean;
  deposits: Deposit[];
}

export interface DefenseStructure {
  id: string;
  map: DefenseMapId;
  type: StructureType;
  hp: number;
  maxHp: number;
  occupantId: string | null;
  /** Build site it stands on, and where that is on the map. */
  site: string;
  x: number;
  y: number;
  /** Part of the place itself: cannot be removed. */
  fixed: boolean;
}

export type BattleKind = 'tutorial_defense' | 'frontier_defense' | 'frontier_rematch' | 'sanctuary_siege' | 'frontier_breakthrough';

export interface PendingBattle {
  kind: BattleKind;
  map: DefenseMapId;
  dueHour: number;
}

export interface BattleEnemy {
  id: number;
  type: string;
  lane: number;
  /** Distance travelled along the lane, in thousandths of a map unit. */
  progress: number;
  hp: number;
  maxHp: number;
  slowTicks: number;
  /** Speed percentage while slowed (e.g. 50). */
  slowPct: number;
  corrodeTicks: number;
  /** Armor percentage while corroded (e.g. 50). */
  corrodePct: number;
  cooldown: number;
  /** Structure this enemy has stopped to batter, if any. */
  siegeTarget: string | null;
  siegeBlows: number;
  /** Structures it has already battered and will not attack again. */
  battered: string[];
}

export type ShotKind = 'attack' | 'splash' | 'support' | 'petrify' | 'turret' | 'structure';

/** Visual record of something that happened in the last tick command. No effect on rules. */
export interface BattleShot {
  kind: ShotKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A defense battle in progress. Lives in the campaign state so it saves and replays exactly. */
export interface DefenseBattle {
  kind: BattleKind;
  map: DefenseMapId;
  tick: number;
  gateHp: number;
  gateMaxHp: number;
  enemies: BattleEnemy[];
  nextEnemyId: number;
  /** Enemies already spawned, per wave group (flattened in map order). */
  spawned: number[];
  /** Ticks until each defender may act again, by adventurer id. */
  cooldowns: Record<string, number>;
  /** Tick at which a repositioning defender becomes active, by adventurer id. */
  busyUntil: Record<string, number>;
  turretCooldowns: number[];
  fallen: string[];
  killed: number;
  leaked: number;
  ammoSpent: number;
  outcome: 'ongoing' | 'win' | 'loss';
  /** Before the first wave: posts can be changed freely and no time passes. */
  deploying: boolean;
  shots: BattleShot[];
}

/** Player must pick which fallen defenders the goddess restores. */
export interface PendingMiracle {
  eligibleIds: string[];
  count: number;
}

export interface CombatEnemy {
  id: number;
  type: string;
  hp: number;
  maxHp: number;
  /** Index of its next move in its fixed pattern. */
  patternIndex: number;
  /** Rounds of halved armor left. */
  corrode: number;
  /** Rounds of halved speed left. */
  slow: number;
}

/** `hidden`: a secret boss; it cannot be fled and securing the stratum does not depend on it. */
export type CombatKind = 'normal' | 'elite' | 'boss' | 'hidden';

/** A turn-based fight in the labyrinth. */
export interface DungeonCombat {
  kind: CombatKind;
  eliteId: string | null;
  round: number;
  enemies: CombatEnemy[];
  /** Rounds left on party-wide protections. */
  shieldWall: number;
  wardMist: number;
  taunt: { adventurerId: string; rounds: number } | null;
  /** What happened, oldest first. */
  log: string[];
}

export type CombatAction =
  | { type: 'attack'; target: number }
  | { type: 'skill'; skillId: string; target?: number | string }
  | { type: 'item'; itemId: string; target: string }
  | { type: 'guard' };

export type MoveKind = 'forward' | 'back' | 'left' | 'right' | 'turn_left' | 'turn_right';

export interface Expedition {
  stratumId: string;
  partyIds: string[];
  startedAtHour: number;
  /** Statues picked up in the dungeon; only safe once the party returns. */
  carriedStatueIds: string[];
  floor: number;
  x: number;
  y: number;
  /** 0 north, 1 east, 2 south, 3 west. */
  facing: number;
  /** The tile the party came from, to fall back to when it flees. */
  prevX: number;
  prevY: number;
  /** Encounter meter, 0–100. A fight starts when it fills. */
  danger: number;
  /** Gathered and looted resources; banked only when the party gets home. */
  loot: Resources;
  combat: DungeonCombat | null;
  /** Position of each roaming elite along its patrol loop, by elite key. */
  elitePositions: Record<string, number>;
  /** Traps already sprung on this trip. */
  sprung: string[];
  /** Nameless statues taken from the labyrinth to be brought home, by tile key. */
  exhibits: string[];
  /** Supplies carried: what is unused comes home with the party. */
  pack: Record<string, number>;
  /** Lines from the last finished fight or notable event. */
  report: string[];
}

/** What the guild knows about the labyrinth. Persists between expeditions. */
export interface DungeonKnowledge {
  /** Per floor key, one string per grid row: '1' where the tile has been seen. */
  discovered: Record<string, string[]>;
  openGates: string[];
  /** Deepest floor index reached, per stratum. */
  reachedFloor: Record<string, number>;
  gatheredAtHour: Record<string, number>;
  /** Hour at which a defeated elite returns, by elite key. */
  eliteRespawnHour: Record<string, number>;
  /** Lasting changes to the labyrinth: keys found, caches emptied, clues, statues taken, secret bosses beaten. */
  flags: string[];
}

export interface SummoningSeal {
  nextAvailableHour: number;
  freeCredits: number;
  summonCount: number;
}

export interface LogEntry {
  hour: number;
  type: string;
  message: string;
}

export interface CampaignState {
  version: 6;
  /** Ready-made debug and test campaigns use a standard cast: no traits, no attribute differences. */
  standardCast: boolean;
  /** What the champions call the guild master. */
  playerName: string;
  seed: number;
  rngState: number;
  phase: Phase;
  simHour: number;
  /** Sub-hour remainder from dungeon steps and battle actions (0–59). */
  minuteCarry: number;
  nextInvasionHour: number | null;
  pendingBattle: PendingBattle | null;
  pendingMiracle: PendingMiracle | null;
  battle: DefenseBattle | null;
  miracleCharges: number;
  /** Stable cycles since the frontier and production were last restored. */
  stableCycles: number;
  resources: Resources;
  adventurers: Adventurer[];
  statues: Statue[];
  treatmentJobs: TreatmentJob[];
  strata: Stratum[];
  frontierStratumId: string | null;
  structures: DefenseStructure[];
  sanctuary: { automatedAmmo: number };
  /** Abstract frontier rebuild in progress (counteroffensive preparation). */
  rebuild: { finishHour: number } | null;
  expedition: Expedition | null;
  dungeon: DungeonKnowledge;
  /** Crafted equipment not currently worn, by item id. */
  armory: Record<string, number>;
  /** Consumable supplies in the guild's stores, by item id. */
  supplies: Record<string, number>;
  /** Discoveries that unlock recipes: floor_2, floor_3, elite, boss. */
  milestones: string[];
  /** Nameless statues carried home from the labyrinth to the memorial. */
  memorialUnnamed: number;
  seal: SummoningSeal;
  siegeAttempts: number;
  log: LogEntry[];
}

export type Command =
  | { type: 'advance_time'; hours?: number; minutes?: number }
  | { type: 'summon'; classId?: ClassId; champion?: string; emergency?: boolean }
  | { type: 'assign_defender'; adventurerId: string; structureId: string }
  | { type: 'unassign_defender'; adventurerId: string }
  | { type: 'start_expedition'; partyIds: string[]; floor?: number; stratumId?: string }
  | { type: 'dungeon_move'; move: MoveKind }
  | { type: 'dungeon_stairs' }
  | { type: 'dungeon_gather' }
  | { type: 'dungeon_recall' }
  | { type: 'dungeon_take_statue' }
  | { type: 'combat_round'; actions: Record<string, CombatAction> }
  | { type: 'combat_escape' }
  | { type: 'set_row'; adventurerId: string; row: Row }
  | { type: 'learn_skill'; adventurerId: string; skillId: string }
  | { type: 'craft_item'; itemId: string }
  | { type: 'equip_item'; adventurerId: string; itemId: string }
  | { type: 'unequip_item'; adventurerId: string; slot: EquipSlot }
  | { type: 'craft_supply'; itemId: string }
  | { type: 'field_use_item'; itemId: string; target: string }
  | { type: 'field_use_skill'; adventurerId: string; skillId: string; target: string }
  | { type: 'build_structure'; map: DefenseMapId; site: string; structureType: StructureType }
  | { type: 'demolish_structure'; structureId: string }
  | { type: 'build_recommended'; map: DefenseMapId }
  | { type: 'debug_teleport'; floor: number; x: number; y: number }
  | { type: 'debug_reveal_map' }
  | { type: 'debug_win_combat' }
  | { type: 'debug_set_level'; level: number }
  | { type: 'end_expedition' }
  | { type: 'report_casualty'; adventurerId: string; locationId?: string }
  | { type: 'expedition_pickup_statue'; adventurerId: string }
  | { type: 'frontier_recovery_sortie' }
  | { type: 'queue_treatment'; adventurerId: string }
  | { type: 'set_deposit_active'; depositId: string; active: boolean }
  | { type: 'defeat_boss'; stratumId: string }
  | { type: 'resolve_battle'; result: 'win' | 'loss'; solidified?: string[]; ammoSpent?: number; miracleChoices?: string[] }
  | { type: 'choose_miracle_targets'; adventurerIds: string[] }
  | { type: 'prologue_begin_defense' }
  | { type: 'set_player_name'; name: string }
  | { type: 'debug_skip_prologue' }
  | { type: 'battle_start' }
  | { type: 'battle_repost' }
  | { type: 'battle_begin' }
  | { type: 'battle_tick'; ticks: number }
  | { type: 'battle_concede' }
  | { type: 'battle_finish' }
  | { type: 'set_target_priority'; adventurerId: string; priority: TargetPriority }
  | { type: 'repair_structure'; structureId: string }
  | { type: 'restock_ammo' }
  | { type: 'start_frontier_rebuild' }
  | { type: 'debug_set_resources'; resources: Partial<Resources> }
  | { type: 'debug_set_miracle'; charges?: number; stableCycles?: number }
  | { type: 'debug_set_next_invasion'; hour: number }
  | { type: 'debug_force_invasion' }
  | { type: 'debug_solidify'; adventurerId: string; locationType: StatueLocationType; locationId?: string }
  | { type: 'debug_retrieve'; adventurerId: string };

export interface CommandResult {
  state: CampaignState;
  ok: boolean;
  error?: string;
  /** Log entries produced by this command. */
  events: LogEntry[];
}
