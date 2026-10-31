/** One colour per player. The human always has index 0. */
export const PLAYER_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#14b8a6',
] as const;

export function colorFor(colorIndex: number): string {
  return PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]!;
}
