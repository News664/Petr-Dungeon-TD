import { useState } from 'react';
import { RESOURCE_IDS, defaultConfig as cfg, formatCost, formatHour, productionMultiplier, rosterCount } from '../sim';
import type { CampaignState, Fixture, ResourceId } from '../sim';
import type { Dispatch } from './App';
import { duration, title } from './format';

interface PanelProps {
  state: CampaignState;
  dispatch: Dispatch;
}

export function SealPanel({ state, dispatch }: PanelProps) {
  const [classId, setClassId] = useState(cfg.roster.classes[0] ?? '');
  const wait = state.seal.nextAvailableHour - state.simHour;
  const full = rosterCount(state) >= cfg.roster.max_roster;
  return (
    <div className="panel">
      <h2>Summoning seal</h2>
      <p className="small muted">
        {full
          ? 'The guild hall is full.'
          : state.seal.freeCredits > 0
            ? `${state.seal.freeCredits} goddess-sponsored summons remain.`
            : wait > 0
              ? `Recharging: ready in ${duration(wait)}.`
              : `Ready. Costs ${formatCost(cfg.roster.summon_cost)}.`}
      </p>
      <div className="row">
        <select aria-label="Class to summon" value={classId} onChange={(e) => setClassId(e.target.value)}>
          {cfg.roster.classes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="primary" disabled={full} onClick={() => dispatch({ type: 'summon', classId })}>
          Summon
        </button>
      </div>
      <button disabled={full} onClick={() => dispatch({ type: 'summon', classId, emergency: true })}>
        Emergency summon · {formatCost(cfg.roster.emergency_summon_cost)}
      </button>
    </div>
  );
}

export function TerritoryPanel({ state, dispatch }: PanelProps) {
  const mult = productionMultiplier(state, cfg);
  return (
    <div className="panel">
      <h2>Territory</h2>
      <p className="small muted">
        Outside production at {Math.round(mult * 100)}%. Sanctuary baseline: +{cfg.resources.sanctuary_ward_energy_generation_per_day} / −
        {cfg.resources.sanctuary_ward_energy_upkeep_per_day} ward energy per day.
      </p>
      {state.strata.map((stratum) => (
        <div key={stratum.id} className="subpanel">
          <h3>
            {stratum.name}{' '}
            <span className="muted">· {stratum.secured ? 'secured' : state.frontierStratumId === stratum.id ? 'active frontier' : 'unreached'}</span>
          </h3>
          {stratum.deposits.map((dep) => (
            <div key={dep.id} className="stack">
              <p className="small">
                Extraction site: <strong>{title(dep.lastStatus)}</strong> · {dep.workers} workers
              </p>
              {stratum.secured && (
                <>
                  <p className="small muted">
                    Yields {formatCost(dep.dailyYield)} per day at full access, for {dep.wardUpkeepPerDay} ward energy of upkeep.
                  </p>
                  <button onClick={() => dispatch({ type: 'set_deposit_active', depositId: dep.id, active: !dep.active })}>
                    {dep.active ? 'Evacuate and shut down' : 'Send the workers back'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
      <div className="subpanel">
        <h3>Sanctuary defenses</h3>
        <p className="small">
          Automated ammunition: {state.sanctuary.automatedAmmo} · sieges faced: {state.siegeAttempts}
        </p>
      </div>
    </div>
  );
}

export function WardPanel({ state }: { state: CampaignState }) {
  const name = (id: string) => state.adventurers.find((a) => a.id === id)?.name ?? id;
  const running = state.treatmentJobs.filter((j) => j.startHour !== null).length;
  return (
    <div className="panel">
      <h2>
        Recovery ward <span className="muted">· {running}/{cfg.resources.treatment_slots} beds</span>
      </h2>
      {state.treatmentJobs.length === 0 ? (
        <p className="small muted">No restoration in progress. Rescued statues can be queued from the roster.</p>
      ) : (
        <ul className="plain">
          {state.treatmentJobs.map((job) => (
            <li key={job.adventurerId}>
              {name(job.adventurerId)} ·{' '}
              <span className="muted">{job.finishHour !== null ? `done in ${duration(job.finishHour - state.simHour)}` : 'waiting for a bed'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LogPanel({ state }: { state: CampaignState }) {
  const entries = state.log.slice(-60).reverse();
  return (
    <div className="panel">
      <h2>Chronicle</h2>
      {entries.length === 0 ? (
        <p className="small muted">Nothing has happened yet.</p>
      ) : (
        <ol className="log">
          {entries.map((e, i) => (
            <li key={`${state.log.length - i}`} className={`log-${e.type}`}>
              <time>{formatHour(e.hour)}</time>
              <span>{e.message}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const SHORT: Record<ResourceId, string> = { ward_energy: 'Ward', construction_materials: 'Materials', restoration_reagent: 'Reagent' };

export function DebugPanel({ state, dispatch, fixtures, onLoadFixture }: PanelProps & { fixtures: Fixture[]; onLoadFixture: (id: string) => void }) {
  const [fixtureId, setFixtureId] = useState(fixtures[0]?.id ?? '');
  const fixture = fixtures.find((f) => f.id === fixtureId);
  const ready = state.adventurers.filter((a) => a.condition === 'ready');
  const [victim, setVictim] = useState('');
  const victimId = ready.some((a) => a.id === victim) ? victim : (ready[0]?.id ?? '');
  return (
    <div className="panel debug">
      <h2>Debug</h2>
      <label className="field">
        Jump to a prepared state
        <select value={fixtureId} onChange={(e) => setFixtureId(e.target.value)}>
          {fixtures.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <p className="small muted">{fixture?.description}</p>
      <button onClick={() => onLoadFixture(fixtureId)}>Load state</button>

      <div className="row">
        <button onClick={() => dispatch({ type: 'debug_force_invasion' })}>Force the attack now</button>
        <button onClick={() => dispatch({ type: 'debug_set_miracle', charges: state.miracleCharges > 0 ? 0 : 1 })}>
          {state.miracleCharges > 0 ? 'Drain the miracle' : 'Charge the miracle'}
        </button>
      </div>

      <div className="stocks">
        {RESOURCE_IDS.map((id) => (
          <label key={id} className="field">
            {SHORT[id]}
            <input
              type="number"
              min={0}
              value={state.resources[id]}
              onChange={(e) => dispatch({ type: 'debug_set_resources', resources: { [id]: Number(e.target.value) } })}
            />
          </label>
        ))}
      </div>

      {ready.length > 0 && (
        <div className="row">
          <select aria-label="Adventurer to solidify" value={victimId} onChange={(e) => setVictim(e.target.value)}>
            {ready.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button onClick={() => dispatch({ type: 'debug_solidify', adventurerId: victimId, locationType: 'dungeon' })}>Solidify in the dungeon</button>
        </div>
      )}
    </div>
  );
}
