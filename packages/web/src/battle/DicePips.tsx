const LAYOUT: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

export function DicePips({ face, color = '#0b1220' }: { face: number; color?: string }) {
  const on = LAYOUT[face] ?? [];
  return (
    <div className="pips">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="pip" style={{ background: on.includes(i) ? color : 'transparent' }} />
      ))}
    </div>
  );
}