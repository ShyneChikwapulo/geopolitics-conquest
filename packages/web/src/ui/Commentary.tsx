import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/useGame';
import { streamCommentary, type CommentaryInput } from '../ai/commentary';

export function Commentary() {
  const { lastBattle, state } = useGame();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const streamRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!lastBattle) {
      setText('');
      return;
    }

    // Only one stream at a time. Cancel the previous one if a new round is already in.
    streamRef.current?.abort();
    const ctrl = new AbortController();
    streamRef.current = ctrl;

    const attacker = state.players.find((p) => p.id === lastBattle.attackerPlayerId);
    const defender = state.players.find((p) => p.id === lastBattle.defenderPlayerId);
    const from = state.territories[lastBattle.from];
    const to = state.territories[lastBattle.to];

    const input: CommentaryInput = {
      attackerName: attacker?.name ?? lastBattle.attackerPlayerId,
      defenderName: defender?.name ?? lastBattle.defenderPlayerId,
      attackerSoldiersBefore: lastBattle.attackerSoldiersBefore,
      defenderSoldiersBefore: lastBattle.defenderSoldiersBefore,
      attackerSoldiersAfter: lastBattle.attackerSoldiersAfter,
      defenderSoldiersAfter: lastBattle.defenderSoldiersAfter,
      fromName: from?.name ?? lastBattle.from,
      toName: to?.name ?? lastBattle.to,
      round: lastBattle.round,
      pairs: lastBattle.pairs,
      attackerLosses: lastBattle.attackerLosses,
      defenderLosses: lastBattle.defenderLosses,
      conquered: lastBattle.defenderSoldiersAfter === 0,
    };

    setText('');
    setLoading(true);

    (async () => {
      try {
        let accumulated = '';
        for await (const chunk of streamCommentary(input, ctrl.signal)) {
          if (ctrl.signal.aborted) return;
          accumulated += chunk;
          setText(accumulated);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [lastBattle?.id]);

  if (!lastBattle) return null;

  return (
    <div className="commentary">
      <h3>Commentary</h3>
      {text
        ? <p>{text}</p>
        : loading
        ? <p className="commentary-loading">War correspondent is writing…</p>
        : null}
    </div>
  );
}