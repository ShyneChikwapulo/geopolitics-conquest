import { describe, expect, it } from 'vitest';
import { BALANCED, npcPolicy, playGame, randomPolicy } from '../src';
import { syntheticCountries } from '../src/sim';
import type { Contestant } from '../src/sim';

const countries = syntheticCountries(1);
const allBalanced = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { label: 'balanced', policy: npcPolicy(BALANCED) } as Contestant]));

describe('headless simulation', () => {
  it('NPC-only games always finish in a sensible number of rounds', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = playGame({ seed, countries, assign: allBalanced, maxRounds: 300 });
      expect(r.finished).toBe(true);
      expect(r.rounds).toBeLessThan(300);
    }
  }, 30_000);

  it('is reproducible', () => {
    const opts = { seed: 42, countries, assign: allBalanced, maxRounds: 300 };
    expect(playGame(opts)).toEqual(playGame(opts));
  });

  it('an NPC clearly beats random opponents (10% would be chance)', () => {
    let wins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const assign = (ids: string[], humanId: string) =>
        Object.fromEntries(
          ids.map((id, i) => [
            id,
            id === humanId
              ? { label: 'hero', policy: npcPolicy(BALANCED) }
              : { label: 'random', policy: randomPolicy(seed * 100 + i) },
          ]),
        ) as Record<string, Contestant>;
      const r = playGame({ seed, countries, assign, maxRounds: 300 });
      if (r.winnerLabel === 'hero') wins++;
    }
    expect(wins / 40).toBeGreaterThan(0.5);
  });
});