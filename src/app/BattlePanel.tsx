import { useState } from 'react';
import type { CampaignState } from '../sim';
import type { Dispatch } from './App';
import { BATTLE_LABEL } from './format';

function useSelection() {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return { picked, toggle };
}

/** Stand-in for the tower-defense layer: report the outcome by hand. */
export function BattlePanel({ state, dispatch }: { state: CampaignState; dispatch: Dispatch }) {
  const battle = state.pendingBattle;
  const { picked, toggle } = useSelection();
  const [ammo, setAmmo] = useState(30);
  if (!battle) return null;
  const defenders = state.structures
    .filter((d) => d.map === battle.map && d.occupantId)
    .map((d) => ({ structure: d, adv: state.adventurers.find((a) => a.id === d.occupantId)! }));
  const resolve = (result: 'win' | 'loss') =>
    dispatch({ type: 'resolve_battle', result, solidified: picked, ammoSpent: battle.map === 'sanctuary' ? ammo : undefined });

  return (
    <div className="panel alert">
      <h2>{BATTLE_LABEL[battle.kind]}</h2>
      <p className="muted small">
        The attack has arrived. Until the defense map exists, record the outcome here: tick the defenders who fell, then choose the result.
        You can still change who holds which structure in the roster.
      </p>
      {defenders.length === 0 ? (
        <p className="warn small">Nobody is deployed on the {battle.map} map.</p>
      ) : (
        <ul className="checks">
          {defenders.map(({ structure, adv }) => (
            <li key={adv.id}>
              <label>
                <input type="checkbox" checked={picked.includes(adv.id)} onChange={() => toggle(adv.id)} />
                {adv.name} <span className="muted">· {structure.id.replace(/_/g, ' ')}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {battle.map === 'sanctuary' && (
        <label className="field">
          Automated ammunition spent ({state.sanctuary.automatedAmmo} left)
          <input type="number" min={0} max={state.sanctuary.automatedAmmo} value={ammo} onChange={(e) => setAmmo(Number(e.target.value))} />
        </label>
      )}
      <div className="row">
        <button className="primary" onClick={() => resolve('win')}>
          Defense holds
        </button>
        <button className="danger" onClick={() => resolve('loss')}>
          Defense falls
        </button>
      </div>
    </div>
  );
}

export function MiraclePanel({ state, dispatch }: { state: CampaignState; dispatch: Dispatch }) {
  const pending = state.pendingMiracle;
  const { picked, toggle } = useSelection();
  if (!pending) return null;
  return (
    <div className="panel alert divine">
      <h2>The goddess intervenes</h2>
      <p className="muted small">
        She banishes the invasion and can fully restore {pending.count} of the {pending.eligibleIds.length} who fell. The others remain statues
        at the frontier until you bring them back.
      </p>
      <ul className="checks">
        {pending.eligibleIds.map((id) => {
          const adv = state.adventurers.find((a) => a.id === id)!;
          return (
            <li key={id}>
              <label>
                <input
                  type="checkbox"
                  checked={picked.includes(id)}
                  disabled={!picked.includes(id) && picked.length >= pending.count}
                  onChange={() => toggle(id)}
                />
                {adv.name} <span className="muted">· {adv.classId}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <button className="primary" disabled={picked.length !== pending.count} onClick={() => dispatch({ type: 'choose_miracle_targets', adventurerIds: picked })}>
        Restore {picked.length}/{pending.count}
      </button>
    </div>
  );
}
