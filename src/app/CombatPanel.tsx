import { useContext, useEffect, useRef, useState } from 'react';
import { artUrl } from '../art/manifest';
import { defaultConfig as cfg, enemyIntent, skillRank } from '../sim';
import type { CampaignState, CombatAction } from '../sim';
import type { Dispatch } from './App';
import { ArtContext, Portrait } from './Portrait';

const D = cfg.dungeon;

function intentText(state: CampaignState, enemyIndex: number): string {
  const enemy = state.expedition?.combat?.enemies[enemyIndex];
  const intent = enemy ? enemyIntent(cfg, enemy) : undefined;
  if (!intent) return '';
  if (intent.charge) return `${intent.name}: gathering strength`;
  const reach = intent.target === 'all' ? 'everyone' : intent.target === 'row' ? 'a whole row' : 'one target';
  return `${intent.name}: ${reach}, ${intent.kind}${intent.gauge ? ', solidifying' : ''}`;
}

/** One order per party member, then the whole round resolves at once. */
export function CombatPanel({ state, dispatch }: { state: CampaignState; dispatch: Dispatch }) {
  const exp = state.expedition;
  const combat = exp?.combat;
  // Chosen order per adventurer: "attack", "guard" or a skill id; and a target.
  const [orders, setOrders] = useState<Record<string, { what: string; target: string }>>({});
  const art = useContext(ArtContext);
  const logRef = useRef<HTMLOListElement>(null);
  const lines = combat?.log.length ?? 0;
  // Keep the newest lines in view; the log reads top to bottom in the order things happened.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);
  if (!exp || !combat) return null;

  const foes = combat.enemies.filter((e) => e.hp > 0);
  const members = exp.partyIds.map((id) => state.adventurers.find((a) => a.id === id)!);
  const firstFoe = String(foes[0]?.id ?? '');

  const orderFor = (id: string) => {
    const chosen = orders[id] ?? { what: 'attack', target: firstFoe };
    const adv = members.find((m) => m.id === id)!;
    const skill = D.skills[chosen.what];
    // Fall back when the skill can no longer be paid for.
    const gone = chosen.what.startsWith('item:') && (exp.pack[chosen.what.slice(5)] ?? 0) <= 0;
    const what = (skill && adv.sp < skill.sp) || gone ? 'attack' : chosen.what;
    const supply = what.startsWith('item:') ? what.slice(5) : null;
    const targetKind = what === 'attack' ? 'enemy' : what === 'guard' ? 'none' : supply ? 'ally' : (D.skills[what]?.target ?? 'none');
    let target = chosen.target;
    if (targetKind === 'enemy' && !foes.some((e) => String(e.id) === target)) target = firstFoe;
    if (targetKind === 'ally' && !exp.partyIds.includes(target)) target = id;
    return { what, target, targetKind };
  };

  const resolve = () => {
    const actions: Record<string, CombatAction> = {};
    for (const m of members) {
      const o = orderFor(m.id);
      if (o.what === 'attack') actions[m.id] = { type: 'attack', target: Number(o.target) };
      else if (o.what === 'guard') actions[m.id] = { type: 'guard' };
      else if (o.what.startsWith('item:')) actions[m.id] = { type: 'item', itemId: o.what.slice(5), target: o.target };
      else actions[m.id] = { type: 'skill', skillId: o.what, target: o.targetKind === 'enemy' ? Number(o.target) : o.targetKind === 'ally' ? o.target : undefined };
    }
    dispatch({ type: 'combat_round', actions });
  };

  const set = (id: string, patch: Partial<{ what: string; target: string }>) =>
    setOrders((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { what: 'attack', target: firstFoe }), ...patch } }));

  return (
    <div className="combat">
      <div className="foes">
        {combat.enemies.map((e, i) => {
          const data = D.enemies[e.type];
          return (
            <div key={e.id} className={`foe ${e.hp <= 0 ? 'down' : ''} ${combat.kind !== 'normal' ? 'major' : ''}`}>
              {artUrl(art, `monsters/${e.type}`) && <img className="foe-art" src={artUrl(art, `monsters/${e.type}`) ?? ''} alt="" />}
              <strong>{data?.name ?? e.type}</strong>
              <span className="meter danger-meter" title="Health">
                <i style={{ width: `${(e.hp / e.maxHp) * 100}%` }} />
              </span>
              <span className="small muted">
                {e.hp <= 0 ? 'defeated' : `${e.hp}/${e.maxHp}`}
                {e.corrode > 0 && ' · armor corroded'}
                {e.slow > 0 && ' · slowed'}
              </span>
              {e.hp > 0 && <span className="small intent">Next: {intentText(state, i)}</span>}
            </div>
          );
        })}
      </div>

      <div className="orders">
        {members.map((m) => {
          const o = orderFor(m.id);
          const stats = D.class_stats[m.classId];
          return (
            <div key={m.id} className="order">
              <span className="who">
                <Portrait adv={m} size={30} />
                <span>
                  <strong>{m.name}</strong>
                  <br />
                  <span className="muted small">
                    {m.classId} · {m.row} row · SP {m.sp}
                  </span>
                </span>
              </span>
              <select aria-label={`Order for ${m.name}`} value={o.what} onChange={(e) => set(m.id, { what: e.target.value })}>
                <option value="attack">Attack</option>
                <option value="guard">Guard</option>
                {(stats?.tree ?? []).map((id) => {
                  const skill = D.skills[id];
                  return skill && skill.effect.kind !== 'passive' && skillRank(m, id) > 0 ? (
                    <option key={id} value={id} disabled={m.sp < skill.sp} title={skill.text}>
                      {skill.name} ({skill.sp} SP)
                    </option>
                  ) : null;
                })}
                {Object.entries(exp.pack)
                  .filter(([, n]) => n > 0)
                  .map(([id, n]) => (
                    <option key={id} value={`item:${id}`} title={cfg.supplies.items[id]?.text}>
                      Use {cfg.supplies.items[id]?.name} (×{n})
                    </option>
                  ))}
              </select>
              {o.targetKind === 'enemy' && (
                <select aria-label={`Target for ${m.name}`} value={o.target} onChange={(e) => set(m.id, { target: e.target.value })}>
                  {foes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {D.enemies[e.type]?.name} {foes.filter((f) => f.type === e.type).length > 1 ? `#${e.id}` : ''} ({e.hp})
                    </option>
                  ))}
                </select>
              )}
              {o.targetKind === 'ally' && (
                <select aria-label={`Target for ${m.name}`} value={o.target} onChange={(e) => set(m.id, { target: e.target.value })}>
                  {members.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (HP {a.hp}, solidified {a.gauge}%)
                    </option>
                  ))}
                </select>
              )}
              {o.targetKind !== 'enemy' && o.targetKind !== 'ally' && (
                <span className="small muted">{o.what === 'guard' ? 'takes half damage and half the solidification' : D.skills[o.what]?.text}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="row">
        <button className="primary" onClick={resolve}>
          Resolve round {combat.round + 1}
        </button>
        <button disabled={combat.kind === 'boss'} onClick={() => dispatch({ type: 'combat_escape' })}>
          Flee
        </button>
        <span className="small muted">
          {combat.shieldWall > 0 && 'Shield Wall is up. '}
          {combat.wardMist > 0 && `Ward Mist: ${combat.wardMist} rounds. `}
          {combat.taunt && `${state.adventurers.find((a) => a.id === combat.taunt?.adventurerId)?.name} holds their attention.`}
        </span>
      </div>

      <ol className="combat-log" aria-label="Combat log" ref={logRef}>
        {combat.log.slice(-40).map((line, i) => (
          <li key={`${combat.log.length}-${i}`} className={line.startsWith('—') ? 'round-mark' : line.includes('solidified') ? 'danger-text' : ''}>
            {line}
          </li>
        ))}
      </ol>
    </div>
  );
}
