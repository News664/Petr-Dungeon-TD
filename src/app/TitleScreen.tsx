interface Props {
  hasAutosave: boolean;
  onNew: () => void;
  onContinue: () => void;
  onSkip: () => void;
}

export function TitleScreen({ hasAutosave, onNew, onContinue, onSkip }: Props) {
  return (
    <div className="title-screen">
      <p className="eyebrow">Prototype</p>
      <h1>The Last Sanctuary</h1>
      <p className="muted">
        Lead the last guild. Walk the labyrinth, hold the frontier, and bring your champions home before the stone keeps them.
      </p>
      <div className="title-actions">
        {hasAutosave && (
          <button className="primary large" onClick={onContinue}>
            Continue
          </button>
        )}
        <button className={hasAutosave ? 'large' : 'primary large'} onClick={onNew}>
          New game
        </button>
        <button onClick={onSkip}>New game, skip the prologue</button>
      </div>
      <p className="small muted">Progress is saved in this browser as you play. Placeholder art; balance is unfinished.</p>
    </div>
  );
}
