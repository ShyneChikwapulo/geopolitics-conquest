import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng';

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    expect(Array.from({ length: 20 }, () => a.die())).toEqual(Array.from({ length: 20 }, () => b.die()));
  });

  it('can resume from a saved state', () => {
    const a = new Rng(7);
    a.die();
    a.die();
    const resumed = new Rng(a.state);
    expect(resumed.die()).toBe(a.die());
  });

  it('rolls fair-looking dice in 1..6', () => {
    const rng = new Rng(99);
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 10_000; i++) counts[rng.die()]!++;
    expect(counts[0]).toBe(0);
    for (let face = 1; face <= 6; face++) {
      expect(counts[face]).toBeGreaterThan(1500);
      expect(counts[face]).toBeLessThan(1830);
    }
  });

  it('shuffles without losing items', () => {
    const rng = new Rng(5);
    const out = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});