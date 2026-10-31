import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applyEvent,
  boardFromState,
  BALANCED,
  createGame,
  decideNpc,
  describeEvent,
  foldEvents,
  randomPolicy,
  type GameEvent,
} from '../src';
import { COUNTRIES } from './fixtures';

describe('BoardView rebuilt from events', () => {
  it('matches the real game state after EVERY action, for NPC and random play', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const created = createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' });
      let state = created.state;
      let view = boardFromState(state);
      for (const e of created.events) view = applyEvent(view, e);

      const random = randomPolicy(seed);
      let steps = 0;
      while (state.phase !== 'finished' && state.round <= 80 && steps++ < 8000) {
        const d = seed % 2 === 0 ? decideNpc(state, BALANCED) : random(state);
        const r = applyAction(state, d.action);
        state = r.state;
        for (const e of r.events) view = applyEvent(view, e);

        const truth = boardFromState(state);
        const norm = (v: typeof view) => ({ ...v, eliminated: [...v.eliminated].sort(), firstTurnTaken: [...v.firstTurnTaken].sort() });
        expect(norm(view)).toEqual(norm(truth));
      }
    }
  }, 60_000);

  it('never mutates the previous view', () => {
    const { state, events } = createGame({ id: 'g', seed: 3, allCountries: COUNTRIES, humanCode: 'ZAF' });
    const before = boardFromState(state);
    const snapshot = structuredClone(before);
    for (const e of events) applyEvent(before, e);
    expect(before).toEqual(snapshot);
  });

  it('foldEvents is the same as applying events one by one', () => {
    const created = createGame({ id: 'g', seed: 9, allCountries: COUNTRIES, humanCode: 'ZAF' });
    let state = created.state;
    const all: GameEvent[] = [...created.events];
    for (let i = 0; i < 200 && state.phase !== 'finished'; i++) {
      const r = applyAction(state, decideNpc(state, BALANCED).action);
      state = r.state;
      all.push(...r.events);
    }
    const initial = boardFromState(createGame({ id: 'g', seed: 9, allCountries: COUNTRIES, humanCode: 'ZAF' }).state);
    const folded = foldEvents(initial, all);
    const truth = boardFromState(state);
    expect({ ...folded, eliminated: [...folded.eliminated].sort(), firstTurnTaken: [...folded.firstTurnTaken].sort() }).toEqual({
      ...truth,
      eliminated: [...truth.eliminated].sort(),
      firstTurnTaken: [...truth.firstTurnTaken].sort(),
    });
  });
});

describe('describeEvent', () => {
  const name = (c: string) => ({ A: 'Alpha', B: 'Beta' })[c] ?? c;
  it('describes a battle round with the exact dice and numbers', () => {
    const e: GameEvent = {
      type: 'battleRound',
      playerId: 'A',
      from: 'A',
      to: 'B',
      round: 2,
      pairs: [
        { attacker: 6, defender: 2, result: 'attacker' },
        { attacker: 1, defender: 5, result: 'defender' },
      ],
      attackerLosses: 1,
      defenderLosses: 1,
      attackerSoldiersAfter: 9,
      defenderSoldiersAfter: 1,
    };
    expect(describeEvent(e, name)).toBe('Battle round 2 (6v2, 1v5): Alpha loses 1, Beta loses 1. Now 9 vs 1.');
  });
  it('handles singular/plural and silent events', () => {
    expect(describeEvent({ type: 'reinforcementsGranted', playerId: 'A', amount: 2, territoriesHeld: 1 }, name)).toBe(
      'Alpha receives 2 reinforcements for 1 country.',
    );
    expect(describeEvent({ type: 'turnEnded', playerId: 'A' }, name)).toBeNull();
    expect(describeEvent({ type: 'npcDecision', playerId: 'A', kind: 'endTurn', reason: 'x' }, name)).toBeNull();
  });
});
