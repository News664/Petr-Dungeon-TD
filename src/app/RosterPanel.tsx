import { useState } from 'react';
import { defaultConfig as cfg, findStatue, frontierHeld, recoverableStatues, treatmentCost } from '../sim';
import type { Adventurer, CampaignState } from '../sim';
import type { Dispatch } from './App';
import { duration } from './format';

function StatusCell({ state, adv, dispatch }: { state: CampaignState; adv: Adventurer; dispatch: Dispatch }) {
  if (adv.condition === 'ready') return <span className="good">Ready</span>;
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

export function RosterPanel({ state, dispatch }: { state: CampaignState; dispatch: Dispatch }) {
  const [party, setParty] = useState<string[]>([]);
  const expedition = state.expedition;
  const canDeployFrontier = frontierHeld(state.phase);
  const selectable = party.filter((id) => state.adventurers.some((a) => a.id === id && a.condition === 'ready' && a.assignment.type === 'idle'));
  const dungeonStatues = recoverableStatues(state, 'dungeon').filter((st) => !expedition?.carriedStatueIds.includes(st.adventurerId));
  const frontierStatues = recoverableStatues(state, 'frontier');
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
                    <td className="muted">{adv.classId}</td>
                    <td>
                      <StatusCell state={state} adv={adv} dispatch={dispatch} />
                    </td>
                    <td>
                      {adv.condition !== 'ready' ? (
                        <span className="muted">—</span>
                      ) : adv.assignment.type === 'expedition' ? (
                        <span>
                          In the labyrinth{' '}
                          <button className="inline danger" onClick={() => dispatch({ type: 'report_casualty', adventurerId: adv.id })}>
                            Falls
                          </button>
                        </span>
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
                              disabled={(d.occupantId !== null && d.occupantId !== adv.id) || (d.map === 'frontier' && !canDeployFrontier)}
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
              {expedition.partyIds.length} in the labyrinth since {duration(state.simHour - expedition.startedAtHour)} ago
              {expedition.carriedStatueIds.length > 0 && ` · carrying ${expedition.carriedStatueIds.length} statue(s)`}.
            </p>
            <div className="row">
              {dungeonStatues.map((st) => (
                <button key={st.adventurerId} onClick={() => dispatch({ type: 'expedition_pickup_statue', adventurerId: st.adventurerId })}>
                  Secure {state.adventurers.find((a) => a.id === st.adventurerId)?.name}'s statue
                </button>
              ))}
              {state.frontierStratumId === expedition.stratumId && (
                <button onClick={() => dispatch({ type: 'defeat_boss', stratumId: expedition.stratumId })}>Defeat the stratum boss</button>
              )}
              <button className="primary" onClick={() => dispatch({ type: 'end_expedition' })}>
                Return to the sanctuary
              </button>
            </div>
            <p className="muted small">Stand-in for the dungeon layer: spend time with the clock, mark anyone who falls in the roster above.</p>
          </>
        ) : (
          <>
            <div className="row">
              <button
                className="primary"
                disabled={selectable.length === 0}
                onClick={() => dispatch({ type: 'start_expedition', partyIds: selectable }) && setParty([])}
              >
                Send {selectable.length || ''} into the labyrinth
              </button>
              {frontierStatues.length > 0 && canDeployFrontier && (
                <button onClick={() => dispatch({ type: 'frontier_recovery_sortie' })}>
                  Recover {frontierStatues.length} frontier statue(s) · {duration(cfg.campaign.frontier_recovery_sortie_hours)}
                </button>
              )}
            </div>
            <p className={`small ${overlap ? 'warn' : 'muted'}`}>
              {overlap ?? `Tick up to ${cfg.roster.max_dungeon_party} reserve adventurers in the roster to form a party.`}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
