import type { CommentaryItem } from '../game/useBattleCommentary';

export function CommentaryPanel({ items, aiEnabled }: { items: readonly CommentaryItem[]; aiEnabled: boolean }) {
  const shown = [...items].reverse().slice(0, 3);
  return (
    <section className="panel" aria-label="Commentary">
      <h3>
        Commentary <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· {aiEnabled ? 'AI commentator, fact-checked' : 'match report'}</span>
      </h3>
      <div aria-live="polite">
        {shown.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>The commentator is warming up. Battles will be called here.</p>}
        {shown.map((c) => (
          <p key={c.id} className="commentary-line" style={{ margin: 0 }}>
            {c.text || (c.loading ? '…' : '')}
            <span className="src">{c.loading ? 'live' : c.source === 'llm' ? 'AI' : 'report'}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
