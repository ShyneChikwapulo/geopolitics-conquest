import { describe, expect, it } from 'vitest';
import {
  applyAction,
  BALANCED,
  createGame,
  currentPlayer,
  decideNpc,
  DIFFICULTIES,
  makeDecider,
  validateAction,
  type Difficulty,
} from '../src';
import { COUNTRIES } from './fixtures';

describe('difficulty', () => {
  it('medium is exactly the plain balanced heuristic', () => {
    const decide = makeDecider('medium');
    for (let seed = 1; seed <= 10; seed++) {
      let s = createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
      for (let i = 0; i < 80 && s.phase !== 'finished'; i++) {
        const a = decide(s, DIFFICULTIES.medium.profile);
        expect(a).toEqual(decideNpc(s, BALANCED));
        s = applyAction(s, a.action).state;
      }
    }
  });

  it.each(['easy', 'medium', 'hard'] as Difficulty[])('%s only ever produces legal actions, and is deterministic', (level) => {
    const decide = makeDecider(level);
    for (let seed = 1; seed <= 12; seed++) {
      let s = createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
      let guard = 0;
      while (s.phase !== 'finished' && s.round <= 80 && guard++ < 6000) {
        const d = decide(s, DIFFICULTIES[level].profile);
        expect(validateAction(s, d.action)).toBeNull();
        expect(decide(s, DIFFICULTIES[level].profile)).toEqual(d);
        s = applyAction(s, d.action).state;
      }
    }
  });

  it('easy rivals make instinct-driven decisions some of the time, and say so', () => {
    const decide = makeDecider('easy');
    let instinct = 0;
    let total = 0;
    for (let seed = 1; seed <= 15; seed++) {
      let s = createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
      for (let i = 0; i < 100 && s.phase !== 'finished'; i++) {
        const d = decide(s, DIFFICULTIES.easy.profile);
        total++;
        if (d.reason.startsWith('Acting on instinct')) instinct++;
        s = applyAction(s, d.action).state;
      }
    }
    expect(instinct / total).toBeGreaterThan(0.15);
    expect(instinct / total).toBeLessThan(0.45);
  });

  it('a decent player wins far more often against Easy rivals than against Medium rivals', () => {
    const humanWins = (level: Difficulty, games: number): number => {
      let wins = 0;
      const decide = makeDecider(level);
      for (let seed = 1; seed <= games; seed++) {
        let s = createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
        while (s.phase !== 'finished' && s.round <= 200) {
          const me = currentPlayer(s);
          const d = me.isHuman ? decideNpc(s, BALANCED) : decide(s, DIFFICULTIES[level].profile);
          s = applyAction(s, d.action).state;
        }
        if (s.winnerId === 'ZAF') wins++;
      }
      return wins;
    };
    expect(humanWins('easy', 120)).toBeGreaterThan(humanWins('medium', 120) + 8);
  }, 120_000);
});
