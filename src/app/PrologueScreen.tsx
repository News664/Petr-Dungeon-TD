import { availableChampions, defaultConfig as cfg } from '../sim';
import type { CampaignState } from '../sim';
import type { Dispatch } from './App';
import { Portrait } from './Portrait';

const CLASS_TEXT: Record<string, { labyrinth: string; defense: string }> = {
  Guardian: { labyrinth: 'Holds the front row, draws attacks and shields the party.', defense: 'Slows what she strikes. At her best in a bunker.' },
  Gunner: { labyrinth: 'Strikes hard from the back row and ignores armor.', defense: 'Long reach from a watchtower; the answer to petrifiers and brutes.' },
  Alchemist: { labyrinth: 'Burns whole groups and strips armor.', defense: 'Splash damage that corrodes armor.' },
  Medic: { labyrinth: 'Mends wounds and pushes back the solidification.', defense: 'Heals and eases the solidification of allies in reach; best in a support station.' },
};

/** The opening: the goddess, the seal, and the five champions she can still afford. */
export function PrologueScreen({ state, dispatch }: { state: CampaignState; dispatch: Dispatch }) {
  const left = state.seal.freeCredits;
  const total = cfg.roster.starter_free_summons;
  const begin = () => dispatch({ type: 'prologue_begin_defense' }) && dispatch({ type: 'battle_start' });
  return (
    <div className="prologue">
      <div className="panel story">
        <p className="eyebrow">Prologue</p>
        <h2>The seal answers one last time</h2>
        <p>
          The stone took the cities first, then the roads between them. Women turned where they stood and did not turn back. What walks the world
          now does not turn at all.
        </p>
        <p>
          One sanctuary is left, and Sakuya, the goddess who keeps it, and one summoner who can still wake the old seal: you. She has strength
          for {total} champions from other worlds, and the monsters are already on the road to the gate.
        </p>
        <label className="field name-field">
          What the champions will call you (up to 16 characters)
          <input
            type="text"
            maxLength={16}
            value={state.playerName}
            onChange={(e) => e.target.value.trim() && dispatch({ type: 'set_player_name', name: e.target.value })}
          />
        </label>
        <p className="muted">
          {left > 0
            ? `Choose who answers. ${left} of ${total} summons remain. A balanced company can both hold a wall and walk the labyrinth.`
            : state.pendingBattle
              ? 'The attack is at the gate.'
              : 'All five have answered. The monsters are in sight of the walls.'}
        </p>
        {left === 0 && (
          <button className="primary large" onClick={state.pendingBattle ? () => dispatch({ type: 'battle_start' }) : begin}>
            To the walls
          </button>
        )}
      </div>

      <div className="class-cards">
        {cfg.roster.classes.map((classId) => (
          <div key={classId} className="panel class-card">
            <div className="who">
              <Portrait adv={{ name: classId, classId, gauge: 0, condition: 'ready' }} size={44} />
              <h3>{classId}</h3>
            </div>
            <p className="small">
              <span className="muted">In the labyrinth:</span> {CLASS_TEXT[classId]?.labyrinth}
            </p>
            <p className="small">
              <span className="muted">On the walls:</span> {CLASS_TEXT[classId]?.defense}
            </p>
            <ul className="tree">
              {availableChampions(state, cfg, classId).map((c) => (
                <li key={c.name}>
                  <span>
                    <strong>{c.name}</strong> <span className="muted small">{c.epithet}</span>
                    <br />
                    <span className="small muted">{c.trait.text}</span>
                  </span>
                  <button disabled={left === 0} aria-label={`Summon ${c.name}`} onClick={() => dispatch({ type: 'summon', champion: c.name })}>
                    Summon
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>
          The company <span className="muted">· {state.adventurers.length}/{total}</span>
        </h2>
        {state.adventurers.length === 0 ? (
          <p className="small muted">Nobody has answered yet.</p>
        ) : (
          <div className="row">
            {state.adventurers.map((a) => (
              <span key={a.id} className="chip static">
                <Portrait adv={a} size={30} />
                <span>
                  {a.name}
                  <br />
                  <span className="muted small">
                    {a.classId}
                    {a.epithet && ` · ${a.epithet}`}
                  </span>
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
