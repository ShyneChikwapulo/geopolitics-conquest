import { useEffect, useState } from 'react';
import type { DicePair, GameEvent } from '@conquest/engine';
import { DiceRoller } from './DiceRoller';

type BattleRound = Extract<GameEvent, { type: 'battleRound' }>;

export interface BattleDrawerProps {
  event: BattleRound;
  /** Soldiers on each side before this round. */
  before: { attacker: number; defender: number };
  attacker: { name: string; color: string; country: string };
  defender: { name: string; color: string; country: string };
  speed: number;
  commentary: { text: string; source: 'llm' | 'template'; loading: boolean } | null;
  /** When false the dice are shown already landed (used when re-opening a finished battle). */
  animate?: boolean;
}

/** The dice sit at "rolling" for a moment, then each pair lands a hair after the previous one. */
export function BattleDrawer({ event, before, attacker, defender, speed, commentary, animate = true }: BattleDrawerProps) {
  const total = event.pairs.length;
  const [landed, setLanded] = useState(animate ? 0 : total);

  // One timer per pair, all started together: the dice tumble at once and settle in a quick stagger.
  useEffect(() => {
    if (!animate) {
      setLanded(total);
      return;
    }
    setLanded(0);
    const settle = 520 / speed;
    const stagger = 90 / speed;
    const timers = Array.from({ length: total }, (_, i) => setTimeout(() => setLanded((n) => Math.max(n, i + 1)), settle + i * stagger));
    return () => timers.forEach(clearTimeout);
  }, [event, total, speed, animate]);

  const dieSize = total > 6 ? 34 : total > 3 ? 40 : 48;
  const rollMs = Math.max(160, 600 / speed);
  const allLanded = landed >= total;
  const outcome = !allLanded
    ? 'Rolling…'
    : event.attackerLosses === 0 && event.defenderLosses === 0
      ? 'Every pair tied: nobody loses a soldier.'
      : null;

  return (
    <div className="battle-drawer" role="region" aria-label="Battle in progress" aria-live="polite">
      <div className="battle-drawer-inner">
        <div className="battle-drawer-side">
          <span className="battle-round-tag">Battle round {event.round} · {total} {total === 1 ? 'die' : 'dice'} each</span>
          <div className="battle-sides">
            <div className="side" style={{ color: '#bfdbfe' }}>
              <span className="dot" style={{ background: attacker.color }} />
              <span className="tag">Attack</span>
              <span className="nm">{attacker.country}</span>
              <span className="count">
                {allLanded && before.attacker !== event.attackerSoldiersAfter && <span className="was">{before.attacker}</span>}
                {allLanded ? event.attackerSoldiersAfter : before.attacker}
              </span>
            </div>
            <div className="side" style={{ color: '#fecaca' }}>
              <span className="dot" style={{ background: defender.color }} />
              <span className="tag">Defend</span>
              <span className="nm">{defender.country}</span>
              <span className="count">
                {allLanded && before.defender !== event.defenderSoldiersAfter && <span className="was">{before.defender}</span>}
                {allLanded ? event.defenderSoldiersAfter : before.defender}
              </span>
            </div>
          </div>
          <div className="battle-outcome">
            {outcome ?? (
              <>
                <span className="loss">{attacker.country} −{event.attackerLosses}</span> · <span className="loss">{defender.country} −{event.defenderLosses}</span>
              </>
            )}
          </div>
        </div>

        <div className="dice-pairs">
          {event.pairs.map((p: DicePair, i) => {
            const done = i < landed;
            return (
              <div key={`${event.round}-${i}`} className={`pair ${done ? p.result : ''}`}>
                <DiceRoller value={p.attacker} rolling={!done} durationMs={rollMs} variant="attacker" size={dieSize} />
                <span className="out" aria-hidden>{done ? (p.result === 'attacker' ? '›' : p.result === 'defender' ? '‹' : '=') : '·'}</span>
                <DiceRoller value={p.defender} rolling={!done} durationMs={rollMs} variant="defender" size={dieSize} />
              </div>
            );
          })}
        </div>

        <div className="battle-commentary">
          {commentary ? (
            <>
              {commentary.text || (commentary.loading ? '…' : '')}
              <span className="src">{commentary.loading ? 'AI commentator' : commentary.source === 'llm' ? 'AI commentator' : 'match report'}</span>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
