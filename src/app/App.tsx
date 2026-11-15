import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { apply, buildFixture, defaultConfig as cfg, deserialize, fixtures, formatHour, nextEventHour, serialize } from '../sim';
import type { CampaignState, Command } from '../sim';
import { PHASE_LABEL, PHASE_NOTE, duration } from './format';
import { BattlePanel, MiraclePanel } from './BattlePanel';
import { RosterPanel } from './RosterPanel';
import { DebugPanel, LogPanel, SealPanel, TerritoryPanel, WardPanel } from './SidePanels';

// The battle renderer is the heavy part of the bundle; load it only when a battle starts.
const BattleScreen = lazy(() => import('./BattleScreen').then((m) => ({ default: m.BattleScreen })));

const DungeonScreen = lazy(() => import('./DungeonScreen').then((m) => ({ default: m.DungeonScreen })));

const SAVE_KEY = 'last-sanctuary.quicksave';

export type Dispatch = (cmd: Command) => boolean;

function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

export function App() {
  const [state, setState] = useState<CampaignState>(() => buildFixture('new_game'));
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [hasSave, setHasSave] = useState(() => readSave() !== null);
  // The latest state, readable from the battle's frame loop without waiting for a render.
  const stateRef = useRef(state);
  // Which screen the player chose while an expedition is out.
  const [view, setView] = useState<'guild' | 'dungeon'>('dungeon');

  const replaceState = (next: CampaignState) => {
    stateRef.current = next;
    setState(next);
  };

  const dispatch: Dispatch = useCallback((cmd) => {
    const result = apply(stateRef.current, cmd, cfg);
    if (result.ok) {
      stateRef.current = result.state;
      setState(result.state);
      if (cmd.type !== 'battle_tick') setNotice(null);
    } else {
      setNotice({ kind: 'error', text: result.error ?? 'That is not possible.' });
    }
    return result.ok;
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = () => {
    try {
      localStorage.setItem(SAVE_KEY, serialize(state));
      setHasSave(true);
      setNotice({ kind: 'info', text: `Saved at ${formatHour(state.simHour)}.` });
    } catch {
      setNotice({ kind: 'error', text: 'This browser would not store the save.' });
    }
  };

  const load = () => {
    const text = readSave();
    if (!text) return;
    try {
      const loaded = deserialize(text);
      replaceState(loaded);
      setNotice({ kind: 'info', text: `Loaded the save from ${formatHour(loaded.simHour)}.` });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : 'The save could not be loaded.' });
    }
  };

  const loadFixture = (id: string) => {
    replaceState(buildFixture(id));
    setNotice(null);
  };

  // The labyrinth takes the screen unless an attack needs attention or the player went back to the guild.
  const inDungeon = state.expedition !== null && state.battle === null && state.pendingBattle === null && state.pendingMiracle === null && view === 'dungeon';
  const blocked = state.pendingBattle !== null || state.pendingMiracle !== null || state.phase === 'GAME_OVER';
  const untilInvasion = state.nextInvasionHour === null ? null : state.nextInvasionHour - state.simHour;
  const needed = cfg.campaign.miracle_recharge_stable_victories;

  return (
    <div className="shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">The Last Sanctuary · campaign console</p>
          <h1>{PHASE_LABEL[state.phase]}</h1>
          <p className="muted">{PHASE_NOTE[state.phase]}</p>
        </div>
        <dl className="vitals">
          <div>
            <dt>Calendar</dt>
            <dd data-testid="clock">{formatHour(state.simHour)}</dd>
          </div>
          <div>
            <dt>Next attack</dt>
            <dd className={untilInvasion !== null && untilInvasion <= 24 ? 'warn' : ''}>
              {untilInvasion === null ? '—' : state.pendingBattle ? 'now' : `in ${duration(untilInvasion)}`}
            </dd>
          </div>
          <div>
            <dt>Goddess's miracle</dt>
            <dd className={state.miracleCharges > 0 ? 'good' : ''}>
              {state.miracleCharges > 0 ? 'Charged' : `Spent · ${state.stableCycles}/${needed} stable cycles`}
            </dd>
          </div>
          <div>
            <dt>Ward energy</dt>
            <dd>{state.resources.ward_energy}</dd>
          </div>
          <div>
            <dt>Materials</dt>
            <dd>{state.resources.construction_materials}</dd>
          </div>
          <div>
            <dt>Reagent</dt>
            <dd>{state.resources.restoration_reagent}</dd>
          </div>
        </dl>
      </header>

      {notice && (
        <p className={`notice ${notice.kind}`} role="status">
          {notice.text}
        </p>
      )}

      {state.battle && (
        <Suspense fallback={<p className="muted">Preparing the field…</p>}>
          <BattleScreen state={state} stateRef={stateRef} dispatch={dispatch} />
        </Suspense>
      )}

      {inDungeon && (
        <Suspense fallback={<p className="muted">Lighting the lanterns…</p>}>
          <DungeonScreen state={state} dispatch={dispatch} onLeaveView={() => setView('guild')} />
        </Suspense>
      )}

      <main className="columns" hidden={state.battle !== null || inDungeon}>
        <section className="column">
          {state.pendingMiracle && <MiraclePanel state={state} dispatch={dispatch} />}
          {state.pendingBattle && !state.pendingMiracle && <BattlePanel state={state} dispatch={dispatch} />}

          <div className="panel">
            <h2>Time</h2>
            <p className="muted small">Time only moves when you spend it. Planning is free.</p>
            <div className="row">
              {[1, 6, 24].map((h) => (
                <button key={h} disabled={blocked} onClick={() => dispatch({ type: 'advance_time', hours: h })}>
                  +{duration(h)}
                </button>
              ))}
              <button
                className="primary"
                disabled={blocked}
                onClick={() => dispatch({ type: 'advance_time', hours: nextEventHour(state, cfg) - state.simHour })}
              >
                To next event
              </button>
            </div>
            {state.phase === 'COUNTEROFFENSIVE_PREPARATION' && (
              <div className="stack">
                <button className="primary" disabled={blocked || state.rebuild !== null} onClick={() => dispatch({ type: 'start_frontier_rebuild' })}>
                  Rebuild the frontier outpost
                </button>
                <p className="muted small">
                  {state.rebuild
                    ? `Outpost ready in ${duration(state.rebuild.finishHour - state.simHour)}. Recoverable frontier statues are retrieved when it is done.`
                    : `Costs ${cfg.resources.emergency_rebuild_cost.ward_energy} ward energy and ${cfg.resources.emergency_rebuild_cost.construction_materials} materials; takes ${duration(cfg.resources.emergency_rebuild_hours)}.`}
                </p>
              </div>
            )}
            <div className="row">
              <button onClick={save}>Quicksave</button>
              <button disabled={!hasSave} onClick={load}>
                Quickload
              </button>
            </div>
          </div>

          <SealPanel state={state} dispatch={dispatch} />
          <DebugPanel state={state} dispatch={dispatch} fixtures={fixtures} onLoadFixture={loadFixture} />
        </section>

        <section className="column wide">
          <RosterPanel state={state} dispatch={dispatch} onOpenDungeon={() => setView('dungeon')} />
          <LogPanel state={state} />
        </section>

        <section className="column">
          <TerritoryPanel state={state} dispatch={dispatch} />
          <WardPanel state={state} />
        </section>
      </main>
    </div>
  );
}
