import { COUNTRIES } from '@conquest/data';
import { projectCentroid } from './useMapProjection';

interface AttackLineProps {
  fromCode: string;
  toCode: string;
  /** Ignored for the line stroke (always red), kept for the dot colour. */
  color: string;
}

export function AttackLine({ fromCode, toCode, color }: AttackLineProps) {
  const from = COUNTRIES.find((c) => c.code === fromCode);
  const to = COUNTRIES.find((c) => c.code === toCode);
  if (!from || !to) return null;

  const [x1, y1] = projectCentroid(from.lng, from.lat);
  const [x2, y2] = projectCentroid(to.lng, to.lat);

  // Arc that always bows "upward" on the screen, regardless of which end is which.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const lift = Math.min(140, len * 0.32);

  // Perpendicular direction, then flip so the y-component is negative (i.e. upward on screen).
  let nx = -dy / len;
  let ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }

  const cx = (x1 + x2) / 2 + nx * lift;
  const cy = (y1 + y2) / 2 + ny * lift;

  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

  return (
    <g className="attack-line" pointerEvents="none">
      {/* soft red glow under the line */}
      <path d={d} fill="none" stroke="#ef4444" strokeOpacity={0.15} strokeWidth={9} strokeLinecap="round" />

      {/* solid red dashed line, marching along the path */}
      <path
        d={d}
        fill="none"
        stroke="#ef4444"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="8 10"
        className="attack-line-dash"
      />

      {/* pulsing target ring at the destination */}
      <circle cx={x2} cy={y2} r={6} fill="#ef4444" stroke="#fff" strokeWidth={1.5} opacity={0.95}>
        <animate attributeName="r" values="6;10;6" dur="1.2s" repeatCount="indefinite" />
      </circle>

      {/* small origin dot */}
      <circle cx={x1} cy={y1} r={4} fill={color} stroke="#fff" strokeWidth={1} />
    </g>
  );
}