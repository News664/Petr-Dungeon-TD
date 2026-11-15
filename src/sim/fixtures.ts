import { applyAll } from './commands';
import type { GameConfig } from './config';
import { defaultConfig } from './config';
import { createCampaign } from './create';
import type { CampaignState, Command } from './types';

/**
 * Ready-made campaign states for tests and the debug console. Each one is
 * built by replaying real commands, so a fixture can never be a state the
 * rules could not produce (apart from the explicit debug edits).
 */
export interface Fixture {
  id: string;
  label: string;
  description: string;
  build: (cfg?: GameConfig) => CampaignState;
}

const CLASS_ORDER = ['Guardian', 'Gunner', 'Alchemist', 'Medic'];

function summons(n: number): Command[] {
  return Array.from({ length: n }, (_, i) => ({ type: 'summon', classId: CLASS_ORDER[i % CLASS_ORDER.length] as string }));
}

function frontierSlots(s: CampaignState): string[] {
  return s.structures.filter((d) => d.map === 'frontier').map((d) => d.id);
}

function sanctuarySlots(s: CampaignState): string[] {
  return s.structures.filter((d) => d.map === 'sanctuary').map((d) => d.id);
}

function deploy(s: CampaignState, slots: string[], ids: string[], cfg: GameConfig): CampaignState {
  return applyAll(
    s,
    ids.map((id, i) => ({ type: 'assign_defender', adventurerId: id, structureId: slots[i] as string })),
    cfg,
  );
}

function fullRoster(cfg: GameConfig): CampaignState {
  return applyAll(createCampaign(cfg), summons(cfg.roster.max_roster), cfg);
}

function stableSecured(cfg: GameConfig): CampaignState {
  return applyAll(fullRoster(cfg), [{ type: 'defeat_boss', stratumId: 'stratum_1' }, { type: 'advance_time', hours: 24 }], cfg);
}

function divineEmergency(cfg: GameConfig): CampaignState {
  let s = stableSecured(cfg);
  const slots = frontierSlots(s);
  const deployed = s.adventurers.slice(0, slots.length).map((a) => a.id);
  s = deploy(s, slots, deployed, cfg);
  const fallen = deployed.slice(0, 6);
  return applyAll(
    s,
    [
      { type: 'debug_force_invasion' },
      { type: 'resolve_battle', result: 'loss', solidified: fallen, miracleChoices: fallen.slice(0, 3) },
    ],
    cfg,
  );
}

function sanctuarySiege(cfg: GameConfig): CampaignState {
  let s = applyAll(stableSecured(cfg), [{ type: 'debug_set_miracle', charges: 0 }], cfg);
  const deployed = s.adventurers.slice(0, 5).map((a) => a.id);
  s = deploy(s, frontierSlots(s), deployed, cfg);
  return applyAll(
    s,
    [{ type: 'debug_force_invasion' }, { type: 'resolve_battle', result: 'loss', solidified: deployed.slice(0, 3) }],
    cfg,
  );
}

const PREFERRED_CLASS: Record<string, string[]> = {
  watchtower: ['Gunner', 'Alchemist'],
  bunker: ['Guardian'],
  support_station: ['Medic'],
};

/** Fill a map's slots with idle adventurers, matching class to structure where possible. */
function postSensibly(s: CampaignState, map: 'frontier' | 'sanctuary', cfg: GameConfig): CampaignState {
  const idle = s.adventurers.filter((a) => a.condition === 'ready' && a.assignment.type === 'idle');
  const cmds: Command[] = [];
  const open = s.structures.filter((d) => d.map === map && !d.occupantId);
  for (const pass of ['preferred', 'anyone'] as const) {
    for (const d of open) {
      if (cmds.some((c) => c.type === 'assign_defender' && c.structureId === d.id)) continue;
      const i = idle.findIndex((a) => pass === 'anyone' || (PREFERRED_CLASS[d.type] ?? []).includes(a.classId));
      const pick = i >= 0 ? idle.splice(i, 1)[0] : undefined;
      if (pick) cmds.push({ type: 'assign_defender', adventurerId: pick.id, structureId: d.id });
    }
  }
  return applyAll(s, cmds, cfg);
}

function siegeBattle(cfg: GameConfig): CampaignState {
  const s = postSensibly(sanctuarySiege(cfg), 'sanctuary', cfg);
  return applyAll(s, [{ type: 'advance_time', hours: cfg.clock.sanctuary_siege_delay_hours }], cfg);
}

/**
 * The "just barely survived" case: one combat-ready adventurer, three rescued
 * statues in the ward, two more still lying at the overrun frontier, thin stocks.
 */
function counteroffensive(cfg: GameConfig): CampaignState {
  let s = applyAll(createCampaign(cfg), [...summons(6), { type: 'debug_set_miracle', charges: 0 }], cfg);
  const ids = s.adventurers.map((a) => a.id);
  s = deploy(s, frontierSlots(s), ids.slice(0, 2), cfg);
  s = applyAll(
    s,
    [{ type: 'debug_force_invasion' }, { type: 'resolve_battle', result: 'loss', solidified: ids.slice(0, 2) }],
    cfg,
  );
  s = deploy(s, sanctuarySlots(s), ids.slice(2, 6), cfg);
  return applyAll(
    s,
    [
      { type: 'advance_time', hours: cfg.clock.sanctuary_siege_delay_hours },
      { type: 'resolve_battle', result: 'win', solidified: ids.slice(2, 5), ammoSpent: 60 },
      { type: 'debug_set_resources', resources: { ward_energy: 60, construction_materials: 55, restoration_reagent: 40 } },
    ],
    cfg,
  );
}

function frontierBreakthrough(cfg: GameConfig): CampaignState {
  return applyAll(
    counteroffensive(cfg),
    [{ type: 'start_frontier_rebuild' }, { type: 'advance_time', hours: cfg.resources.emergency_rebuild_hours }],
    cfg,
  );
}

function recharging(cfg: GameConfig): CampaignState {
  let s = frontierBreakthrough(cfg);
  const ready = s.adventurers.filter((a) => a.condition === 'ready').map((a) => a.id);
  s = deploy(s, frontierSlots(s), ready, cfg);
  return applyAll(s, [{ type: 'debug_force_invasion' }, { type: 'resolve_battle', result: 'win' }], cfg);
}

function frontierBattle(cfg: GameConfig): CampaignState {
  return applyAll(postSensibly(stableSecured(cfg), 'frontier', cfg), [{ type: 'debug_force_invasion' }], cfg);
}

/** A balanced party of five standing at the labyrinth entrance. */
function inLabyrinth(cfg: GameConfig, level: number): CampaignState {
  const s = applyAll(fullRoster(cfg), [{ type: 'debug_set_level', level }], cfg);
  const pick = (classId: string, n: number) => s.adventurers.filter((a) => a.classId === classId).slice(0, n).map((a) => a.id);
  const partyIds = [...pick('Guardian', 1), ...pick('Gunner', 2), ...pick('Alchemist', 1), ...pick('Medic', 1)];
  return applyAll(s, [{ type: 'start_expedition', partyIds }], cfg);
}

function gameOver(cfg: GameConfig): CampaignState {
  return applyAll(siegeBattle(cfg), [{ type: 'resolve_battle', result: 'loss' }], cfg);
}

const wrap = (fn: (cfg: GameConfig) => CampaignState) => (cfg: GameConfig = defaultConfig) => fn(cfg);

export const fixtures: Fixture[] = [
  { id: 'prologue', label: 'Prologue', description: 'The very beginning: five summons from the goddess, then the first defense.', build: wrap((cfg) => createCampaign(cfg, 1, { prologue: true })) },
  { id: 'new_game', label: 'After the prologue (empty hall)', description: 'Empty guild hall with eight free summons waiting.', build: wrap((cfg) => createCampaign(cfg)) },
  { id: 'full_roster', label: 'Full roster', description: 'Eight adventurers, first stratum still unexplored.', build: wrap(fullRoster) },
  { id: 'expedition', label: 'In the labyrinth (level 1)', description: 'A fresh party of five at the entrance of the first stratum.', build: wrap((cfg) => inLabyrinth(cfg, 1)) },
  { id: 'expedition_veteran', label: 'In the labyrinth (level 5)', description: 'A seasoned party of five at the entrance: strong enough for the elite and the boss.', build: wrap((cfg) => inLabyrinth(cfg, 5)) },
  { id: 'stable_secured', label: 'Stable, stratum secured', description: 'First boss defeated; protected extraction running.', build: wrap(stableSecured) },
  { id: 'frontier_battle', label: 'Frontier attack (battle)', description: 'A scheduled attack has arrived with seven defenders posted.', build: wrap(frontierBattle) },
  { id: 'divine_emergency', label: 'Divine emergency', description: 'Frontier lost with the miracle charged: three of six fallen restored, three still lying at the frontier.', build: wrap(divineEmergency) },
  { id: 'sanctuary_siege', label: 'Sanctuary siege (preparing)', description: 'Frontier lost with no miracle. The siege arrives in a day.', build: wrap(sanctuarySiege) },
  { id: 'siege_battle', label: 'Sanctuary siege (battle)', description: 'The siege has arrived and must be resolved.', build: wrap(siegeBattle) },
  { id: 'counteroffensive', label: 'Counteroffensive preparation', description: 'Sanctuary just held: one fighter standing, three rescued statues, two at the frontier, thin stocks.', build: wrap(counteroffensive) },
  { id: 'frontier_breakthrough', label: 'Frontier breakthrough', description: 'Outpost rebuilt and frontier statues retrieved; the breakthrough battle is ahead.', build: wrap(frontierBreakthrough) },
  { id: 'recharging', label: 'Recovering (miracle 0/2)', description: 'Breakthrough won; two stable cycles needed to recharge the miracle.', build: wrap(recharging) },
  { id: 'game_over', label: 'Game over', description: 'The sanctuary gate was destroyed.', build: wrap(gameOver) },
];

export function buildFixture(id: string, cfg: GameConfig = defaultConfig): CampaignState {
  const fixture = fixtures.find((f) => f.id === id);
  if (!fixture) throw new Error(`Unknown fixture "${id}".`);
  return fixture.build(cfg);
}
