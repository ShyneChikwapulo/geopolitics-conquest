/** One colour per player. The human always has index 0 (the ember accent of the design system). */
export const PLAYER_COLORS = [
  '#ff5c35',
  '#6a8ca9',
  '#a6aa64',
  '#c87c42',
  '#8f7bb3',
  '#3f9aa0',
  '#c4607a',
  '#d4b44a',
  '#5b6fb5',
  '#5fa36a',
] as const;

export function colorFor(colorIndex: number): string {
  return PLAYER_COLORS[colorIndex % PLAYER_COLORS.length]!;
}
