import { getCountry } from '@conquest/data';
import type { BoardView, Player } from '@conquest/engine';
import { Flag } from './Flag';

interface Props {
  players: readonly Player[];
  view: BoardView;
  colorOf: (playerId: string) => string;
  nameOf: (code: string) => string;
  humanId: string | null;
  strategistId?: string | null;
}

export function PlayerList({ players, view, colorOf, nameOf, humanId, strategistId }: Props) {
  const rows = players.map((p) => {
    const owned = Object.values(view.territories).filter((t) => t.ownerId === p.id);
    return {
      p,
      countries: owned.length,
      soldiers: owned.reduce((n, t) => n + t.soldiers, 0),
      out: view.eliminated.includes(p.id),
      protectedNow: !view.firstTurnTaken.includes(p.id) && !view.eliminated.includes(p.id),
    };
  });
  const anyProtected = rows.some((r) => r.protectedNow);

  return (
    <section className="panel" aria-label="Players">
      <h3>Players <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· in turn order</span></h3>
      <ul className="players">
        {rows.map(({ p, countries, soldiers, out, protectedNow }) => (
          <li key={p.id} className={[p.id === view.currentPlayerId && !out ? 'current' : '', out ? 'out' : ''].join(' ').trim()} aria-current={p.id === view.currentPlayerId ? 'true' : undefined}>
            <span className="bar" style={{ background: colorOf(p.id) }} />
            <Flag iso2={getCountry(p.id)?.iso2 ?? 'un'} size={15} />
            <span className="nm">
              <span className="txt">{nameOf(p.id)}</span>
              {p.id === humanId && <span className="tag you">you</span>}
              {p.id === strategistId && <span className="tag brain" title="Its attack choices are made by an AI advisor">🧠 AI</span>}
              {protectedNow && <span className="tag shield" title="Protected until its first turn: cannot be attacked yet">🛡</span>}
            </span>
            <span className="stats">{out ? 'eliminated' : `${countries}c · ${soldiers}s`}</span>
          </li>
        ))}
      </ul>
      {anyProtected && (
        <div className="legend">
          <i /> hatched land is protected until its owner's first turn
        </div>
      )}
    </section>
  );
}
