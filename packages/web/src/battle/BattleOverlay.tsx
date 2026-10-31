import { useEffect, useMemo, useRef } from 'react';
import { useGame } from '../game/useGame';
import { ROLL_MS, type Speed } from '../game/GameProvider';
import { DiceRoller } from './DiceRoller';

interface PairResult {
  attacker: number;
  defender: number;
  result: 'attacker' | 'defender' | 'tie';
}

export function BattleOverlay({ onClose }: { onClose: () => void }) {
  const { lastBattle, speed, revealedSteps, setRevealedSteps } = useGame();
  const pairsRef = useRef<HTMLDivElement>(null);
  const durationMs = ROLL_MS[speed as Speed];
  const total = lastBattle?.pairs.length ?? 0;
  const allRevealed = revealedSteps >= total;

  useEffect(() => {
    if (!lastBattle) return;
    setRevealedSteps(0);
    requestAnimationFrame(() => {
      if (pairsRef.current) pairsRef.current.scrollLeft = 0;
    });
  }, [lastBattle?.id, setRevealedSteps]);

  useEffect(() => {
    if (!lastBattle) return;
    if (revealedSteps >= total) return;
    const stepMs = durationMs > 0 ? durationMs + 120 : 0;
    const t = setTimeout(() => setRevealedSteps(revealedSteps + 1), stepMs);
    return () => clearTimeout(t);
  }, [revealedSteps, total, durationMs, lastBattle?.id, setRevealedSteps]);

  useEffect(() => {
    const el = pairsRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [revealedSteps]);

  const pairResults: PairResult[] = useMemo(
    () => (lastBattle?.pairs ?? []) as PairResult[],
    [lastBattle?.pairs],
  );

  if (!lastBattle) return null;

  return (
    <div className="battle-drawer">
      <div className="battle-drawer-inner">
        <header className="battle-drawer-header">
          <h3>Battle round {lastBattle.round}</h3>
          <span className="muted">{lastBattle.from} vs {lastBattle.to}</span>
          {allRevealed && (
            <span className="battle-drawer-outcome">
              Attacker −{lastBattle.attackerLosses} · Defender −{lastBattle.defenderLosses} ·
              {' '}now {lastBattle.attackerSoldiersAfter} vs {lastBattle.defenderSoldiersAfter}
            </span>
          )}
        </header>

        <div className="dice-pairs" ref={pairsRef}>
          {pairResults.map((p, i) => {
            const isRolling = i >= revealedSteps;
            return (
              <div key={i} className={`pair ${isRolling ? '' : p.result}`}>
                <DiceRoller value={p.attacker} rolling={isRolling} durationMs={durationMs} variant="attacker" />
                <span className="vs">vs</span>
                <DiceRoller value={p.defender} rolling={isRolling} durationMs={durationMs} variant="defender" />
                {!isRolling && (
                  <span className={`out ${p.result}`}>
                    {p.result === 'tie' ? '=' : p.result === 'attacker' ? '✓' : '✗'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          className="primary"
          onClick={onClose}
          disabled={!allRevealed}
        >
          Continue
        </button>
      </div>
    </div>
  );
}