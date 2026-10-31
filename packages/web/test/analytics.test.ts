import { describe, expect, it } from 'vitest';
import { personalStats, platformStats } from '../src/game/analytics';
import type { GameRow } from '../src/game/types';

const row = (over: Partial<GameRow> & { won?: boolean; rounds?: number; seat?: number }): GameRow => {
  const { won = false, rounds = 20, seat = 3, ...rest } = over;
  const finished = (rest.status ?? 'finished') === 'finished';
  return {
    id: Math.random().toString(36),
    ownerUid: 'u',
    humanCode: 'ZAF',
    difficulty: 'medium',
    seed: 1,
    strategistId: null,
    createdAt: 1,
    updatedAt: 2,
    status: 'finished',
    round: rounds,
    version: 1,
    batches: 1,
    winnerId: won ? 'ZAF' : 'BRA',
    stats: { battles: 10, conquests: 3 },
    summary: finished ? { rounds, winnerId: won ? 'ZAF' : 'BRA', humanWon: won, humanEliminated: !won, humanSeat: 2, winnerSeat: won ? 2 : seat, battles: 10, conquests: 3 } : undefined,
    ...rest,
  } as GameRow;
};

describe('personalStats', () => {
  it('handles no games', () => {
    const s = personalStats([]);
    expect(s).toMatchObject({ games: 0, finished: 0, winRate: null, avgRounds: null, fastestWin: null, favourite: null });
  });
  it('counts wins, win rate, averages and the fastest win', () => {
    const s = personalStats([row({ won: true, rounds: 12 }), row({ won: true, rounds: 30 }), row({ won: false, rounds: 18 }), row({ status: 'active' })]);
    expect(s.games).toBe(4);
    expect(s.active).toBe(1);
    expect(s.finished).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.avgRounds).toBeCloseTo(20);
    expect(s.fastestWin).toBe(12);
    expect(s.conquests).toBe(12);
  });
  it('splits results by difficulty and finds the favourite country', () => {
    const s = personalStats([row({ difficulty: 'hard', won: true }), row({ difficulty: 'hard' }), row({ difficulty: 'easy', won: true }), row({ humanCode: 'IND' })]);
    expect(s.byDifficulty.hard).toEqual({ games: 2, wins: 1 });
    expect(s.byDifficulty.easy).toEqual({ games: 1, wins: 1 });
    expect(s.favourite).toEqual({ code: 'ZAF', games: 3 });
  });
});

describe('platformStats', () => {
  it('ignores unfinished games and tallies winners by seat', () => {
    const s = platformStats([row({ won: false, seat: 0 }), row({ won: false, seat: 0 }), row({ won: true }), row({ status: 'active' })]);
    expect(s.games).toBe(3);
    expect(s.humanWins).toBe(1);
    expect(s.humanEliminatedRate).toBeCloseTo(2 / 3);
    expect(s.winsBySeat[0]).toBe(2);
    expect(s.winsBySeat[2]).toBe(1);
    expect(s.winsBySeat.reduce((a, b) => a + b, 0)).toBe(3);
  });
  it('is empty-safe', () => {
    expect(platformStats([])).toMatchObject({ games: 0, humanWinRate: null, avgRounds: null });
  });
});
