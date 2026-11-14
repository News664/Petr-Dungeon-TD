import { apply, applyAll, defaultConfig } from '../index';
import type { CampaignState, Command } from '../index';

export const cfg = defaultConfig;

/** Apply one command and insist it was accepted. */
export function must(state: CampaignState, cmd: Command): CampaignState {
  return applyAll(state, [cmd]);
}

/** Apply one command and return the rejection reason (fails the test if it was accepted). */
export function rejected(state: CampaignState, cmd: Command): string {
  const r = apply(state, cmd);
  if (r.ok) throw new Error(`Expected ${cmd.type} to be rejected.`);
  if (r.state !== state) throw new Error('A rejected command must return the original state.');
  return r.error ?? '';
}

/** Move the clock to an exact hour. Fails if a battle interrupts on the way. */
export function advanceTo(state: CampaignState, hour: number): CampaignState {
  const s = must(state, { type: 'advance_time', hours: hour - state.simHour });
  if (s.simHour !== hour) throw new Error(`Clock stopped at ${s.simHour}, wanted ${hour}.`);
  return s;
}

export function adv(state: CampaignState, id: string) {
  const a = state.adventurers.find((x) => x.id === id);
  if (!a) throw new Error(`No adventurer ${id}`);
  return a;
}

export function statueOf(state: CampaignState, id: string) {
  return state.statues.find((x) => x.adventurerId === id);
}

export function slots(state: CampaignState, map: 'frontier' | 'sanctuary'): string[] {
  return state.structures.filter((d) => d.map === map).map((d) => d.id);
}

export function deploy(state: CampaignState, map: 'frontier' | 'sanctuary', ids: string[]): CampaignState {
  const ss = slots(state, map);
  return applyAll(
    state,
    ids.map((id, i) => ({ type: 'assign_defender', adventurerId: id, structureId: ss[i] as string })),
  );
}

export function readyIds(state: CampaignState): string[] {
  return state.adventurers.filter((a) => a.condition === 'ready').map((a) => a.id);
}
