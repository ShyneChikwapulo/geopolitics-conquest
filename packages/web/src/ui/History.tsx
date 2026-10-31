import { useEffect, useState } from 'react';
import type { GameState } from '@conquest/engine';
import { loadAllGames } from '../game/localStore';

export function History({ onReplay }: { onReplay: (id: string) => void }) {
  const [games, setGames] = useState<GameState[]>([]);
  useEffect(() => { setGames(loadAllGames().sort((a, b) => b.version - a.version)); }, []);
  if (games.length === 0) return null;
  return (
    <div className="history">
      <h3>History</h3>
      <ul>
        {games.slice(0, 20).map((g) => {
          const winner = g.players.find((p) => p.id === g.winnerId);
          return (
            <li key={g.id}>
              <span>Round {g.round}</span>
              <span>{winner ? `${winner.name} won` : 'Unfinished'}</span>
              <button onClick={() => onReplay(g.id)}>Replay</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}