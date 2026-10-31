export function SoldierBadge({ x, y, soldiers, color }: { x: number; y: number; soldiers: number; color: string }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="soldier-badge" pointerEvents="none">
      <circle r={9} fill={color} stroke="#0b1220" strokeWidth={1.5} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill="#0b1220">
        {soldiers}
      </text>
    </g>
  );
}