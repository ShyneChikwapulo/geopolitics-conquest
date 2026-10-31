import { useState } from 'react';
import type { GameEvent } from '@conquest/engine';
import type { LogEntry } from '../game/playback';

type Decision = Extract<GameEvent, { type: 'npcDecision' }>;

interface Props {
  log: readonly LogEntry[];
  nameOf: (code: string) => string;
  colorOf: (playerId: string) => string;
  /** Asks the AI to elaborate on a decision. Omit to hide the button (spectators, no LLM configured). */
  explain?: (d: Decision, round: number) => Promise<string | null>;
  round: number;
}

export function DecisionFeed({ log, nameOf, colorOf, explain, round }: Props) {
  const decisions = log
    .filter((l): l is LogEntry & { event: Decision } => l.event.type === 'npcDecision')
    .slice(-7)
    .reverse();
  const [explained, setExplained] = useState<Record<number, string | 'loading' | 'none'>>({});

  const ask = async (id: number, d: Decision): Promise<void> => {
    setExplained((m) => ({ ...m, [id]: 'loading' }));
    const text = await explain!(d, round);
    setExplained((m) => ({ ...m, [id]: text ?? 'none' }));
  };

  return (
    <section className="panel" aria-label="Rival decisions">
      <h3>Rival decisions <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· every move, justified</span></h3>
      <ul className="feed">
        {decisions.length === 0 && <li className="muted">Rivals explain every move here.</li>}
        {decisions.map((l, i) => {
          const d = l.event;
          const ex = explained[l.id];
          return (
            <li key={l.id} className={i === 0 ? 'latest' : ''}>
              <span className="who" style={{ color: colorOf(d.playerId) }}>{nameOf(d.playerId)}</span>
              {d.reason}
              <div className="meta">
                {d.source === 'llm' && <span className="tag brain" title="Chosen by the AI advisor from options the game engine had already verified">🧠 AI chose</span>}
                {d.metrics?.winProbability != null && <span className="tag">win {Math.round(d.metrics.winProbability * 100)}%</span>}
                {d.metrics?.expectedLosses != null && <span className="tag">~{Math.round(d.metrics.expectedLosses * 10) / 10} lost</span>}
              </div>
              {explain && d.kind !== 'endTurn' && !ex && (
                <button className="mini" onClick={() => void ask(l.id, d)}>
                  Explain with AI
                </button>
              )}
              {ex === 'loading' && <div className="explain muted"><span className="spinner" /> thinking…</div>}
              {ex === 'none' && <div className="explain muted">The AI could not add anything the engine hasn't already said.</div>}
              {ex && ex !== 'loading' && ex !== 'none' && <div className="explain">{ex}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
