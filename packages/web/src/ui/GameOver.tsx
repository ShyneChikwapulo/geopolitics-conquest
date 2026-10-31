import { useGame } from '../game/useGame';

export function GameOver() {
  const { state } = useGame();
  const winner = state.players.find((p) => p.id === state.winnerId);
  if (!winner) return null;
  return (
    <div className="game-over">
      <div>
        <h2>{winner.isHuman ? '🏆 You win!' : `${winner.name} wins the world.`}</h2>
        <p>Rounds: {state.round}</p>
      </div>
    </div>
  );
}