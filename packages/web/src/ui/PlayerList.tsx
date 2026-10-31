import { useGame } from '../game/useGame';
import { PLAYER_COLORS } from '../map/WorldMap';

export function PlayerList() {
  const { state, npcProfileLabel } = useGame();
  const countBy = (id: string) => Object.values(state.territories).filter((t) => t.ownerId === id);
  return (
    <div className="player-list">
      <h3>Players</h3>
      <ul>
        {state.players.map((p, i) => {
          const owned = countBy(p.id);
          const isCurrent = i === state.currentPlayerIndex;
          const profile = npcProfileLabel(p.id);
          return (
            <li key={p.id} className={`${isCurrent ? 'current' : ''} ${p.eliminated ? 'eliminated' : ''}`}>
              <span className="dot" style={{ background: PLAYER_COLORS[p.colorIndex] }} />
              <span className="name">{p.name}{p.isHuman ? ' (you)' : ''}</span>
              <span className={`profile-tag profile-${profile}`}>{profile}</span>
              <span className="stats">{owned.length} · {owned.reduce((a, t) => a + t.soldiers, 0)} s</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}