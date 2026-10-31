import { useEffect, useMemo, useRef, useState } from 'react';
import { DicePips } from './DicePips';

/** Which cube face shows which pip count (classic die, opposite faces sum to 7). */
const FACE_FOR_VALUE: Record<number, 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'> = {
  1: 'front',
  6: 'back',
  3: 'right',
  4: 'left',
  5: 'top',
  2: 'bottom',
};

/** Cube rotations (deg) that bring each face to the viewer. */
const ROTATION_FOR_FACE: Record<'front' | 'back' | 'right' | 'left' | 'top' | 'bottom', { x: number; y: number }> = {
  front: { x: 0, y: 0 },
  back: { x: 0, y: 180 },
  right: { x: 0, y: -90 },
  left: { x: 0, y: 90 },
  top: { x: -90, y: 0 },
  bottom: { x: 90, y: 0 },
};

export interface DiceRollerProps {
  value: number; // 1..6, the engine's outcome
  rolling: boolean;
  durationMs: number; // 0 for instant
  variant: 'attacker' | 'defender';
}

export function DiceRoller({ value, rolling, durationMs, variant }: DiceRollerProps) {
  const [landedFace, setLandedFace] = useState<'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'>(
    FACE_FOR_VALUE[value] ?? 'front',
  );
  const [extraSpins, setExtraSpins] = useState({ x: 0, y: 0 });
  const lastRollingRef = useRef(false);

  // When the roll starts: add 2–3 full spins (random direction) on top of the landed pose.
  useEffect(() => {
    if (rolling && !lastRollingRef.current) {
      setExtraSpins({
        x: 360 * (2 + Math.floor(Math.random() * 2)),
        y: 360 * (2 + Math.floor(Math.random() * 2)),
      });
    }
    lastRollingRef.current = rolling;
  }, [rolling]);

  // When the roll ends: snap to the face that shows the engine's value.
  useEffect(() => {
    if (!rolling) setLandedFace(FACE_FOR_VALUE[value] ?? 'front');
  }, [rolling, value]);

  const rotation = useMemo(() => {
    const base = ROTATION_FOR_FACE[landedFace];
    return {
      x: base.x + (rolling ? extraSpins.x : 0),
      y: base.y + (rolling ? extraSpins.y : 0),
      z: rolling ? 720 : 0,
    };
  }, [landedFace, rolling, extraSpins]);

  const transition = rolling
    ? `transform ${Math.max(durationMs * 0.9, 60)}ms cubic-bezier(.25,.6,.35,1)`
    : `transform ${Math.max(durationMs * 0.15, 80)}ms cubic-bezier(.34,1.56,.64,1)`;

  const className = `dice-cube ${variant} ${rolling ? 'rolling' : 'landed'}`;

  return (
    <div className="dice-cube-scene" aria-label={`${variant} die: ${rolling ? 'rolling' : value}`}>
      <div
        className={className}
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
          transition,
        }}
      >
        <div className="dice-face front"><DicePips face={1} color={variant === 'attacker' ? '#1d4ed8' : '#b91c1c'} /></div>
        <div className="dice-face back"><DicePips face={6} color={variant === 'attacker' ? '#1d4ed8' : '#b91c1c'} /></div>
        <div className="dice-face right"><DicePips face={3} color={variant === 'attacker' ? '#1d4ed8' : '#b91c1c'} /></div>
        <div className="dice-face left"><DicePips face={4} color={variant === 'attacker' ? '#1d4ed8' : '#b91c1c'} /></div>
        <div className="dice-face top"><DicePips face={5} color={variant === 'attacker' ? '#1d4ed8' : '#b91c1c'} /></div>
        <div className="dice-face bottom"><DicePips face={2} color={variant === 'attacker' ? '#1d4ed8' : '#b91c1c'} /></div>
      </div>
      <div className="dice-shadow" />
    </div>
  );
}