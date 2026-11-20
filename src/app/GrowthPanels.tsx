import { defaultConfig as cfg, formatCost, skillRank, statsOf } from '../sim';
import type { Adventurer, CampaignState, EquipSlot } from '../sim';
import type { Dispatch } from './App';
import { title } from './format';
import { Portrait } from './Portrait';

const D = cfg.dungeon;
const E = cfg.equipment;
const STAT_LABEL: Record<string, string> = {
  atk: 'attack',
  atk_pct: '% attack',
  def: 'armor',
  speed: 'speed',
  max_hp: 'health',
  max_sp: 'skill points',
  gauge_resist_pct: '% less solidification',
  td_damage_pct: '% damage on a post',
  td_range_pct: '% reach on a post',
  support_pct: '% healing',
};

const statText = (stats: Record<string, number | undefined>) =>
  Object.entries(stats)
    .map(([key, value]) => `+${value}${STAT_LABEL[key]?.startsWith('%') ? '' : ' '}${STAT_LABEL[key] ?? key}`)
    .join(', ');

const unlocked = (state: CampaignState, key: string) => key === 'start' || state.milestones.includes(key);

/** One adventurer's skills and gear. */
export function AdventurerSheet({ state, adv, dispatch, onClose }: { state: CampaignState; adv: Adventurer; dispatch: Dispatch; onClose: () => void }) {
  const stats = statsOf(cfg, adv);
  const tree = D.class_stats[adv.classId]?.tree ?? [];
  const away = adv.assignment.type === 'expedition' || adv.condition !== 'ready';
  return (
    <div className="panel sheet">
      <div className="post-head">
        <span className="who">
          <Portrait adv={adv} size={44} />
          <span>
            <h2>
              {adv.name}
              {adv.epithet && <span className="muted">, {adv.epithet}</span>}
            </h2>
            <span className="muted small">
              {adv.classId} · level {adv.level} · {adv.xp}/{adv.level * D.xp_per_level} experience
              {adv.fadesAtHour !== null && ' · emergency summon'}
            </span>
          </span>
        </span>
        <button onClick={onClose}>Close</button>
      </div>
      <p className="small">
        Attack {stats.atk} · armor {stats.def} · speed {stats.speed} · health {adv.hp}/{stats.maxHp} · skill points {adv.sp}/{stats.maxSp}
        {stats.gaugeResist > 0 && ` · ${Math.round(stats.gaugeResist * 100)}% less solidification`}
        {stats.tdDamage > 1 && ` · +${Math.round((stats.tdDamage - 1) * 100)}% damage on a post`}
        {stats.tdRange > 1 && ` · +${Math.round((stats.tdRange - 1) * 100)}% reach on a post`}
      </p>

      {cfg.roster.champions.find((c) => c.name === adv.name)?.story && <p className="small muted">{cfg.roster.champions.find((c) => c.name === adv.name)?.story}</p>}
      {adv.trait && (
        <p className="small">
          <strong>{adv.trait.name}.</strong> {adv.trait.text}
        </p>
      )}
      {Object.keys(adv.aptitude).length > 0 && (
        <p className="small muted">
          Her own measure:{' '}
          {Object.entries(adv.aptitude)
            .map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${STAT_LABEL[key] ?? key}`)
            .join(', ')}
          .
        </p>
      )}

      <div className="subpanel">
        <h3>
          Skills <span className={adv.skillPoints > 0 ? 'good' : 'muted'}>· {adv.skillPoints} point(s) to spend</span>
        </h3>
        <ul className="tree">
          {tree.map((id) => {
            const skill = D.skills[id];
            if (!skill) return null;
            const rank = skillRank(adv, id);
            const gate = skill.requires_level ?? 1;
            const passive = skill.effect.kind === 'passive';
            const blocked = adv.skillPoints <= 0 || rank >= D.skill_max_rank || adv.level < gate || adv.condition !== 'ready';
            return (
              <li key={id} className={rank === 0 ? 'unlearned' : ''}>
                <span>
                  <strong>{skill.name}</strong>{' '}
                  <span className="muted small">
                    {passive ? 'passive' : `${skill.sp} SP`} · rank {rank}/{D.skill_max_rank}
                    {adv.level < gate && ` · needs level ${gate}`}
                  </span>
                  <br />
                  <span className="small muted">{skill.text}</span>
                </span>
                <button disabled={blocked} onClick={() => dispatch({ type: 'learn_skill', adventurerId: adv.id, skillId: id })}>
                  {rank === 0 ? 'Learn' : 'Improve'}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="small muted">Each rank above the first strengthens a skill by {Math.round(D.rank_bonus * 100)}%, or lengthens it by a round.</p>
      </div>

      <div className="subpanel">
        <h3>Equipment</h3>
        {(E.slots as EquipSlot[]).map((slot) => {
          const worn = adv.equipment[slot];
          const choices = Object.entries(E.items).filter(([id, item]) => item.slot === slot && (state.armory[id] ?? 0) > 0 && (!item.classes || item.classes.includes(adv.classId)));
          return (
            <label key={slot} className="field">
              {title(slot)}
              <select
                value={worn ?? ''}
                disabled={away}
                onChange={(e) => (e.target.value ? dispatch({ type: 'equip_item', adventurerId: adv.id, itemId: e.target.value }) : dispatch({ type: 'unequip_item', adventurerId: adv.id, slot }))}
              >
                <option value="">Nothing</option>
                {worn && <option value={worn}>{E.items[worn]?.name} ({statText(E.items[worn]?.stats ?? {})})</option>}
                {choices
                  .filter(([id]) => id !== worn)
                  .map(([id, item]) => (
                    <option key={id} value={id}>
                      {item.name} ({statText(item.stats)}) · {state.armory[id]} in the armory
                    </option>
                  ))}
              </select>
            </label>
          );
        })}
        {away && <p className="small muted">Gear can only be changed at the guild.</p>}
      </div>
    </div>
  );
}

/** The artisans: equipment recipes and expedition supplies. */
export function WorkshopPanel({ state, dispatch }: { state: CampaignState; dispatch: Dispatch }) {
  return (
    <div className="panel">
      <h2>Workshop</h2>
      <h3>Supplies</h3>
      <p className="small muted">An expedition packs up to {cfg.supplies.pack_limit_per_item} of each and brings back what it does not use.</p>
      <ul className="tree">
        {Object.entries(cfg.supplies.items).map(([id, item]) => (
          <li key={id}>
            <span>
              <strong>{item.name}</strong> <span className="muted small">· {state.supplies[id] ?? 0} in store</span>
              <br />
              <span className="small muted">{item.text}</span>
            </span>
            <button onClick={() => dispatch({ type: 'craft_supply', itemId: id })}>Make · {formatCost(item.cost)}</button>
          </li>
        ))}
      </ul>
      <h3>Equipment</h3>
      <ul className="tree">
        {Object.entries(E.items).map(([id, item]) => {
          const known = unlocked(state, item.unlock);
          return (
            <li key={id} className={known ? '' : 'unlearned'}>
              <span>
                <strong>{known ? item.name : 'Unknown recipe'}</strong>{' '}
                <span className="muted small">
                  · {item.slot}
                  {item.classes && ` · ${item.classes.join(', ')} only`}
                  {known && ` · ${state.armory[id] ?? 0} in the armory`}
                </span>
                <br />
                <span className="small muted">{known ? `${statText(item.stats)}. ${item.text}` : `Not yet ${E.unlock_text[item.unlock] ?? 'discovered'}.`}</span>
              </span>
              <button disabled={!known} onClick={() => dispatch({ type: 'craft_item', itemId: id })}>
                Make · {formatCost(item.cost)}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="small muted">Open an adventurer from the roster to equip what is in the armory.</p>
    </div>
  );
}

/** Between fights: supplies and healing skills. */
export function FieldMenu({ state, dispatch }: { state: CampaignState; dispatch: Dispatch }) {
  const exp = state.expedition;
  if (!exp) return null;
  const members = exp.partyIds.map((id) => state.adventurers.find((a) => a.id === id)!);
  const supplies = Object.entries(exp.pack).filter(([, n]) => n > 0);
  const healers = members.flatMap((m) =>
    Object.keys(m.skills)
      .filter((id) => skillRank(m, id) > 0 && ['heal', 'purge'].includes(D.skills[id]?.effect.kind ?? ''))
      .map((id) => ({ m, id, skill: D.skills[id]! })),
  );
  const needs = (a: Adventurer) => `${a.name} (HP ${a.hp}/${a.maxHp}, solidified ${a.gauge}%, SP ${a.sp})`;
  return (
    <div className="panel">
      <h2>Field menu</h2>
      {supplies.length === 0 && healers.length === 0 && <p className="small muted">The party carries no supplies and nobody here can heal.</p>}
      {supplies.map(([id, n]) => (
        <div key={id} className="field-row">
          <span className="small">
            <strong>{cfg.supplies.items[id]?.name}</strong> ×{n} <span className="muted">· {cfg.supplies.items[id]?.text}</span>
          </span>
          <div className="row">
            {members.map((a) => (
              <button key={a.id} className="inline" title={needs(a)} onClick={() => dispatch({ type: 'field_use_item', itemId: id, target: a.id })}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {healers.map(({ m, id, skill }) => (
        <div key={`${m.id}${id}`} className="field-row">
          <span className="small">
            <strong>{skill.name}</strong> <span className="muted">· {m.name}, {skill.sp} of her {m.sp} SP</span>
          </span>
          <div className="row">
            {members.map((a) => (
              <button key={a.id} className="inline" disabled={m.sp < skill.sp} title={needs(a)} onClick={() => dispatch({ type: 'field_use_skill', adventurerId: m.id, skillId: id, target: a.id })}>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="small muted">Each use takes {D.field_action_minutes} minutes. Skill points to spend can be used from the guild roster.</p>
    </div>
  );
}
