/** Filtering for the My games list. Pure functions, so they are unit-tested without a browser. */

export type GameFilter = 'all' | 'active' | 'won' | 'lost';

export const GAME_FILTERS: ReadonlyArray<{ id: GameFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'In progress' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

/** The part of a stored game row that decides its outcome. */
export interface Filterable {
  status: string;
  summary?: { humanWon: boolean } | null;
}

/** In progress while active; otherwise Won or Lost depending on whether the human conquered the world. */
export function outcomeOf(row: Filterable): Exclude<GameFilter, 'all'> {
  if (row.status === 'active') return 'active';
  return row.summary?.humanWon ? 'won' : 'lost';
}

export function filterGames<T extends Filterable>(rows: readonly T[], filter: GameFilter): T[] {
  return filter === 'all' ? [...rows] : rows.filter((r) => outcomeOf(r) === filter);
}

export function countByFilter(rows: readonly Filterable[]): Record<GameFilter, number> {
  const counts: Record<GameFilter, number> = { all: rows.length, active: 0, won: 0, lost: 0 };
  for (const r of rows) counts[outcomeOf(r)] += 1;
  return counts;
}
