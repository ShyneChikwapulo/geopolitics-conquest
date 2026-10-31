import { useMemo, useState } from 'react';
import { describeEvent } from '@conquest/engine';
import type { LogEntry } from '../game/playback';

interface Group {
  key: number;
  title: string;
  lines: Array<{ id: number; type: string; text: string }>;
}

export function BattleLog({ log, nameOf }: { log: readonly LogEntry[]; nameOf: (code: string) => string }) {
  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    for (const { id, event } of log) {
      if (event.type === 'turnStarted') {
        out.push({ key: id, title: `Round ${event.round} · ${nameOf(event.playerId)}`, lines: [] });
        continue;
      }
      const text = describeEvent(event, nameOf);
      if (!text) continue;
      if (out.length === 0) out.push({ key: -1, title: 'Opening', lines: [] });
      out[out.length - 1]!.lines.push({ id, type: event.type, text });
    }
    return out;
  }, [log, nameOf]);

  const [open, setOpen] = useState<Record<number, boolean>>({});
  const latest = groups.at(-1)?.key;
  const isOpen = (g: Group): boolean => open[g.key] ?? g.key === latest;
  const visible = groups.filter((g) => g.lines.length > 0 || g.key === latest).slice(-40).reverse();

  return (
    <section className="panel" aria-label="Game log">
      <h3>Game log</h3>
      <div className="log-groups">
        {visible.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nothing has happened yet.</p>}
        {visible.map((g) => (
          <div key={g.key} className="log-group">
            <button className="log-group-header" aria-expanded={isOpen(g)} onClick={() => setOpen((m) => ({ ...m, [g.key]: !isOpen(g) }))}>
              <span aria-hidden>{isOpen(g) ? '▾' : '▸'}</span>
              {g.title}
              <span className="count">{g.lines.length}</span>
            </button>
            {isOpen(g) && (
              <ol>
                {g.lines.map((l) => (
                  <li key={l.id} className={`ev-${l.type}`}>
                    {l.text}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
