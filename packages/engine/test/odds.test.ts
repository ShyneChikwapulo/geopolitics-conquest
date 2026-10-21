import { describe, expect, it } from 'vitest';
import { rollRound } from '../src/combat';
import { expectedAttackerLosses, winProbability } from '../src/npc/odds';
import { Rng } from '../src/rng';

/** Plays a full attack with the REAL combat code until conquest or failure. */
function simulate(a: number, d: number, trials: number, seed: number) {
  const rng = new Rng(seed);
  let wins = 0;
  let lossSum = 0;
  for (let i = 0; i < trials; i++) {
    let att = a;
    let def = d;
    while (att >= 2 && def > 0) {
      const r = rollRound(rng, att, def);
      att -= r.attackerLosses;
      def -= r.defenderLosses;
    }
    if (def === 0) wins++;
    lossSum += a - att;
  }
  return { p: wins / trials, losses: lossSum / trials };
}

describe('winProbability / expectedAttackerLosses match the real combat engine', () => {
  it.each([
    [2, 1],
    [3, 1],
    [3, 5],
    [5, 3],
    [6, 6],
    [10, 9],
    [15, 9],
    [30, 12],
  ])('attacker %i vs defender %i', (a, d) => {
    const sim = simulate(a, d, 25_000, a * 100 + d);
    expect(Math.abs(winProbability(a, d) - sim.p)).toBeLessThan(0.015);
    expect(Math.abs(expectedAttackerLosses(a, d) - sim.losses)).toBeLessThan(0.12);
  });
});

describe('odds sanity', () => {
  it('hand-checked values', () => {
    expect(winProbability(2, 1)).toBeCloseTo(0.5, 10);
    expect(winProbability(3, 1)).toBeCloseTo(0.75, 10);
  });
  it('edge cases', () => {
    expect(winProbability(1, 5)).toBe(0); // cannot attack with a single soldier
    expect(winProbability(5, 0)).toBe(1);
    expect(expectedAttackerLosses(1, 5)).toBe(0);
  });
  it('more attackers is never worse, more defenders is never better', () => {
    for (let d = 1; d <= 12; d++) {
      for (let a = 2; a <= 30; a++) {
        expect(winProbability(a + 1, d)).toBeGreaterThanOrEqual(winProbability(a, d));
        expect(winProbability(a, d + 1)).toBeLessThanOrEqual(winProbability(a, d));
      }
    }
  });
  it('stays in [0,1] and handles huge armies via the approximation', () => {
    const p = winProbability(500, 300);
    expect(p).toBeGreaterThan(0.99);
    expect(p).toBeLessThanOrEqual(1);
    expect(winProbability(300, 300)).toBeGreaterThan(0.3);
    expect(winProbability(300, 300)).toBeLessThan(0.7);
  });
});