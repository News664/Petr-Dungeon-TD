import { useState } from 'react';
import { defaultConfig as cfg, findStatue, frontierHeld, recoverableStatues, treatmentCost } from '../sim';
import type { Adventurer, CampaignState } from '../sim';
import type { Dispatch } from './App';
import { duration } from './format';

function StatusCell({ state, adv, dispatch }: { state: CampaignState; adv: Adventurer; dispatch: Dispatch }) {
  if (adv.condition === 'ready') {
    const hurt = adv.hp < adv.maxHp || adv.gauge > 0;
    return (
      <span className="good">
        Ready
        {hurt && (
          <span className={adv.gauge >= 70 ? 'danger-text' : 'muted'}>
            {' '}
            · HP {adv.hp}/{adv.maxHp} · stone {adv.gauge}%
          </span>
        )}
      </span>
    );
  }
  if (adv.condition === 'lost') return <span className="stone">Permanently solidified</span>;
  const statue = findStatue(state, adv.id);
  if (!statue) return null;
  if (statue.retrievedAtHour === null) {
    const left = statue.permanenceAtHour - state.simHour;
    return (
      <span className={left <= 24 * 7 ? 'danger-text' : 'warn'}>
        Statue at {statue.locationType} · permanent in {duration(left)}
      </span>
    );
  }
  if (statue.treatment === 'none') {
    const cost = treatmentCost(state, cfg, statue);
    return (
      <span className="stone">
        Statue, safe in the ward{' '}
        <button className="inline" onClick={() => dispatch({ type: 'queue_treatment', adventurerId: adv.id })}>
          Restore ({cost} reagent)
        </button>
      </span>
    );
  }
  const job = state.treatmentJobs.find((j) => j.adventurerId === adv.id);
  return (
    <span className="stone">
      {job?.finishHour != null ? `Restoration done in ${duration(job.finishHour - state.simHour)}` : 'Waiting for a treatment bed'}
    </span>
  );
}

export function RosterPanel({ state, dispatch, onOpenDungeon }: { state: CampaignState; dispatch: Dispatch; onOpenDungeon: () => void }) {
  const [party, setParty] = useState<string[]>([]);
  const [startFloor, setStartFloor] = useState(0);
  const expedition = state.expedition;
  const canDeployFrontier = frontierHeld(state.phase);
  const selectable = party.filter((id) => state.adventurers.some((a) => a.id === id && a.condition === 'ready' && a.assignment.type === 'idle'));
  const dungeonStatues = recoverableStatues(state, 'dungeon').filter((st) => !expedition?.carriedStatueIds.includes(st.adventurerId));
  const frontierStatues = recoverableStatues(state, 'frontier');
  const deepest = Math.max(0, ...Object.values(state.dungeon.reachedFloor));
  const overlap =
    state.nextInvasionHour !== null && state.nextInvasionHour - state.simHour <= 24
      ? 'The next attack is less than a day away; anyone in the labyrinth cannot defend.'
      : null;

  const assign = (adv: Adventurer, structureId: string) =>
    structureId === ''
      ? dispatch({ type: 'unassign_defender', adventurerId: adv.id })
      : dispatch({ type: 'assign_defender', adventurerId: adv.id, structureId });

  return (
    <div className="panel">
      <h2>
        Guild roster <span className="muted">· {state.adventurers.filter((a) => a.condition !== 'lost').length}/{cfg.roster.max_roster}</span>
      </h2>
      {state.adventurers.length === 0 ? (
        <p className="muted">The guild hall is empty. Use the summoning seal to call the first champions.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Party</th>
                <th>Name</th>
                <th>Class</th>
                <th>Condition</th>
                <th>Post</th>
              </tr>
            </thead>
            <tbody>
              {state.adventurers.map((adv) => {
                const idle = adv.condition === 'ready' && adv.assignment.type === 'idle';
                return (
                  <tr key={adv.id} className={adv.condition}>
                    <td>
                      {!expedition && (
                        <input
                          type="checkbox"
                          aria-label={`Add ${adv.name} to the expedition`}
                          disabled={!idle}
                          checked={idle && party.includes(adv.id)}
                          onChange={() => setParty((p) => (p.includes(adv.id) ? p.filter((x) => x !== adv.id) : [...p, adv.id]))}
                        />
                      )}
                    </td>
                    <td>{adv.name}</td>
                    <td className="muted">
                      {adv.classId} <span className="small">Lv {adv.level}</span>
                    </td>
                    <td>
                      <StatusCell state={state} adv={adv} dispatch={dispatch} />
                    </td>
                    <td>
                      {adv.condition !== 'ready' ? (
                        <span className="muted">—</span>
                      ) : adv.assignment.type === 'expedition' ? (
                        <span>In the labyrinth</span>
                      ) : (
                        <select
                          aria-label={`Post for ${adv.name}`}
                          value={adv.assignment.type === 'defense' ? adv.assignment.structureId : ''}
                          onChange={(e) => assign(adv, e.target.value)}
                        >
                          <option value="">In reserve</option>
                          {state.structures.map((d) => (
                            <option
                              key={d.id}
                              value={d.id}
                              disabled={(d.occupantId !== null && d.occupantId !== adv.id) || (d.map === 'frontier' && !canDeployFrontier) || d.hp <= 0}
                            >
                              {d.id.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="subpanel">
        <h3>Expedition</h3>
        {expedition ? (
          <>
            <p className="small">
              {expedition.partyIds.length} in the labyrinth on floor {expedition.floor + 1}, since {duration(state.simHour - expedition.startedAtHour)} ago
              {expedition.carriedStatueIds.length > 0 && ` · carrying ${expedition.carriedStatueIds.length} statue(s)`}.
            </p>
            <div className="row">
              <button className="primary" disabled={state.pendingBattle !== null} onClick={onOpenDungeon}>
                Return to the labyrinth view
              </button>
            </div>
            {state.pendingBattle && <p className="small warn">The attack must be fought before the expedition can go on. Its members cannot defend.</p>}
          </>
        ) : (
          <>
            <div className="row">
              <button
                className="primary"
                disabled={selectable.length === 0}
                onClick={() => {
                  if (dispatch({ type: 'start_expedition', partyIds: selectable, floor: Math.min(startFloor, deepest) })) {
                    setParty([]);
                    onOpenDungeon();
                  }
                }}
              >
                Send {selectable.length || ''} into the labyrinth
              </button>
              {deepest > 0 && (
                <select aria-label="Starting floor" value={Math.min(startFloor, deepest)} onChange={(e) => setStartFloor(Number(e.target.value))}>
                  {Array.from({ length: deepest + 1 }, (_, i) => (
                    <option key={i} value={i}>
                      Start on floor {i + 1}
                      {i > 0 ? ` (${duration(i * cfg.dungeon.floor_travel_hours)} walk)` : ''}
                    </option>
                  ))}
                </select>
              )}
              {frontierStatues.length > 0 && canDeployFrontier && (
                <button onClick={() => dispatch({ type: 'frontier_recovery_sortie' })}>
                  Recover {frontierStatues.length} frontier statue(s) · {duration(cfg.campaign.frontier_recovery_sortie_hours)}
                </button>
              )}
            </div>
            <p className={`small ${overlap ? 'warn' : 'muted'}`}>
              {overlap ?? `Tick up to ${cfg.roster.max_dungeon_party} reserve adventurers in the roster to form a party.`}
              {dungeonStatues.length > 0 && ` ${dungeonStatues.length} statue(s) lie in the labyrinth.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
