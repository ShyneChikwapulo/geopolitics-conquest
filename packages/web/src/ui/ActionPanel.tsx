import { useEffect, useMemo, useState } from 'react';
import { validateAction, type Action } from '@conquest/engine';
import { useGame } from '../game/useGame';
import { useTargeting } from '../game/targeting';
import { PLAYER_COLORS } from '../map/WorldMap';

export function ActionPanel() {
  const { state, dispatch, isHumanTurn } = useGame();
  const me = state.players[state.currentPlayerIndex];
  const targeting = useTargeting();
  const [mode, setMode] = useState<'idle' | 'attack' | 'transfer'>('idle');
  const [count, setCount] = useState(1);

  const mine = useMemo(
    () => Object.values(state.territories).filter((t) => t.ownerId === me?.id),
    [state, me?.id],
  );

  // Clear the map's targeting line whenever we leave attack mode or the turn changes.
  useEffect(() => {
    if (mode !== 'attack') targeting.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    targeting.clear();
    setMode('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayerIndex, state.phase]);

  if (!me) return null;
  if (!isHumanTurn) {
    return <div className="action-panel"><h3>Action</h3><p className="muted">Waiting for other players…</p></div>;
  }

  const playerColor = PLAYER_COLORS[me.colorIndex];

  const tryDispatch = (action: Action) => {
    const err = validateAction(state, action);
    if (err) { alert(err); return; }
    dispatch(action);
    setMode('idle');
    targeting.clear();
  };

  if (state.phase === 'reinforce') {
    return (
      <div className="action-panel">
        <h3>Reinforce ({state.reinforcementsPending})</h3>
        <ReinforceForm
          pending={state.reinforcementsPending}
          mine={mine}
          onDone={(allocs) => tryDispatch({ type: 'allocate', playerId: me.id, allocations: allocs })}
        />
      </div>
    );
  }

  if (state.phase === 'capture' && state.capture) {
    const from = state.territories[state.capture.from]!;
    return (
      <div className="action-panel">
        <h3>Capture</h3>
        <p>Move soldiers from {from.name} to {state.capture.to}.</p>
        <input type="number" min={0} max={from.soldiers - 1} value={count}
          onChange={(e) => setCount(Number(e.target.value))} />
        <button className="primary"
          onClick={() => tryDispatch({ type: 'completeCapture', playerId: me.id, move: Math.min(count, from.soldiers - 1) })}>
          Move {Math.min(count, from.soldiers - 1)}
        </button>
      </div>
    );
  }

  if (state.phase === 'attacking' && state.attack) {
    return (
      <div className="action-panel">
        <h3>Attacking {state.attack.to}</h3>
        <button className="primary" onClick={() => dispatch({ type: 'roll', playerId: me.id })}>Roll dice</button>
        <button onClick={() => dispatch({ type: 'stopAttack', playerId: me.id })}>Stop (ends turn)</button>
      </div>
    );
  }

  return (
    <div className="action-panel">
      <h3>Action</h3>
      {mode === 'idle' && (
        <>
          <button disabled={state.attackUsed} onClick={() => setMode('attack')}>Attack</button>
          <button onClick={() => setMode('transfer')}>Transfer</button>
          <button onClick={() => tryDispatch({ type: 'endTurn', playerId: me.id })}>Skip turn</button>
        </>
      )}
      {mode === 'attack' && (
        <div className="action-form">
          <select
            value={targeting.fromCode ?? ''}
            onChange={(e) => {
              targeting.setFrom(e.target.value || null);
              targeting.setColor(playerColor);
            }}
          >
            <option value="">From…</option>
            {mine.filter((t) => t.soldiers >= 2).map((t) => (
              <option key={t.code} value={t.code}>{t.name} ({t.soldiers})</option>
            ))}
          </select>
          <select
            value={targeting.toCode ?? ''}
            onChange={(e) => {
              targeting.setTo(e.target.value || null);
              targeting.setColor(playerColor);
            }}
          >
            <option value="">Target…</option>
            {Object.values(state.territories).filter((t) => t.ownerId !== me.id).map((t) => (
              <option key={t.code} value={t.code}>{t.name} ({t.soldiers})</option>
            ))}
          </select>
          <button className="primary"
            disabled={!targeting.fromCode || !targeting.toCode}
            onClick={() => tryDispatch({
              type: 'startAttack', playerId: me.id,
              from: targeting.fromCode!, to: targeting.toCode!,
            })}>
            Start
          </button>
          <button onClick={() => { setMode('idle'); targeting.clear(); }}>Cancel</button>
        </div>
      )}
      {mode === 'transfer' && (
        <div className="action-form">
          <select value={targeting.fromCode ?? ''} onChange={(e) => targeting.setFrom(e.target.value || null)}>
            <option value="">From…</option>
            {mine.filter((t) => t.soldiers >= 2).map((t) => (
              <option key={t.code} value={t.code}>{t.name} ({t.soldiers})</option>
            ))}
          </select>
          <select value={targeting.toCode ?? ''} onChange={(e) => targeting.setTo(e.target.value || null)}>
            <option value="">To…</option>
            {mine.filter((t) => t.code !== targeting.fromCode).map((t) => (
              <option key={t.code} value={t.code}>{t.name} ({t.soldiers})</option>
            ))}
          </select>
          <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          <button className="primary" disabled={!targeting.fromCode || !targeting.toCode}
            onClick={() => tryDispatch({
              type: 'transfer', playerId: me.id,
              from: targeting.fromCode!, to: targeting.toCode!, count,
            })}>Move</button>
          <button onClick={() => { setMode('idle'); targeting.clear(); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}

function ReinforceForm({ pending, mine, onDone }: {
  pending: number;
  mine: Array<{ code: string; name: string; soldiers: number }>;
  onDone: (a: Record<string, number>) => void;
}) {
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  return (
    <div className="action-form">
      {mine.map((t) => (
        <label key={t.code} className="alloc-row">
          {t.name}
          <input type="number" min={0} value={alloc[t.code] ?? 0}
            onChange={(e) => setAlloc({ ...alloc, [t.code]: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
      ))}
      <p className="muted">{total} / {pending}</p>
      <button className="primary" disabled={total !== pending} onClick={() => onDone(alloc)}>Place soldiers</button>
    </div>
  );
}