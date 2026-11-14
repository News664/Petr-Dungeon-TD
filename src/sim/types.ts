/**
 * Campaign domain model. Everything here is plain JSON-serialisable data:
 * no classes, no Dates, no functions. That is what makes exact save/load and
 * deterministic replay possible.
 */

export type Phase =
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
  summonedAtHour: number;
}

export type StatueLocationType = 'dungeon' | 'frontier' | 'sanctuary';

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
}

export type BattleKind = 'frontier_defense' | 'frontier_rematch' | 'sanctuary_siege' | 'frontier_breakthrough';

export interface PendingBattle {
  kind: BattleKind;
  map: DefenseMapId;
  dueHour: number;
}

/** Player must pick which fallen defenders the goddess restores. */
export interface PendingMiracle {
  eligibleIds: string[];
  count: number;
}

export interface Expedition {
  stratumId: string;
  partyIds: string[];
  startedAtHour: number;
  /** Statues picked up in the dungeon; only safe once the party returns. */
  carriedStatueIds: string[];
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
  version: 1;
  seed: number;
  rngState: number;
  phase: Phase;
  simHour: number;
  /** Sub-hour remainder from dungeon steps and battle actions (0–59). */
  minuteCarry: number;
  nextInvasionHour: number | null;
  pendingBattle: PendingBattle | null;
  pendingMiracle: PendingMiracle | null;
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
  seal: SummoningSeal;
  siegeAttempts: number;
  log: LogEntry[];
}

export type Command =
  | { type: 'advance_time'; hours?: number; minutes?: number }
  | { type: 'summon'; classId: ClassId; emergency?: boolean }
  | { type: 'assign_defender'; adventurerId: string; structureId: string }
  | { type: 'unassign_defender'; adventurerId: string }
  | { type: 'start_expedition'; partyIds: string[] }
  | { type: 'end_expedition' }
  | { type: 'report_casualty'; adventurerId: string; locationId?: string }
  | { type: 'expedition_pickup_statue'; adventurerId: string }
  | { type: 'frontier_recovery_sortie' }
  | { type: 'queue_treatment'; adventurerId: string }
  | { type: 'set_deposit_active'; depositId: string; active: boolean }
  | { type: 'defeat_boss'; stratumId: string }
  | { type: 'resolve_battle'; result: 'win' | 'loss'; solidified?: string[]; ammoSpent?: number; miracleChoices?: string[] }
  | { type: 'choose_miracle_targets'; adventurerIds: string[] }
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
