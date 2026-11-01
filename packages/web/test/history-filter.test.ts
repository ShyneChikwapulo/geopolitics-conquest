import { describe, expect, it } from 'vitest';
import { countByFilter, filterGames, outcomeOf } from '../src/game/historyFilter';

const active = { id: 'a', status: 'active' };
const won = { id: 'w', status: 'finished', summary: { humanWon: true } };
const lost = { id: 'l', status: 'finished', summary: { humanWon: false } };
const lostNoSummary = { id: 'x', status: 'finished' };
const rows = [active, won, lost, lostNoSummary];

describe('My games filter', () => {
  it('classifies each game', () => {
    expect(outcomeOf(active)).toBe('active');
    expect(outcomeOf(won)).toBe('won');
    expect(outcomeOf(lost)).toBe('lost');
    expect(outcomeOf(lostNoSummary)).toBe('lost');
  });

  it('keeps everything for All and never mutates the input', () => {
    const copy = [...rows];
    expect(filterGames(rows, 'all')).toEqual(rows);
    expect(rows).toEqual(copy);
  });

  it('filters by In progress, Won and Lost', () => {
    expect(filterGames(rows, 'active').map((r) => r.id)).toEqual(['a']);
    expect(filterGames(rows, 'won').map((r) => r.id)).toEqual(['w']);
    expect(filterGames(rows, 'lost').map((r) => r.id)).toEqual(['l', 'x']);
  });

  it('counts every filter, and the counts add up', () => {
    const c = countByFilter(rows);
    expect(c).toEqual({ all: 4, active: 1, won: 1, lost: 2 });
    expect(c.active + c.won + c.lost).toBe(c.all);
  });

  it('handles an empty list', () => {
    expect(countByFilter([])).toEqual({ all: 0, active: 0, won: 0, lost: 0 });
    expect(filterGames([], 'won')).toEqual([]);
  });
});
