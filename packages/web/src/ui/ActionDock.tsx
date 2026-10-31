import { useEffect, useRef, useState } from 'react';
import { expectedAttackerLosses, territoriesOf, winProbability, type Action } from '@conquest/engine';
import { useGame } from '../game/useGame';

interface Props {
  selectedFrom: string | null;
  selectedTo: string | null;
  setSelectedFrom: (c: string | null) => void;
  setSelectedTo: (c: string | null) => void;
}

function Odds({ attackers, defenders }: { attackers: number; defenders: number }) {
  const p = winProbability(attackers, defenders);
  const loss = expectedAttackerLosses(attackers, defenders);
  return (
    <span className="odds" title="Exact odds from the dice rules, assuming you keep rolling until the battle is decided">
      <span>
        Win chance <strong>{Math.round(p * 100)}%</strong>
      </span>
      <span className="odds-meter" aria-hidden>
        <i style={{ width: `${p * 100}%` }} />
      </span>
      <span>
        expect to lose ~<strong style={{ fontSize: 14 }}>{Math.round(loss * 10) / 10}</strong>
      </span>
    </span>
  );
}

/** The player's controls, docked under the map. Shows exactly what the current phase allows. */
export function ActionDock({ selectedFrom, selectedTo, setSelectedFrom, setSelectedTo }: Props) {
  const g = useGame();
  const { state, humanId, canAct, view } = g;
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');
  const [tCount, setTCount] = useState(1);
  const [moveCount, setMoveCount] = useState(0);
  const rollRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setError(null);
    setAlloc({});
    setMoveCount(0);
  }, [state.version]);

  useEffect(() => {
    if (canAct && state.phase === 'attacking') rollRef.current?.focus();
  }, [canAct, state.phase, state.version]);

  const run = async (a: Action): Promise<void> => {
    if (working) return;
    setWorking(true);
    setError(await g.dispatch(a));
    setWorking(false);
  };

  const me = state.players.find((p) => p.id === humanId)!;
  const mine = territoriesOf(state, humanId);

  if (state.phase === 'finished') return null;

  if (me.eliminated) {
    return (
      <div className="dock" aria-live="polite">
        <div className="dock-head">
          <h2>You have been eliminated</h2>
          <span className="hint">The rivals fight on. Use the speed controls to watch them finish it.</span>
        </div>
      </div>
    );
  }

  if (!canAct) {
    const who = g.nameOf(view.currentPlayerId);
    const msg = g.thinking
      ? `${g.nameOf(g.thinking)} is weighing its options…`
      : g.saving
        ? 'Saving your move…'
        : g.busy && view.currentPlayerId === humanId
          ? 'Playing out your move…'
          : `${who} is taking its turn…`;
    return (
      <div className="dock" aria-live="polite">
        <div className="dock-head">
          <h2>
            <span className="spinner" /> {msg}
          </h2>
          <span className="hint">Round {view.round}. You will be able to act as soon as it is your turn.</span>
        </div>
      </div>
    );
  }

  // ---- reinforcements -------------------------------------------------------------------------------
  if (state.phase === 'reinforce') {
    const placed = Object.values(alloc).reduce((a, b) => a + b, 0);
    const remaining = state.reinforcementsPending - placed;
    const bump = (code: string, delta: number): void =>
      setAlloc((a) => {
        const others = Object.entries(a).reduce((n, [k, v]) => (k === code ? n : n + v), 0);
        const next = Math.max(0, Math.min((a[code] ?? 0) + delta, state.reinforcementsPending - others));
        return { ...a, [code]: next };
      });
    const strongest = [...mine].sort((a, b) => b.soldiers - a.soldiers)[0]!;
    return (
      <div className="dock">
        <div className="dock-head">
          <h2>
            Place your reinforcements <span className="badge-pill">{remaining} left</span>
          </h2>
          <span className="hint">You get 2 soldiers for each country you hold.</span>
        </div>
        <div className="alloc">
          {mine.map((t) => (
            <div className="alloc-item" key={t.code}>
              <span>
                {t.name} <span className="cur">({t.soldiers})</span>
              </span>
              <button onClick={() => bump(t.code, -1)} aria-label={`Remove one from ${t.name}`} disabled={(alloc[t.code] ?? 0) === 0}>
                −
              </button>
              <strong>{alloc[t.code] ?? 0}</strong>
              <button onClick={() => bump(t.code, 1)} aria-label={`Add one to ${t.name}`} disabled={remaining === 0}>
                +
              </button>
            </div>
          ))}
        </div>
        <div className="dock-row">
          <button className="gold" disabled={remaining !== 0 || working} onClick={() => void run({ type: 'allocate', playerId: humanId, allocations: alloc })}>
            Confirm placement
          </button>
          <button className="ghost" disabled={remaining === 0} onClick={() => bump(strongest.code, remaining)} title={`Put everything left on ${strongest.name}`}>
            Rest on {strongest.name}
          </button>
          <button className="ghost" disabled={placed === 0} onClick={() => setAlloc({})}>
            Clear
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  // ---- an attack is in progress -----------------------------------------------------------------------
  if (state.phase === 'attacking' && state.attack) {
    const from = state.territories[state.attack.from]!;
    const to = state.territories[state.attack.to]!;
    return (
      <div className="dock">
        <div className="dock-head">
          <h2>
            {from.name} ({from.soldiers}) ⚔ {to.name} ({to.soldiers})
          </h2>
          <Odds attackers={from.soldiers} defenders={to.soldiers} />
        </div>
        <div className="dock-row">
          <button ref={rollRef} className="gold roll-btn" disabled={working} onClick={() => void run({ type: 'roll', playerId: humanId })}>
            🎲 Roll the dice
          </button>
          <button className="danger" disabled={working} onClick={() => void run({ type: 'stopAttack', playerId: humanId })} title="Calling off the attack ends your turn">
            Stop attack · end turn
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  // ---- capture ---------------------------------------------------------------------------------------
  if (state.phase === 'capture' && state.capture) {
    const from = state.territories[state.capture.from]!;
    const to = state.territories[state.capture.to]!;
    const max = from.soldiers - 1;
    const n = Math.min(moveCount, max);
    return (
      <div className="dock">
        <div className="dock-head">
          <h2>You conquered {to.name}!</h2>
          <span className="hint">
            It starts with {to.soldiers}. Send reinforcements from {from.name} (it keeps at least 1).
          </span>
        </div>
        <div className="dock-row">
          <input type="range" min={0} max={max} value={n} onChange={(e) => setMoveCount(Number(e.target.value))} aria-label="Soldiers to move" />
          <span>
            move <strong>{n}</strong> of {max}
          </span>
          <button className="gold" disabled={working} onClick={() => void run({ type: 'completeCapture', playerId: humanId, move: n })}>
            Confirm
          </button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  // ---- main action phase --------------------------------------------------------------------------------
  const attackers = mine.filter((t) => t.soldiers >= 2);
  const enemies = Object.values(state.territories).filter((t) => t.ownerId !== humanId);
  const protectedOwner = (ownerId: string): boolean => !state.players.find((p) => p.id === ownerId)?.hasTakenFirstTurn;
  const from = selectedFrom && state.territories[selectedFrom]?.ownerId === humanId ? selectedFrom : '';
  const to = selectedTo && state.territories[selectedTo]?.ownerId !== humanId ? selectedTo : '';
  const fromT = from ? state.territories[from]! : null;
  const toT = to ? state.territories[to]! : null;
  const allProtected = enemies.length > 0 && enemies.every((t) => protectedOwner(t.ownerId));

  const transferFrom = mine.find((t) => t.code === tFrom) ?? mine[0];
  const transferTo = mine.find((t) => t.code === tTo && t.code !== transferFrom?.code) ?? mine.find((t) => t.code !== transferFrom?.code);
  const maxMove = transferFrom ? Math.max(1, transferFrom.soldiers - 1) : 1;

  return (
    <div className="dock">
      <div className="dock-head">
        <h2>Your move</h2>
        <span className="hint">
          {state.attackUsed
            ? 'You have attacked this turn. Move soldiers if you like, then end your turn.'
            : allProtected
              ? 'Every rival is still protected until their first turn. Move soldiers or end your turn.'
              : 'Click your country, then a target on the map. Or use the menus.'}
        </span>
      </div>

      {!state.attackUsed && (
        <div className="dock-row">
          <select value={from} onChange={(e) => setSelectedFrom(e.target.value || null)} aria-label="Attack from">
            <option value="">Attack from…</option>
            {attackers.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name} ({t.soldiers})
              </option>
            ))}
          </select>
          <span aria-hidden>⚔</span>
          <select value={to} onChange={(e) => setSelectedTo(e.target.value || null)} aria-label="Attack target">
            <option value="">Target…</option>
            {enemies.map((t) => {
              const prot = protectedOwner(t.ownerId);
              const holder = t.ownerId === t.code ? '' : ` · held by ${g.nameOf(t.ownerId)}`;
              return (
                <option key={t.code} value={t.code} disabled={prot}>
                  {t.name} ({t.soldiers}){holder}{prot ? ' · protected 🛡' : ''}
                </option>
              );
            })}
          </select>
          <button className="gold" disabled={!from || !to || working} onClick={() => void run({ type: 'startAttack', playerId: humanId, from, to })}>
            Attack
          </button>
          {fromT && toT && <Odds attackers={fromT.soldiers} defenders={toT.soldiers} />}
        </div>
      )}

      {mine.length > 1 && transferFrom && transferTo && (
        <details>
          <summary>Move soldiers between your countries</summary>
          <div className="dock-row" style={{ marginTop: 6 }}>
            <select value={transferFrom.code} onChange={(e) => setTFrom(e.target.value)} aria-label="Move from">
              {mine.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} ({t.soldiers})
                </option>
              ))}
            </select>
            <span aria-hidden>→</span>
            <select value={transferTo.code} onChange={(e) => setTTo(e.target.value)} aria-label="Move to">
              {mine.filter((t) => t.code !== transferFrom.code).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} ({t.soldiers})
                </option>
              ))}
            </select>
            <input type="number" min={1} max={maxMove} value={Math.min(tCount, maxMove)} onChange={(e) => setTCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))} aria-label="Soldiers to move" style={{ width: 70 }} />
            <button disabled={working} onClick={() => void run({ type: 'transfer', playerId: humanId, from: transferFrom.code, to: transferTo.code, count: Math.min(tCount, maxMove) })}>
              Move
            </button>
          </div>
        </details>
      )}

      <div className="dock-row">
        <button className={state.attackUsed ? 'primary' : ''} disabled={working} onClick={() => void run({ type: 'endTurn', playerId: humanId })}>
          {state.attackUsed ? 'End turn' : 'Skip attack · end turn'}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
