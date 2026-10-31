import { SPEEDS, type Speed } from '../game/playback';
import { IconFastForward } from './Icons';

interface Props {
  speed: Speed;
  setSpeed: (s: Speed) => void;
  fastToMe: boolean;
  setFastToMe: (v: boolean) => void;
  /** When it is the player's own turn there is nothing to fast-forward to. */
  disableFastForward?: boolean;
  /** Replays have no "my turn". */
  showFastForward?: boolean;
}

export function SpeedControls({ speed, setSpeed, fastToMe, setFastToMe, disableFastForward, showFastForward = true }: Props) {
  return (
    <div className="speed-controls" role="group" aria-label="Playback speed">
      <span className="label">Speed</span>
      {SPEEDS.map((s) => (
        <button key={s} aria-pressed={!fastToMe && s === speed} onClick={() => { setFastToMe(false); setSpeed(s); }} title={`Play at ${s}x`}>
          {s}×
        </button>
      ))}
      {showFastForward && (
        <button
          className="ff"
          aria-pressed={fastToMe}
          disabled={disableFastForward && !fastToMe}
          onClick={() => setFastToMe(!fastToMe)}
          title="Fast-forward the rivals' turns until it is your turn again. Every move is still shown."
        >
          <IconFastForward /> To my turn
        </button>
      )}
    </div>
  );
}
