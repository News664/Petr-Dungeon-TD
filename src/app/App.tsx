import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { artUrl, validateManifest } from '../art/manifest';
import type { ArtManifest } from '../art/manifest';
import { apply, buildFixture, defaultConfig as cfg, createCampaign, deserialize, fixtures, formatHour, nextEventHour, serialize } from '../sim';
import type { CampaignState, Command } from '../sim';
import { Advisor, Calendar } from './Advisor';
import { BattlePanel, MiraclePanel } from './BattlePanel';
import { PHASE_LABEL, PHASE_NOTE, duration } from './format';
import { AdventurerSheet, WorkshopPanel } from './GrowthPanels';
import { ArtContext } from './Portrait';
import { PrologueScreen } from './PrologueScreen';
import { RosterPanel } from './RosterPanel';
import { DebugPanel, LogPanel, MemorialPanel, SealPanel, StoriesPanel, TerritoryPanel, WardPanel } from './SidePanels';
import { STORIES } from './stories';
import { TitleScreen } from './TitleScreen';

// The renderers are the heavy part of the bundle; load each only when it is needed.
const BattleScreen = lazy(() => import('./BattleScreen').then((m) => ({ default: m.BattleScreen })));
const DungeonScreen = lazy(() => import('./DungeonScreen').then((m) => ({ default: m.DungeonScreen })));

const QUICKSAVE_KEY = 'last-sanctuary.quicksave';
const AUTOSAVE_KEY = 'last-sanctuary.autosave';

export type Dispatch = (cmd: Command) => boolean;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** A save from this build, or null if there is none or it cannot be read. */
function loadSave(key: string): CampaignState | null {
  const text = read(key);
  if (!text) return null;
  try {
    return deserialize(text);
  } catch {
    return null;
  }
}

type Modal = 'prologue_done' | null;

export function App() {
  const [state, setState] = useState<CampaignState>(() => createCampaign(cfg, 1, { prologue: true }));
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [notice, setNotice] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  // A story from Sakuya being read.
  const [storyId, setStoryId] = useState<string | null>(null);
  const [hasQuicksave, setHasQuicksave] = useState(() => loadSave(QUICKSAVE_KEY) !== null);
  const [hasAutosave, setHasAutosave] = useState(() => loadSave(AUTOSAVE_KEY) !== null);
  const [art, setArt] = useState<ArtManifest | null>(null);
  // Which screen the player chose while an expedition is out.
  const [view, setView] = useState<'guild' | 'dungeon'>('dungeon');
  // The adventurer whose skills and gear are open.
  const [sheetId, setSheetId] = useState<string | null>(null);
  // The latest state, readable from the battle's frame loop without waiting for a render.
  const stateRef = useRef(state);

  const replaceState = (next: CampaignState) => {
    stateRef.current = next;
    setState(next);
    setScreen('game');
    setModal(null);
  };

  const dispatch: Dispatch = useCallback((cmd) => {
    const before = stateRef.current;
    const result = apply(before, cmd, cfg);
    if (result.ok) {
      stateRef.current = result.state;
      setState(result.state);
      if (cmd.type !== 'battle_tick') setNotice(null);
      // Moments worth stopping for.
      if (before.phase === 'PROLOGUE' && result.state.phase === 'STABLE_FRONTIER') setModal('prologue_done');
      const told = result.state.stories.find((id) => !before.stories.includes(id));
      if (told) setStoryId(told);
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

  // Character art, if any has been added.
  useEffect(() => {
    let cancelled = false;
    fetch('./art/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((manifest: ArtManifest | null) => {
        if (cancelled || !manifest) return;
        const problems = validateManifest(manifest);
        if (problems.length > 0) console.warn('Art manifest problems:', problems);
        else setArt(manifest);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Autosave between actions; a running battle is saved when it pauses or ends.
  const fighting = state.battle !== null && state.battle.outcome === 'ongoing' && !state.battle.deploying;
  useEffect(() => {
    if (screen !== 'game' || fighting || state.phase === 'GAME_OVER') return;
    if (write(AUTOSAVE_KEY, serialize(state))) setHasAutosave(true);
  }, [state, screen, fighting]);

  const quicksave = () => {
    if (write(QUICKSAVE_KEY, serialize(state))) {
      setHasQuicksave(true);
      setNotice({ kind: 'info', text: `Saved at ${formatHour(state.simHour)}.` });
    } else {
      setNotice({ kind: 'error', text: 'This browser would not store the save.' });
    }
  };

  const quickload = () => {
    const loaded = loadSave(QUICKSAVE_KEY);
    if (!loaded) {
      setNotice({ kind: 'error', text: 'The save could not be loaded; it may be from an older build.' });
      return;
    }
    replaceState(loaded);
    setNotice({ kind: 'info', text: `Loaded the save from ${formatHour(loaded.simHour)}.` });
  };

  const newGame = (skipPrologue: boolean) => {
    const seed = (Date.now() % 2_000_000_000) + 1;
    const fresh = createCampaign(cfg, seed, { prologue: true });
    replaceState(skipPrologue ? apply(fresh, { type: 'debug_skip_prologue' }, cfg).state : fresh);
    setNotice(null);
  };

  if (screen === 'title') {
    return (
      <div className="shell title-shell" style={artUrl(art, 'places/title') ? { backgroundImage: `linear-gradient(rgba(13,15,18,0.55), rgba(13,15,18,0.92)), url(${artUrl(art, 'places/title')})` } : undefined}>
        <TitleScreen
          hasAutosave={hasAutosave}
          onNew={() => newGame(false)}
          onSkip={() => newGame(true)}
          onContinue={() => {
            const saved = loadSave(AUTOSAVE_KEY);
            if (saved) replaceState(saved);
            else setHasAutosave(false);
          }}
        />
      </div>
    );
  }

  const prologue = state.phase === 'PROLOGUE';
  // The labyrinth takes the screen unless an attack needs attention or the player went back to the guild.
  const inDungeon = state.expedition !== null && state.battle === null && state.pendingBattle === null && state.pendingMiracle === null && view === 'dungeon';
  const inGuild = state.battle === null && !inDungeon && !prologue;
  const blocked = state.pendingBattle !== null || state.pendingMiracle !== null || state.phase === 'GAME_OVER';
  const untilInvasion = state.nextInvasionHour === null ? null : state.nextInvasionHour - state.simHour;
  const needed = cfg.campaign.miracle_recharge_stable_victories;
  const sheet = state.adventurers.find((a) => a.id === sheetId);
  const awayAtAttack = state.expedition !== null && untilInvasion !== null && untilInvasion <= 24;

  return (
    <ArtContext.Provider value={art}>
      <div className="shell">
        <header className="masthead">
          <div>
            <p className="eyebrow">The Last Sanctuary · {state.playerName}</p>
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
              <dt>The Flowering</dt>
              <dd className={state.miracleCharges > 0 ? 'good' : ''}>
                {prologue ? 'Holding the hour' : state.miracleCharges > 0 ? 'Ready' : `Spent · ${state.stableCycles}/${needed} stable cycles`}
              </dd>
            </div>
            <div>
              <dt>Blossom-light</dt>
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

        {modal && (
          <div className="modal" role="dialog" aria-modal="true" aria-label="The sanctuary holds">
            <div className="panel story">
              {modal === 'prologue_done' ? (
                <>
                  <p className="eyebrow">The sanctuary holds</p>
                  <h2>Now the hours run again</h2>
                  <p>
                    Sakuya lets the hour go. Her protection fades from the walls, and what is left of it sits in your stores: a starter
                    stockpile, and {cfg.roster.bonus_early_summon_credits} more summons she can still pay for.
                  </p>
                  <p>
                    The Still Tide will come for the frontier every {duration(cfg.clock.invasion_interval_hours)}. Between attacks, send a party
                    into the labyrinth: it is the only source of strength, materials and answers. Anyone who falls becomes a statue where she
                    stands, and is lost for good if she is not brought home within{' '}
                    {duration(cfg.clock.solidification_permanence_hours)}.
                  </p>
                  <p className="muted">Time only moves when you spend it. The panel "What needs you" keeps track of what is urgent.</p>
                </>
              ) : null}
              <button className="primary large" onClick={() => setModal(null)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {storyId && STORIES[storyId] && !modal && (
          <div className="modal" role="dialog" aria-modal="true" aria-label={STORIES[storyId].title}>
            <div className="panel story">
              <p className="eyebrow">{STORIES[storyId].speaker} · {STORIES[storyId].when}</p>
              <h2>{STORIES[storyId].title}</h2>
              {STORIES[storyId].paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
              <button className="primary large" onClick={() => setStoryId(null)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {state.battle && (
          <Suspense fallback={<p className="muted">Preparing the field…</p>}>
            <BattleScreen state={state} stateRef={stateRef} dispatch={dispatch} />
          </Suspense>
        )}

        {prologue && !state.battle && <PrologueScreen state={state} dispatch={dispatch} />}

        {inDungeon && (
          <Suspense fallback={<p className="muted">Lighting the lanterns…</p>}>
            <DungeonScreen state={state} dispatch={dispatch} onLeaveView={() => setView('guild')} />
          </Suspense>
        )}

        <main className="columns" hidden={!inGuild}>
          <section className="column">
            {state.pendingMiracle && <MiraclePanel state={state} dispatch={dispatch} />}
            {state.pendingBattle && !state.pendingMiracle && <BattlePanel state={state} dispatch={dispatch} />}
            {state.phase === 'GAME_OVER' && (
              <div className="panel alert">
                {artUrl(art, 'people/iwanaga') && <img className="story-art" src={artUrl(art, 'people/iwanaga') ?? ''} alt="Iwanaga" />}
                <h2>The last sanctuary has fallen</h2>
                <p className="small">
                  Iwanaga does not break what she collects. {state.playerName} is set in the seal she kept, a statue that goes on calling champions
                  across the worlds, one after another, for a collection that will never be finished.
                </p>
                <p className="small muted">Load your quicksave, or return to the title and begin again.</p>
              </div>
            )}

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
              {awayAtAttack && <p className="small warn">The party in the labyrinth will not be back in time to defend unless you bring it home.</p>}
              <Calendar state={state} />
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
                <button onClick={quicksave}>Quicksave</button>
                <button disabled={!hasQuicksave} onClick={quickload}>
                  Quickload
                </button>
                <button onClick={() => setScreen('title')}>Title</button>
              </div>
            </div>

            <SealPanel state={state} dispatch={dispatch} />
            <details className="debug-tools">
              <summary>Debug tools</summary>
              <DebugPanel state={state} dispatch={dispatch} fixtures={fixtures} onLoadFixture={(id) => replaceState(buildFixture(id))} />
            </details>
          </section>

          <section className="column wide">
            <Advisor state={state} />
            {sheet && <AdventurerSheet state={state} adv={sheet} dispatch={dispatch} onClose={() => setSheetId(null)} />}
            <RosterPanel state={state} dispatch={dispatch} onOpenDungeon={() => setView('dungeon')} onOpenSheet={setSheetId} />
            <LogPanel state={state} />
          </section>

          <section className="column">
            <TerritoryPanel state={state} dispatch={dispatch} />
            <WardPanel state={state} />
            <MemorialPanel state={state} />
            <StoriesPanel state={state} onReadStory={setStoryId} />
            <WorkshopPanel state={state} dispatch={dispatch} />
          </section>
        </main>
      </div>
    </ArtContext.Provider>
  );
}
