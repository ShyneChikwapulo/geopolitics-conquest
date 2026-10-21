import { describe, expect, it } from 'vitest';
import { BALANCED } from '../src/npc';
import { npcPolicy, playGame, randomPolicy, syntheticCountries, type Contestant } from '../src/sim';

const countries = syntheticCountries(7);
const allBalanced = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { label: 'balanced', policy: npcPolicy(BALANCED) }])) as Record<string, Contestant>;

describe('headless simulation', () => {
  it('NPC-only games always finish in a sensible number of rounds', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = playGame({ seed, countries, assign: allBalanced, maxRounds: 300 });
      expect(r.finished).toBe(true);
      expect(r.rounds).toBeLessThan(200);
    }
  });

  it('is reproducible', () => {
    const a = playGame({ seed: 11, countries, assign: allBalanced });
    const b = playGame({ seed: 11, countries, assign: allBalanced });
    expect(a).toEqual(b);
  });

  it('an NPC clearly beats random opponents (10% would be chance)', () => {
    let heroWins = 0;
    const games = 80;
    for (let seed = 1; seed <= games; seed++) {
      const r = playGame({
        seed,
        countries,
        assign: (ids, humanId) =>
          Object.fromEntries(
            ids.map((id, i) => [
              id,
              id === humanId
                ? { label: 'hero', policy: npcPolicy(BALANCED) }
                : { label: 'random', policy: randomPolicy(seed * 100 + i) },
            ]),
          ) as Record<string, Contestant>,
      });
      if (r.winnerLabel === 'hero') heroWins++;
    }
    expect(heroWins / games).toBeGreaterThan(0.4);
  });
});