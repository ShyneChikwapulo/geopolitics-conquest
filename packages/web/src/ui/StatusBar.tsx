import { useGame } from '../game/useGame';

export function StatusBar() {
  const g = useGame();
  const thinkingName = g.thinking ? g.nameOf(g.thinking) : null;
  if (!thinkingName && !g.saving && !g.saveError) return null;
  return (
    <div className="status-bar" role="status" aria-live="polite">
      {thinkingName && (
        <span className="status">
          <span className="spinner" /> 🧠 {thinkingName} is consulting its AI advisor…
        </span>
      )}
      {g.saving && !thinkingName && (
        <span className="status">
          <span className="spinner" /> Saving…
        </span>
      )}
      {g.saveError && (
        <span className="status bad" role="alert">
          {g.saveError} <button onClick={g.retry}>Try again</button>
        </span>
      )}
    </div>
  );
}
