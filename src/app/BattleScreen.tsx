import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Application, Graphics, Text } from 'pixi.js';
import { defaultConfig as cfg, defenderWeapon, getDefenseMap, laneLength, lanePoint, waveForecast } from '../sim';
import type { BattleShot, CampaignState, DefenseMapId, TargetPriority } from '../sim';
import type { Dispatch } from './App';
import { BATTLE_LABEL, enemyCount, title } from './format';

const CLASS_COLOR: Record<string, number> = { Guardian: 0x6f9bd8, Gunner: 0xd8a64a, Alchemist: 0xb07fd8, Medic: 0x74c7b6 };
const ENEMY_LOOK: Record<string, { color: number; size: number }> = {
  runner: { color: 0xd8a64a, size: 7 },
  armored: { color: 0x9aa3ad, size: 12 },
  petrifier: { color: 0xb48cf2, size: 9 },
};
const SHOT_COLOR: Record<BattleShot['kind'], number> = {
  attack: 0xf2e3b3,
  splash: 0xc79cf0,
  support: 0x74c7b6,
  petrify: 0xb48cf2,
  turret: 0x8fd9ff,
  structure: 0xcf5f55,
};
const COLORS = { ground: 0x0d0f12, laneEdge: 0x1a1e24, lane: 0x242a32, ward: 0x74c7b6, stone: 0xa3a8b0, danger: 0xcf5f55, line: 0x39404b, text: 0xdcd8cf };
const SHOT_LIFE_MS = 160;

function bar(g: Graphics, x: number, y: number, w: number, ratio: number, color: number) {
  g.rect(x - w / 2, y, w, 3).fill({ color: 0x000000, alpha: 0.6 });
  g.rect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), 3).fill({ color });
}

function drawGround(g: Graphics, mapId: DefenseMapId) {
  const map = getDefenseMap(mapId);
  for (const [width, color] of [
    [40, COLORS.laneEdge],
    [32, COLORS.lane],
  ] as const) {
    for (const lane of map.lanes) {
      lane.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.stroke({ width, color, cap: 'round', join: 'round' });
    }
  }
}

function drawBattle(g: Graphics, labels: Map<string, Text>, s: CampaignState, selected: string | null, fx: { shot: BattleShot; life: number }[]) {
  const b = s.battle;
  g.clear();
  if (!b) return;
  const map = getDefenseMap(b.map);

  // Reach of the selected post.
  const selectedStructure = s.structures.find((d) => d.id === selected && d.map === b.map);
  if (selectedStructure) {
    const [x, y] = map.slots[selectedStructure.id] ?? [0, 0];
    const occupant = s.adventurers.find((a) => a.id === selectedStructure.occupantId);
    const weapon = occupant ? defenderWeapon(cfg, occupant, selectedStructure) : null;
    if (weapon) g.circle(x, y, weapon.range).fill({ color: COLORS.ward, alpha: 0.06 }).stroke({ width: 1, color: COLORS.ward, alpha: 0.5 });
    g.circle(x, y, 26).stroke({ width: 2, color: COLORS.text, alpha: 0.9 });
  }

  // Gate.
  const [gx, gy] = map.gate;
  g.roundRect(gx - 12, gy - 34, 24, 68, 4).fill({ color: 0x15181d }).stroke({ width: 2, color: b.gateHp > 0 ? COLORS.ward : COLORS.danger });
  bar(g, gx, gy + 40, 44, b.gateHp / b.gateMaxHp, COLORS.ward);

  // Automated weapons.
  map.turrets.forEach(([x, y]) => {
    g.poly([x, y - 12, x + 11, y - 6, x + 11, y + 6, x, y + 12, x - 11, y + 6, x - 11, y - 6])
      .fill({ color: 0x15181d })
      .stroke({ width: 2, color: s.sanctuary.automatedAmmo > 0 ? 0x8fd9ff : COLORS.line });
  });

  // Structures and their occupants.
  for (const d of s.structures) {
    const pos = d.map === b.map ? map.slots[d.id] : undefined;
    if (!pos) continue;
    const [x, y] = pos;
    const wrecked = d.hp <= 0;
    const outline = { width: 2, color: wrecked ? COLORS.danger : COLORS.line, alpha: wrecked ? 0.7 : 1 };
    if (d.type === 'watchtower') g.circle(x, y, 18).fill({ color: 0x15181d }).stroke(outline);
    else if (d.type === 'bunker') g.roundRect(x - 18, y - 18, 36, 36, 5).fill({ color: 0x15181d }).stroke({ ...outline, width: 4 });
    else g.poly([x, y - 20, x + 20, y, x, y + 20, x - 20, y]).fill({ color: 0x15181d }).stroke(outline);
    if (wrecked) g.moveTo(x - 12, y - 12).lineTo(x + 12, y + 12).moveTo(x + 12, y - 12).lineTo(x - 12, y + 12).stroke({ width: 2, color: COLORS.danger });
    else bar(g, x, y + 24, 30, d.hp / d.maxHp, 0x7d8794);

    const occupant = s.adventurers.find((a) => a.id === d.occupantId);
    const label = labels.get(d.id);
    if (label) label.text = occupant ? occupant.name.charAt(0) : '';
    if (occupant) {
      const moving = b.tick < (b.busyUntil[occupant.id] ?? 0);
      g.circle(x, y, 11).fill({ color: CLASS_COLOR[occupant.classId] ?? COLORS.text, alpha: moving ? 0.35 : 1 });
      // The creeping stone: a ring that closes as her gauge fills.
      if (occupant.gauge > 0) {
        g.moveTo(x, y - 14)
          .arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * occupant.gauge) / 100)
          .stroke({ width: 3, color: occupant.gauge >= 70 ? COLORS.danger : COLORS.stone });
      }
      bar(g, x, y + 29, 30, occupant.hp / occupant.maxHp, COLORS.ward);
    }
  }

  // Enemies.
  for (const e of b.enemies) {
    const look = ENEMY_LOOK[e.type] ?? { color: COLORS.text, size: 8 };
    const d = Math.min(e.progress / 1000, laneLength(b.map, e.lane));
    const [x, y] = lanePoint(b.map, e.lane, d);
    const r = look.size;
    if (e.type === 'armored') g.rect(x - r, y - r, r * 2, r * 2).fill({ color: look.color });
    else if (e.type === 'petrifier') g.poly([x, y - r - 2, x + r, y + r, x - r, y + r]).fill({ color: look.color });
    else g.circle(x, y, r).fill({ color: look.color });
    if (e.slowTicks > 0) g.circle(x, y, r + 4).stroke({ width: 1, color: 0x6f9bd8 });
    if (e.hp < e.maxHp) bar(g, x, y - r - 8, 22, e.hp / e.maxHp, COLORS.danger);
  }

  // Shots, fading out.
  for (const { shot, life } of fx) {
    g.moveTo(shot.x1, shot.y1)
      .lineTo(shot.x2, shot.y2)
      .stroke({ width: shot.kind === 'turret' ? 3 : 2, color: SHOT_COLOR[shot.kind], alpha: Math.max(0, life / SHOT_LIFE_MS) });
    if (shot.kind === 'splash') g.circle(shot.x2, shot.y2, 30).stroke({ width: 1, color: SHOT_COLOR.splash, alpha: Math.max(0, life / SHOT_LIFE_MS) });
  }
}

interface Props {
  state: CampaignState;
  stateRef: MutableRefObject<CampaignState>;
  dispatch: Dispatch;
}

export function BattleScreen({ state, stateRef, dispatch }: Props) {
  const battle = state.battle;
  const mapId = battle?.map ?? 'frontier';
  const hostRef = useRef<HTMLDivElement>(null);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const speedRef = useRef(speed);
  const selectedRef = useRef(selected);
  speedRef.current = speed;
  selectedRef.current = selected;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const map = getDefenseMap(mapId);
    const app = new Application();
    let ready = false;
    let cancelled = false;

    void app
      .init({ width: map.width, height: map.height, background: COLORS.ground, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true })
      .then(() => {
        if (cancelled) {
          app.destroy(true, { children: true });
          return;
        }
        ready = true;
        app.canvas.style.width = '100%';
        app.canvas.style.height = 'auto';
        app.canvas.style.display = 'block';
        host.appendChild(app.canvas);

        const ground = new Graphics();
        drawGround(ground, mapId);
        const dynamic = new Graphics();
        app.stage.addChild(ground, dynamic);
        const labels = new Map<string, Text>();
        for (const [id, [x, y]] of Object.entries(map.slots)) {
          const label = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: '700', fill: 0x0d0f12 } });
          label.anchor.set(0.5);
          label.position.set(x, y);
          app.stage.addChild(label);
          labels.set(id, label);
        }

        app.canvas.addEventListener('pointerdown', (event) => {
          const rect = app.canvas.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * map.width;
          const y = ((event.clientY - rect.top) / rect.height) * map.height;
          const hit = Object.entries(map.slots).find(([, [sx, sy]]) => Math.hypot(sx - x, sy - y) <= 28);
          setSelected(hit ? hit[0] : null);
        });

        let owed = 0;
        let lastTick = -1;
        const fx: { shot: BattleShot; life: number }[] = [];
        app.ticker.add((ticker) => {
          const live = stateRef.current.battle;
          if (live && live.outcome === 'ongoing' && speedRef.current > 0) {
            owed += (ticker.deltaMS / 1000) * cfg.defense.ticks_per_second * speedRef.current;
            const ticks = Math.min(Math.floor(owed), 30); // never try to catch up a long stall
            if (ticks > 0) {
              owed -= Math.floor(owed);
              dispatch({ type: 'battle_tick', ticks });
            }
          }
          const now = stateRef.current;
          for (const f of fx) f.life -= ticker.deltaMS;
          while (fx.length > 0 && (fx[0] as { life: number }).life <= 0) fx.shift();
          if (now.battle && now.battle.tick !== lastTick) {
            lastTick = now.battle.tick;
            for (const shot of now.battle.shots) fx.push({ shot, life: SHOT_LIFE_MS });
          }
          drawBattle(dynamic, labels, now, selectedRef.current, fx);
        });
      });

    return () => {
      cancelled = true;
      if (ready) app.destroy(true, { children: true });
    };
  }, [mapId, dispatch, stateRef]);

  if (!battle) return null;
  const map = getDefenseMap(battle.map);
  const tps = cfg.defense.ticks_per_second;
  const seconds = battle.tick / tps;
  const forecast = waveForecast(battle.map);
  const started = forecast.filter((w) => w.startSeconds <= seconds).length;
  const next = forecast[started];
  const structures = state.structures.filter((d) => d.map === battle.map);
  const reserves = state.adventurers.filter((a) => a.condition === 'ready' && a.assignment.type === 'idle');
  const name = (id: string) => state.adventurers.find((a) => a.id === id)?.name ?? id;
  const over = battle.outcome !== 'ongoing';

  const setPost = (structureId: string, occupantId: string | null, nextId: string) => {
    if (nextId === (occupantId ?? '')) return;
    if (occupantId) dispatch({ type: 'unassign_defender', adventurerId: occupantId });
    if (nextId) dispatch({ type: 'assign_defender', adventurerId: nextId, structureId });
  };

  return (
    <div className="battle">
      <div className="battle-main">
        <div className="panel battle-hud">
          <div>
            <p className="eyebrow">{BATTLE_LABEL[battle.kind]}</p>
            <h2>{map.name}</h2>
          </div>
          <dl className="vitals compact">
            <div>
              <dt>Gate</dt>
              <dd className={battle.gateHp <= battle.gateMaxHp / 3 ? 'danger-text' : ''} data-testid="gate">
                {battle.gateHp}/{battle.gateMaxHp}
              </dd>
            </div>
            <div>
              <dt>Wave</dt>
              <dd>
                {Math.max(1, started)}/{forecast.length}
              </dd>
            </div>
            <div>
              <dt>Next wave</dt>
              <dd>{next ? `${Math.max(0, Math.ceil(next.startSeconds - seconds))}s` : 'last'}</dd>
            </div>
            <div>
              <dt>Attackers</dt>
              <dd>
                {battle.enemies.length} <span className="muted">· {battle.killed} slain · {battle.leaked} through</span>
              </dd>
            </div>
            {map.turrets.length > 0 && (
              <div>
                <dt>Ammunition</dt>
                <dd className={state.sanctuary.automatedAmmo === 0 ? 'danger-text' : ''}>{state.sanctuary.automatedAmmo}</dd>
              </div>
            )}
          </dl>
          <div className="row">
            {[0, 1, 2, 4].map((v) => (
              <button key={v} className={speed === v ? 'primary' : ''} aria-pressed={speed === v} disabled={over} onClick={() => setSpeed(v)}>
                {v === 0 ? 'Pause' : `${v}×`}
              </button>
            ))}
          </div>
        </div>

        <div className="battle-field" ref={hostRef}>
          {over && (
            <div className="battle-result" role="dialog" aria-label="Battle result">
              <h2 className={battle.outcome === 'win' ? 'good' : 'danger-text'} data-testid="battle-outcome">
                {battle.outcome === 'win' ? 'The line held' : 'The gate has fallen'}
              </h2>
              <p className="small">
                {battle.killed} slain, {battle.leaked} reached the gate.{' '}
                {battle.fallen.length === 0 ? 'No defender was solidified.' : `Solidified: ${battle.fallen.map(name).join(', ')}.`}
              </p>
              <button className="primary" onClick={() => dispatch({ type: 'battle_finish' })}>
                Continue
              </button>
            </div>
          )}
        </div>
        <p className="small muted legend">
          <span className="dot" style={{ background: '#d8a64a' }} /> runner
          <span className="sq" style={{ background: '#9aa3ad' }} /> armored brute: wrecks nearby structures
          <span className="tri" /> petrifier: solidifies the most exposed defender in reach
        </p>
      </div>

      <aside className="battle-side">
        <div className="panel">
          <h2>Posts</h2>
          <p className="small muted">
            Moving someone under fire takes {cfg.defense.reposition_seconds}s before she can act. Withdrawing is immediate.
          </p>
          <ul className="posts">
            {structures.map((d) => {
              const occupant = state.adventurers.find((a) => a.id === d.occupantId);
              const moving = occupant ? battle.tick < (battle.busyUntil[occupant.id] ?? 0) : false;
              const exposure = cfg.defense.structure_stats[d.type]?.exposure ?? 1;
              return (
                <li key={d.id} className={selected === d.id ? 'selected' : ''} onClick={() => setSelected(d.id)}>
                  <div className="post-head">
                    <strong>{title(d.id.replace(`${d.map}_`, ''))}</strong>
                    <span className={d.hp <= 0 ? 'danger-text' : 'muted'}>
                      {d.hp <= 0 ? 'destroyed' : `${d.hp}/${d.maxHp}`} · {Math.round(exposure * 100)}% exposed
                    </span>
                  </div>
                  <div className="row">
                    <select
                      aria-label={`Occupant of ${d.id.replace(/_/g, ' ')}`}
                      value={occupant?.id ?? ''}
                      disabled={over || d.hp <= 0}
                      onChange={(e) => setPost(d.id, occupant?.id ?? null, e.target.value)}
                    >
                      <option value="">Empty</option>
                      {occupant && (
                        <option value={occupant.id}>
                          {occupant.name} · {occupant.classId}
                        </option>
                      )}
                      {reserves.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.classId} (reserve)
                        </option>
                      ))}
                    </select>
                    {occupant && (
                      <select
                        aria-label={`Target priority of ${occupant.name}`}
                        value={occupant.targetPriority}
                        onChange={(e) => dispatch({ type: 'set_target_priority', adventurerId: occupant.id, priority: e.target.value as TargetPriority })}
                      >
                        <option value="first">Nearest the gate</option>
                        <option value="strongest">Strongest</option>
                        <option value="petrifier">Petrifiers first</option>
                      </select>
                    )}
                  </div>
                  {occupant && (
                    <div className="meters">
                      <span className="meter" title="Health">
                        <i style={{ width: `${(occupant.hp / occupant.maxHp) * 100}%` }} />
                      </span>
                      <span className={`meter stone-meter ${occupant.gauge >= 70 ? 'critical' : ''}`} title="Solidification">
                        <i style={{ width: `${occupant.gauge}%` }} />
                      </span>
                      <span className="small muted">
                        {moving ? 'moving into position' : `HP ${occupant.hp} · stone ${occupant.gauge}%`}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel">
          <h2>Incoming</h2>
          <ol className="plain small">
            {forecast.map((w) => (
              <li key={w.wave} className={w.startSeconds <= seconds ? 'muted' : ''}>
                <strong>Wave {w.wave}</strong> at {w.startSeconds}s: {w.groups.map((g) => `${enemyCount(g.enemy, g.count)} (${g.lane})`).join(', ')}
              </li>
            ))}
          </ol>
        </div>

        <div className="panel debug">
          <h2>Command</h2>
          <div className="row">
            <button className="danger" disabled={over} onClick={() => dispatch({ type: 'battle_concede' })}>
              Sound the retreat
            </button>
            <button disabled={over} onClick={() => dispatch({ type: 'battle_tick', ticks: tps * 600 })}>
              Debug: skip to the end
            </button>
          </div>
          <p className="small muted">Retreating gives up the gate, but nobody else is lost.</p>
        </div>
      </aside>
    </div>
  );
}
