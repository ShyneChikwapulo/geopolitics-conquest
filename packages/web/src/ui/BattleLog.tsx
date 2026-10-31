import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../game/useGame';
import type { LogEntry } from '../game/GameProvider';

interface Group {
  key: number;
  header: LogEntry;
  events: LogEntry[];
}

export function BattleLog() {
  const { log } = useGame();
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];
    let cur: Group | null = null;
    for (const e of log) {
      if (e.kind === 'turnStarted') {
        if (cur) out.push(cur);
        cur = { key: e.id, header: e, events: [] };
      } else if (cur) {
        cur.events.push(e);
      }
    }
    if (cur) out.push(cur);
    return out;
  }, [log]);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log.length]);

  return (
    <div className="battle-log" ref={ref}>
      <h3>Battle log</h3>
      {groups.map((g, i) => {
        const isLastTwo = i >= groups.length - 2;
        const isCollapsed = collapsed[g.key] ?? !isLastTwo;
        return (
          <div key={g.key} className="log-group">
            <button
              className="log-group-header"
              onClick={() => setCollapsed((c) => ({ ...c, [g.key]: !isCollapsed }))}
            >
              <span className="log-ts">
                {new Date(g.header.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span>{g.header.text.replace(/^---\s*|\s*---$/g, '')}</span>
              <span className="log-count">
                {g.events.length} event{g.events.length === 1 ? '' : 's'}
              </span>
              <span className="log-caret">{isCollapsed ? '▸' : '▾'}</span>
            </button>
            {!isCollapsed && (
              <ol>
                {g.events.map((e) => (
                  <li key={e.id} className={`ev ev-${e.kind}`}>
                    <span className="log-ts">
                      {new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {e.text}
                  </li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}