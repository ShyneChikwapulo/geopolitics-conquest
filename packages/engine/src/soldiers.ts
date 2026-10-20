/** [inclusive upper population bound, soldiers] */
const TIERS: ReadonlyArray<readonly [number, number]> = [
  [5_000_000, 1],
  [10_000_000, 2],
  [25_000_000, 3],
  [50_000_000, 4],
  [75_000_000, 5],
  [100_000_000, 6],
  [125_000_000, 7],
  [150_000_000, 8],
];

export const MAX_BASE_SOLDIERS = 9;

export function soldiersForPopulation(population: number): number {
  if (!Number.isFinite(population) || population < 0) {
    throw new RangeError(`Invalid population: ${population}`);
  }
  for (const [limit, soldiers] of TIERS) {
    if (population <= limit) return soldiers;
  }
  return MAX_BASE_SOLDIERS;
}

/** Soldiers gained on conquest: max(2, floor(baseValue / 2)). */
export function captureGain(baseValue: number): number {
  return Math.max(2, Math.floor(baseValue / 2));
}