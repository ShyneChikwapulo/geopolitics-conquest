import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@conquest/data';
import { createGame } from '@conquest/engine';
import { pickStrategist } from '../src/game/GameProvider';

describe('pickStrategist', () => {
  const state = (seed: number) => createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
  it('is null without an LLM', () => {
    expect(pickStrategist(state(1), 1, false)).toBeNull();
  });
  it('is always an NPC, and one of the strongest at the start', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = state(seed);
      const id = pickStrategist(s, seed, true)!;
      const p = s.players.find((x) => x.id === id)!;
      expect(p.isHuman).toBe(false);
      const army = (pid: string) => Object.values(s.territories).filter((t) => t.ownerId === pid).reduce((n, t) => n + t.soldiers, 0);
      const best = Math.max(...s.players.filter((x) => !x.isHuman).map((x) => army(x.id)));
      expect(army(id)).toBe(best);
    }
  });
  it('is deterministic for a given seed', () => {
    expect(pickStrategist(state(5), 5, true)).toBe(pickStrategist(state(5), 5, true));
  });
});
