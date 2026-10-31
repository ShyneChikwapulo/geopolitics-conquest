import { useEffect, useState } from 'react';
import { applyAction, createGame, type Action, type GameState } from '@conquest/engine';
import { COUNTRIES } from '@conquest/data';
import { loadActions } from '../game/localStore';

export function Replay({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [step, setStep] = useState(0);
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    const a = loadActions(gameId);
    setActions(a);
    const s = createGame({ id: gameId, seed: 1, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
    setState(s);
  }, [gameId]);

  const advance = () => {
    if (!state) return;
    const a = actions[step];
    if (!a) return;
    try { setState(applyAction(state, a).state); setStep(step + 1); }
    catch (e) { console.warn('Replay step failed', e); }
  };

  return (
    <div className="battle-overlay">
      <div className="battle-card">
        <h3>Replay</h3>
        <p>Step {step} / {actions.length}</p>
        {state && <p>Round {state.round} · {state.players[state.currentPlayerIndex]?.name}</p>}
        <button className="primary" onClick={advance} disabled={step >= actions.length}>Next</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}