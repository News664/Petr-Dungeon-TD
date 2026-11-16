import { useEffect, useMemo } from 'react';
import { defaultConfig as cfg, effectiveTile, elitesHere, findTile, floorKey, formatCost, getStratumMap, parseTileKey, partyTile, statuesInReach, tideState, tileAt } from '../sim';
import type { CampaignState, MoveKind } from '../sim';
import type { Dispatch } from './App';
import { AutoMap } from './AutoMap';
import { CombatPanel } from './CombatPanel';
import { DungeonView } from './DungeonView';
import type { ViewMarker } from './DungeonView';
import { duration } from './format';
import { FieldMenu } from './GrowthPanels';
import { Portrait } from './Portrait';

const D = cfg.dungeon;
const KEYS: Record<string, MoveKind> = {
  w: 'forward',
  ArrowUp: 'forward',
  s: 'back',
  ArrowDown: 'back',
  a: 'left',
  d: 'right',
  q: 'turn_left',
  ArrowLeft: 'turn_left',
  e: 'turn_right',
  ArrowRight: 'turn_right',
};
const COMPASS = ['North', 'East', 'South', 'West'];

interface Props {
  state: CampaignState;
  dispatch: Dispatch;
  onLeaveView: () => void;
}

export function DungeonScreen({ state, dispatch, onLeaveView }: Props) {
  const exp = state.expedition;
  const inCombat = !!exp?.combat;

  useEffect(() => {
    if (inCombat) return;
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || event.ctrlKey || event.metaKey || event.altKey) return;
      const move = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
      if (!move) return;
      event.preventDefault();
      dispatch({ type: 'dungeon_move', move });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, inCombat]);

  // The floor as it stands now: secret doors revealed, taken things gone, fallen doors shut.
  const flagCount = state.dungeon.flags.length;
  const rawFloor = exp ? getStratumMap(exp.stratumId)?.floors[exp.floor] : undefined;
  const floor = useMemo(
    () => (exp && rawFloor ? { ...rawFloor, grid: rawFloor.grid.map((row, y) => [...row].map((_, x) => effectiveTile(state, exp.stratumId, exp.floor, x, y)).join('')) } : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawFloor, flagCount, exp?.stratumId, exp?.floor, exp ? tideState(state, exp.stratumId)?.low : null],
  );

  if (!exp) return null;
  const map = getStratumMap(exp.stratumId);
  const stratum = state.strata.find((st) => st.id === exp.stratumId);
  if (!map || !floor || !stratum) return null;

  const floorId = floorKey(exp.stratumId, exp.floor);
  const tile = tileAt(floor, exp.x, exp.y);
  const here = partyTile(exp);
  const members = exp.partyIds.map((id) => state.adventurers.find((a) => a.id === id)!);

  // Permanent statues are shown too: they cannot be restored, but they can be carried home.
  const statues = state.statues.filter((st) => st.locationType === 'dungeon' && st.retrievedAtHour === null && !exp.carriedStatueIds.includes(st.adventurerId));
  const markers: ViewMarker[] = [
    ...elitesHere(state, exp).map((e) => ({ kind: 'elite' as const, x: e.pos[0], y: e.pos[1] })),
    ...statues.flatMap((st) => {
      const where = parseTileKey(st.locationId);
      return where && where.stratumId === exp.stratumId && where.floor === exp.floor ? [{ kind: 'statue' as const, x: where.x, y: where.y }] : [];
    }),
  ];
  floor.grid.forEach((row, y) => [...row].forEach((tile, x) => 'SHTP'.includes(tile) && markers.push({ kind: 'statue', x, y })));
  const hidden = findTile(floor, 'X');
  if (hidden) markers.push({ kind: 'boss', x: hidden[0], y: hidden[1] });
  const takeable = statuesInReach(state, exp);
  const tide = tideState(state, exp.stratumId);
  const boss = findTile(floor, 'B');
  if (boss && !stratum.bossDefeated) markers.push({ kind: 'boss', x: boss[0], y: boss[1] });

  const statuesHere = statues.filter((st) => st.locationId === here || !parseTileKey(st.locationId));
  const canLeave = tile === 'E' || tile === '<';
  const gatherKey = here;
  const gatheredAt = state.dungeon.gatheredAtHour[gatherKey];
  const gatherWait = gatheredAt === undefined ? 0 : gatheredAt + D.gather_cooldown_hours - state.simHour;
  const dangerLabel = exp.danger >= 70 ? 'Something is close' : exp.danger >= 35 ? 'Uneasy' : 'Quiet';
  const move = (kind: MoveKind) => dispatch({ type: 'dungeon_move', move: kind });
  const name = (id: string) => state.adventurers.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="dungeon">
      <div className="dungeon-main">
        <div className="panel dungeon-hud">
          <div>
            <p className="eyebrow">
              {stratum.name} · floor {exp.floor + 1}
            </p>
            <h2>{floor.name}</h2>
          </div>
          <dl className="vitals compact">
            <div>
              <dt>Facing</dt>
              <dd data-testid="facing">{COMPASS[exp.facing]}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd data-testid="position">
                {exp.x}, {exp.y}
              </dd>
            </div>
            <div>
              <dt>Danger</dt>
              <dd className={exp.danger >= 70 ? 'danger-text' : exp.danger >= 35 ? 'warn' : 'good'}>{dangerLabel}</dd>
            </div>
            {tide && (
              <div>
                <dt>Tide</dt>
                <dd className={tide.low ? 'good' : 'warn'}>
                  {tide.low ? 'Low' : 'High'} · {tide.low ? 'rises' : 'falls'} in {duration(tide.changesInHours)}
                </dd>
              </div>
            )}
            <div>
              <dt>Carried</dt>
              <dd>
                {formatCost(exp.loot)}
                {exp.carriedStatueIds.length + exp.exhibits.length > 0 && ` · ${exp.carriedStatueIds.length + exp.exhibits.length} statue(s)`}
              </dd>
            </div>
          </dl>
          <button onClick={onLeaveView}>Guild view</button>
        </div>

        <div className={`dungeon-stage ${inCombat ? 'in-combat' : ''}`}>
          <DungeonView floor={floor} floorId={floorId} x={exp.x} y={exp.y} facing={exp.facing} openGates={state.dungeon.openGates} markers={markers} dimmed={inCombat} />
          {inCombat && <CombatPanel state={state} dispatch={dispatch} />}
        </div>

        {!inCombat && (
          <div className="panel dungeon-controls">
            <div className="pad" aria-label="Movement">
              <button onClick={() => move('turn_left')} title="Turn left (Q)">
                ↶
              </button>
              <button onClick={() => move('forward')} title="Forward (W)">
                ↑
              </button>
              <button onClick={() => move('turn_right')} title="Turn right (E)">
                ↷
              </button>
              <button onClick={() => move('left')} title="Step left (A)">
                ←
              </button>
              <button onClick={() => move('back')} title="Back (S)">
                ↓
              </button>
              <button onClick={() => move('right')} title="Step right (D)">
                →
              </button>
            </div>
            <div className="stack">
              <div className="row">
                {tile === '>' && (
                  <button className="primary" onClick={() => dispatch({ type: 'dungeon_stairs' })}>
                    Descend to floor {exp.floor + 2}
                  </button>
                )}
                {tile === '<' && exp.floor > 0 && <button onClick={() => dispatch({ type: 'dungeon_stairs' })}>Climb to floor {exp.floor}</button>}
                {tile === 'G' && (
                  <button className="primary" disabled={gatherWait > 0} onClick={() => dispatch({ type: 'dungeon_gather' })}>
                    {gatherWait > 0 ? `Site exhausted for ${duration(gatherWait)}` : `Gather here · ${D.gather_minutes} min`}
                  </button>
                )}
                {statuesHere.map((st) => (
                  <button key={st.adventurerId} className="primary" onClick={() => dispatch({ type: 'expedition_pickup_statue', adventurerId: st.adventurerId })}>
                    {st.permanent ? 'Carry home' : 'Secure'} {name(st.adventurerId)}'s statue
                  </button>
                ))}
                {takeable.length > 0 && (
                  <button onClick={() => dispatch({ type: 'dungeon_take_statue' })} title="She cannot be restored. Bringing her home changes nothing but where she stands.">
                    Carry her home{takeable[0]?.holdsDoor ? ' (the door she holds will shut for good)' : takeable[0]?.prized ? ' (the one the Keeper guarded)' : ''}
                  </button>
                )}
                {canLeave && (
                  <button className="primary" onClick={() => dispatch({ type: 'end_expedition' })}>
                    Return to the sanctuary{exp.floor > 0 ? ` · ${duration(exp.floor * D.floor_travel_hours)}` : ''}
                  </button>
                )}
                <button onClick={() => dispatch({ type: 'dungeon_recall' })}>
                  Recall by the seal · {D.recall.ward_energy} ward energy, {duration(D.recall.hours)}
                </button>
              </div>
              <p className="small muted">
                {exp.report.length > 0 ? exp.report[exp.report.length - 1] : 'Move with the buttons or W A S D; turn with Q and E or the arrow keys.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <aside className="dungeon-side">
        <div className="panel">
          <h2>Chart</h2>
          <AutoMap floor={floor} floorId={floorId} discovered={state.dungeon.discovered[floorId]} x={exp.x} y={exp.y} facing={exp.facing} openGates={state.dungeon.openGates} markers={markers} />
          <p className="small muted legend">
            <span style={{ color: 'var(--ward)' }}>E</span> way out
            <span style={{ color: 'var(--ward)' }}>▼▲</span> stairs
            <span style={{ color: 'var(--amber)' }}>◆</span> gathering site
            <span>≈</span> mist
            <span style={{ color: 'var(--danger)' }}>●</span> roaming elite
            <span style={{ color: 'var(--stone)' }}>●</span> statue
            <span style={{ color: 'var(--danger)' }}>!</span> trap
            <span style={{ color: 'var(--amber)' }}>k ▣</span> key, cache
            <span style={{ color: 'var(--stone)' }}>▮</span> locked
            <span style={{ color: '#5a8fb8' }}>≋</span> flooded at high tide
          </p>
        </div>

        <div className="panel">
          <h2>Party</h2>
          <ul className="posts">
            {members.map((m) => (
              <li key={m.id}>
                <div className="post-head">
                  <span className="who">
                    <Portrait adv={m} size={30} />
                    <strong>
                      {m.name} <span className="muted">· {m.classId} Lv {m.level}</span>
                    </strong>
                  </span>
                  <button
                    className="inline"
                    disabled={inCombat}
                    title="Front row takes the melee blows; the back row is safe from them while the front stands."
                    onClick={() => dispatch({ type: 'set_row', adventurerId: m.id, row: m.row === 'front' ? 'back' : 'front' })}
                  >
                    {m.row} row
                  </button>
                </div>
                <div className="meters">
                  <span className="meter" title="Health">
                    <i style={{ width: `${(m.hp / m.maxHp) * 100}%` }} />
                  </span>
                  <span className={`meter stone-meter ${m.gauge >= 70 ? 'critical' : ''}`} title="Solidification">
                    <i style={{ width: `${m.gauge}%` }} />
                  </span>
                  <span className="small muted">
                    HP {m.hp}/{m.maxHp} · SP {m.sp}/{m.maxSp} · solidified {m.gauge}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {exp.report.length > 1 && (
            <ol className="plain small muted">
              {exp.report.slice(-6).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          )}
        </div>

        {!inCombat && <FieldMenu state={state} dispatch={dispatch} />}

        <div className="panel debug">
          <h2>Debug</h2>
          <div className="row">
            <button onClick={() => dispatch({ type: 'debug_reveal_map' })}>Reveal the maps</button>
            {inCombat && <button onClick={() => dispatch({ type: 'debug_win_combat' })}>Win this fight</button>}
            {map.floors.map((f, i) => {
              const spot = findTile(f, i === 0 ? 'E' : '<');
              return spot ? (
                <button key={i} disabled={inCombat} onClick={() => dispatch({ type: 'debug_teleport', floor: i, x: spot[0], y: spot[1] })}>
                  Jump to floor {i + 1}
                </button>
              ) : null;
            })}
            {members[0] && (
              <button className="danger" onClick={() => dispatch({ type: 'report_casualty', adventurerId: members[members.length - 1]!.id })}>
                Solidify {members[members.length - 1]!.name}
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
