import { describe, expect, it } from 'vitest';
import { captureGain, soldiersForPopulation } from '../src/soldiers';

describe('soldiersForPopulation', () => {
  it.each([
    [800, 1],
    [5_000_000, 1],
    [5_000_001, 2],
    [10_000_000, 2],
    [10_000_001, 3],
    [25_000_000, 3],
    [50_000_000, 4],
    [75_000_000, 5],
    [100_000_000, 6],
    [125_000_000, 7],
    [150_000_000, 8],
    [150_000_001, 9],
    [1_400_000_000, 9],
  ])('%i people -> %i soldiers', (pop, soldiers) => {
    expect(soldiersForPopulation(pop)).toBe(soldiers);
  });

  it('rejects invalid populations', () => {
    expect(() => soldiersForPopulation(-1)).toThrow();
    expect(() => soldiersForPopulation(NaN)).toThrow();
  });
});

describe('captureGain', () => {
  it.each([
    [9, 4], // India example from the brief
    [1, 2], // Vatican City example from the brief
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 3],
    [8, 4],
  ])('base %i -> gain %i', (base, gain) => {
    expect(captureGain(base)).toBe(gain);
  });
});