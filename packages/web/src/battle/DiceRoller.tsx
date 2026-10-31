import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { DicePips } from './DicePips';

type Face = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';

/** Which cube face shows which pip count (classic die, opposite faces sum to 7). */
const FACE_FOR_VALUE: Record<number, Face> = { 1: 'front', 6: 'back', 3: 'right', 4: 'left', 5: 'top', 2: 'bottom' };

/** Cube rotations (deg) that bring each face to the viewer. */
const ROTATION_FOR_FACE: Record<Face, { x: number; y: number }> = {
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
  durationMs: number;
  variant: 'attacker' | 'defender';
  /** Edge length of the die in px. */
  size?: number;
}

export function DiceRoller({ value, rolling, durationMs, variant, size = 44 }: DiceRollerProps) {
  const [landedFace, setLandedFace] = useState<Face>(FACE_FOR_VALUE[value] ?? 'front');
  const [extraSpins, setExtraSpins] = useState({ x: 0, y: 0 });
  const lastRollingRef = useRef(false);

  // When the roll starts: add 2-3 full spins (random direction) on top of the landed pose.
  useEffect(() => {
    if (rolling && !lastRollingRef.current) {
      setExtraSpins({ x: 360 * (2 + Math.floor(Math.random() * 2)), y: 360 * (2 + Math.floor(Math.random() * 2)) });
    }
    lastRollingRef.current = rolling;
  }, [rolling]);

  // When the roll ends: snap to the face that shows the engine's value.
  useEffect(() => {
    if (!rolling) setLandedFace(FACE_FOR_VALUE[value] ?? 'front');
  }, [rolling, value]);

  const rotation = useMemo(() => {
    const base = ROTATION_FOR_FACE[landedFace];
    return { x: base.x + (rolling ? extraSpins.x : 0), y: base.y + (rolling ? extraSpins.y : 0), z: rolling ? 720 : 0 };
  }, [landedFace, rolling, extraSpins]);

  const transition = rolling
    ? `transform ${Math.max(durationMs * 0.9, 60)}ms cubic-bezier(.25,.6,.35,1)`
    : `transform ${Math.max(durationMs * 0.15, 80)}ms cubic-bezier(.34,1.56,.64,1)`;

  const pip = variant === 'attacker' ? '#d9431f' : '#2a2723';
  return (
    <div
      className={`dice-cube-scene ${rolling ? 'rolling' : 'landed'}`}
      style={{ '--die': `${size}px` } as CSSProperties}
      role="img"
      aria-label={`${variant === 'attacker' ? 'Attacker' : 'Defender'} die: ${rolling ? 'rolling' : value}`}
    >
      <div
        className={`dice-cube ${variant} ${rolling ? 'rolling' : 'landed'}`}
        style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`, transition }}
      >
        <div className="dice-face front"><DicePips face={1} color={pip} /></div>
        <div className="dice-face back"><DicePips face={6} color={pip} /></div>
        <div className="dice-face right"><DicePips face={3} color={pip} /></div>
        <div className="dice-face left"><DicePips face={4} color={pip} /></div>
        <div className="dice-face top"><DicePips face={5} color={pip} /></div>
        <div className="dice-face bottom"><DicePips face={2} color={pip} /></div>
      </div>
      <div className="dice-shadow" />
    </div>
  );
}
