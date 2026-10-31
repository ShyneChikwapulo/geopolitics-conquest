import type { Difficulty } from '@conquest/engine';
import type { GameRow } from './types';

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

type ByLevel = Record<Difficulty, { games: number; wins: number }>;
const emptyLevels = (): ByLevel => ({ easy: { games: 0, wins: 0 }, medium: { games: 0, wins: 0 }, hard: { games: 0, wins: 0 } });
const rate = (n: number, d: number): number | null => (d === 0 ? null : n / d);

export interface PersonalStats {
  games: number;
  active: number;
  finished: number;
  wins: number;
  winRate: number | null;
  avgRounds: number | null;
  /** Rounds in your fastest victory. */
  fastestWin: number | null;
  battles: number;
  conquests: number;
  byDifficulty: ByLevel;
  favourite: { code: string; games: number } | null;
}

export function personalStats(rows: readonly GameRow[]): PersonalStats {
  const finished = rows.filter((r) => r.status === 'finished' && r.summary);
  const wins = finished.filter((r) => r.summary!.humanWon);
  const byDifficulty = emptyLevels();
  for (const r of finished) {
    byDifficulty[r.difficulty].games++;
    if (r.summary!.humanWon) byDifficulty[r.difficulty].wins++;
  }
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.humanCode, (counts.get(r.humanCode) ?? 0) + 1);
  const fav = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    games: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    finished: finished.length,
    wins: wins.length,
    winRate: rate(wins.length, finished.length),
    avgRounds: finished.length ? finished.reduce((n, r) => n + r.summary!.rounds, 0) / finished.length : null,
    fastestWin: wins.length ? Math.min(...wins.map((r) => r.summary!.rounds)) : null,
    battles: rows.reduce((n, r) => n + r.stats.battles, 0),
    conquests: rows.reduce((n, r) => n + r.stats.conquests, 0),
    byDifficulty,
    favourite: fav ? { code: fav[0], games: fav[1] } : null,
  };
}

export interface PlatformStats {
  games: number;
  humanWins: number;
  humanWinRate: number | null;
  avgRounds: number | null;
  humanEliminatedRate: number | null;
  byDifficulty: ByLevel;
  /** How many games were won by the player who sat in each turn-order seat (index 0 = went first). */
  winsBySeat: number[];
  battles: number;
}

export function platformStats(rows: readonly GameRow[]): PlatformStats {
  const finished = rows.filter((r) => r.status === 'finished' && r.summary);
  const byDifficulty = emptyLevels();
  const winsBySeat = new Array<number>(10).fill(0);
  let eliminated = 0;
  for (const r of finished) {
    const s = r.summary!;
    byDifficulty[r.difficulty].games++;
    if (s.humanWon) byDifficulty[r.difficulty].wins++;
    if (s.humanEliminated) eliminated++;
    if (s.winnerSeat !== null && s.winnerSeat >= 0 && s.winnerSeat < 10) winsBySeat[s.winnerSeat]!++;
  }
  const humanWins = finished.filter((r) => r.summary!.humanWon).length;
  return {
    games: finished.length,
    humanWins,
    humanWinRate: rate(humanWins, finished.length),
    avgRounds: finished.length ? finished.reduce((n, r) => n + r.summary!.rounds, 0) / finished.length : null,
    humanEliminatedRate: rate(eliminated, finished.length),
    byDifficulty,
    winsBySeat,
    battles: finished.reduce((n, r) => n + r.summary!.battles, 0),
  };
}

export const pct = (x: number | null): string => (x === null ? '–' : `${Math.round(x * 100)}%`);
export const num1 = (x: number | null): string => (x === null ? '–' : (Math.round(x * 10) / 10).toString());
export { LEVELS };
