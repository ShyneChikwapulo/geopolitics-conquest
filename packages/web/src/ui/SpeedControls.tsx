import { useGame } from '../game/useGame';

export function SpeedControls() {
  const { speed, setSpeed } = useGame();
  const opts = ['1x', '4x', '16x', 'instant'] as const;
  return (
    <div className="speed-controls">
      {opts.map((o) => (
        <button key={o} className={speed === o ? 'primary' : ''} onClick={() => setSpeed(o)}>{o}</button>
      ))}
    </div>
  );
}