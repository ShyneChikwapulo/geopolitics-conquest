import { describe, expect, it } from 'vitest';
import { diceCount, resolvePairs, rollRound } from '../src/combat';
import { scripted } from './fixtures';

describe('diceCount (examples from the brief)', () => {
  it('10 vs 2 -> 2 dice each', () => expect(diceCount(10, 2)).toBe(2));
  it('3 vs 5 -> 2 dice each', () => expect(diceCount(3, 5)).toBe(2));
  it('2 vs 5 -> 1 die each', () => expect(diceCount(2, 5)).toBe(1));
  it('1 soldier cannot attack', () => expect(diceCount(1, 5)).toBe(0));
});

describe('resolvePairs', () => {
  it('brief example: [1,4] vs [2,3] -> both lose one', () => {
    const r = resolvePairs([1, 4], [2, 3]);
    expect(r.attackerLosses).toBe(1);
    expect(r.defenderLosses).toBe(1);
    expect(r.pairs.map((p) => p.result)).toEqual(['defender', 'attacker']);
  });

  it('does NOT sort the dice: pairs are matched in order', () => {
    const r = resolvePairs([6, 1], [1, 6]);
    expect(r.pairs.map((p) => p.result)).toEqual(['attacker', 'defender']);
  });

  it('ties kill nobody', () => {
    const r = resolvePairs([3], [3]);
    expect(r).toMatchObject({ attackerLosses: 0, defenderLosses: 0 });
    expect(r.pairs[0]?.result).toBe('tie');
  });

  it('rejects mismatched dice counts', () => {
    expect(() => resolvePairs([1, 2], [3])).toThrow();
  });
});

describe('rollRound', () => {
  it('rolls attacker dice first, then defender dice', () => {
    const r = rollRound(scripted([6, 1, 2, 5]), 10, 2);
    expect(r.pairs).toEqual([
      { attacker: 6, defender: 2, result: 'attacker' },
      { attacker: 1, defender: 5, result: 'defender' },
    ]);
  });
});