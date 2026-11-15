import { defaultConfig as cfg, frontierHeld, getStratumMap, recoverableStatues, treatmentCost } from '../sim';
import type { CampaignState } from '../sim';
import { duration } from './format';

interface Note {
  tone: 'danger' | 'warn' | 'info' | 'good';
  text: string;
}

/** What needs the guild master's attention right now, most urgent first. */
function notes(s: CampaignState): Note[] {
  const out: Note[] = [];
  const name = (id: string) => s.adventurers.find((a) => a.id === id)?.name ?? id;
  const ready = s.adventurers.filter((a) => a.condition === 'ready');
  const untilAttack = s.nextInvasionHour === null ? null : s.nextInvasionHour - s.simHour;

  if (s.pendingBattle) out.push({ tone: 'danger', text: 'The attack has arrived. Nothing else can happen until it is fought.' });

  for (const st of recoverableStatues(s)) {
    const left = st.permanenceAtHour - s.simHour;
    const where = st.locationType === 'dungeon' ? 'in the labyrinth' : st.locationType === 'frontier' ? 'at the frontier' : 'inside the walls';
    out.push({ tone: left <= 24 * 7 ? 'danger' : 'warn', text: `${name(st.adventurerId)} lies solidified ${where}. She is lost for good in ${duration(left)}.` });
  }

  if (s.phase === 'COUNTEROFFENSIVE_PREPARATION' && !s.rebuild) {
    out.push({ tone: 'warn', text: `Rebuild the frontier outpost before the monsters return${untilAttack !== null ? ` in ${duration(untilAttack)}` : ''}, or the next attack falls on the sanctuary again.` });
  }
  if (s.phase === 'DIVINE_EMERGENCY') out.push({ tone: 'warn', text: 'The goddess is spent and production is crippled. Win the coming rematch to restore it; lose it and the frontier is gone.' });
  if (s.phase === 'FRONTIER_BREAKTHROUGH') out.push({ tone: 'warn', text: 'The outpost stands again. Win the next battle there to reopen the way to the secured sites.' });
  if (s.phase === 'SANCTUARY_SIEGE') out.push({ tone: 'danger', text: 'The frontier is lost. Hold the sanctuary gate; if it falls, everything ends.' });

  if (untilAttack !== null && !s.pendingBattle && untilAttack <= 48) {
    const map = s.phase === 'SANCTUARY_SIEGE' || s.phase === 'COUNTEROFFENSIVE_PREPARATION' ? 'sanctuary' : 'frontier';
    const away = s.expedition ? ` ${s.expedition.partyIds.length} are in the labyrinth and cannot defend.` : '';
    out.push({ tone: 'warn', text: `An attack on the ${map} comes in ${duration(untilAttack)}. ${ready.length} adventurers are fit to fight.${away}` });
  }

  const waiting = s.statues.filter((st) => st.retrievedAtHour !== null && st.treatment === 'none' && !st.permanent);
  if (waiting.length > 0) {
    const cost = waiting.reduce((sum, st) => sum + treatmentCost(s, cfg, st), 0);
    out.push({ tone: 'info', text: `${waiting.length} rescued statue(s) wait in the ward. Restoring them all costs ${cost} reagent (you have ${s.resources.restoration_reagent}).` });
  }

  if (frontierHeld(s.phase)) {
    const hurt = ready.filter((a) => a.assignment.type !== 'expedition' && (a.hp < a.maxHp * 0.6 || a.gauge >= 50 || a.sp < a.maxSp * 0.4));
    if (hurt.length > 0) out.push({ tone: 'info', text: `${hurt.map((a) => a.name).join(', ')} ${hurt.length === 1 ? 'needs' : 'need'} rest. A day at the sanctuary restores health, skill points and eases the stone.` });
  }

  const broken = s.structures.filter((d) => d.hp < d.maxHp && (d.map === 'sanctuary' || frontierHeld(s.phase)));
  if (broken.length > 0) out.push({ tone: 'info', text: `${broken.length} defensive structure(s) are damaged. Repairs are under Territory.` });

  if (frontierHeld(s.phase) && !s.structures.some((d) => d.map === 'frontier')) {
    out.push({ tone: 'warn', text: 'The frontier outpost has no defenses yet. You choose where they stand when you take up positions for the first attack.' });
  }
  const points = ready.filter((a) => a.skillPoints > 0);
  if (points.length > 0) out.push({ tone: 'info', text: `${points.map((a) => a.name).join(', ')} ${points.length === 1 ? 'has' : 'have'} skill points to spend. Click a name in the roster.` });
  const fading = s.adventurers.filter((a) => a.fadesAtHour !== null && a.fadesAtHour - s.simHour <= 72);
  for (const a of fading) out.push({ tone: 'warn', text: `${a.name}'s emergency summoning runs out in ${duration(Math.max(0, a.fadesAtHour! - s.simHour))}.` });

  if (s.seal.freeCredits > 0) out.push({ tone: 'info', text: `${s.seal.freeCredits} sponsored summons remain at the seal. A full hall holds ${cfg.roster.max_roster}.` });

  const frontier = s.strata.find((st) => st.id === s.frontierStratumId);
  if (frontier && frontierHeld(s.phase) && !s.expedition) {
    const map = getStratumMap(frontier.id);
    if (map) {
      const reached = (s.dungeon.reachedFloor[frontier.id] ?? 0) + 1;
      out.push({ tone: 'good', text: `Explore ${frontier.name}: floor ${reached} of ${map.floors.length} reached. Its master waits on the last floor; defeating it secures the stratum and starts production.` });
    } else {
      out.push({ tone: 'good', text: `${frontier.name} lies beyond the secured ground. It is not charted in this prototype: the slice ends here, but the campaign keeps running.` });
    }
  }
  for (const st of s.strata) {
    for (const dep of st.deposits) {
      if (st.secured && !dep.active) out.push({ tone: 'info', text: `The extraction site in ${st.name} is shut down and produces nothing.` });
      if (st.secured && dep.lastStatus === 'unpowered') out.push({ tone: 'warn', text: `${st.name} could not be warded yesterday and produced nothing. It needs ${dep.wardUpkeepPerDay} ward energy a day.` });
    }
  }
  return out;
}

interface Upcoming {
  hour: number;
  text: string;
  tone: Note['tone'];
}

function upcoming(s: CampaignState): Upcoming[] {
  const name = (id: string) => s.adventurers.find((a) => a.id === id)?.name ?? id;
  const list: Upcoming[] = [];
  if (s.nextInvasionHour !== null) list.push({ hour: s.nextInvasionHour, text: 'Monsters attack', tone: 'warn' });
  if (s.rebuild) list.push({ hour: s.rebuild.finishHour, text: 'Frontier outpost rebuilt', tone: 'good' });
  for (const job of s.treatmentJobs) if (job.finishHour !== null) list.push({ hour: job.finishHour, text: `${name(job.adventurerId)} restored`, tone: 'good' });
  for (const st of recoverableStatues(s)) list.push({ hour: st.permanenceAtHour, text: `${name(st.adventurerId)} lost for good`, tone: 'danger' });
  if (s.seal.nextAvailableHour > s.simHour && s.seal.freeCredits === 0) list.push({ hour: s.seal.nextAvailableHour, text: 'Summoning seal ready', tone: 'info' });
  return list.filter((e) => e.hour >= s.simHour).sort((a, b) => a.hour - b.hour);
}

export function Advisor({ state }: { state: CampaignState }) {
  const list = notes(state);
  return (
    <div className="panel">
      <h2>What needs you</h2>
      {list.length === 0 ? (
        <p className="small muted">Nothing is pressing.</p>
      ) : (
        <ul className="advice">
          {list.map((n, i) => (
            <li key={i} className={`advice-${n.tone}`}>
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Calendar({ state }: { state: CampaignState }) {
  const events = upcoming(state);
  if (events.length === 0) return null;
  return (
    <ol className="calendar" aria-label="Upcoming events">
      {events.slice(0, 6).map((e, i) => (
        <li key={i} className={`advice-${e.tone}`}>
          <time>in {duration(e.hour - state.simHour)}</time>
          <span>{e.text}</span>
        </li>
      ))}
    </ol>
  );
}
