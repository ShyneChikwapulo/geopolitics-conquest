import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  currentPlayer,
  IllegalActionError,
  validateAction,
  type GameState,
} from '../src';
import { COUNTRIES } from './fixtures';

function startGame(seed: number): GameState {
  return createGame({ id: 'protect', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
}

function firstProtectedTarget(s: GameState) {
  const me = currentPlayer(s);
  return s.players.find((p) => p.id !== me.id && !p.hasTakenFirstTurn);
}

describe('opening protection', () => {
  it('rejects an attack on a player who has not yet taken a turn', () => {
    const s = startGame(7);
    const me = currentPlayer(s);
    const target = firstProtectedTarget(s);
    expect(target).toBeDefined();
    const from = me.homeCountry;
    const bumped: GameState = {
      ...s,
      territories: { ...s.territories, [from]: { ...s.territories[from]!, soldiers: 9 } },
    };
    expect(
      validateAction(bumped, { type: 'startAttack', playerId: me.id, from, to: target!.homeCountry }),
    ).toMatch(/protected/i);
  });

  it('throws IllegalActionError if a protected attack is forced through applyAction', () => {
    const s = startGame(3);
    const me = currentPlayer(s);
    const target = firstProtectedTarget(s)!;
    const from = me.homeCountry;
    const bumped: GameState = {
      ...s,
      territories: { ...s.territories, [from]: { ...s.territories[from]!, soldiers: 9 } },
    };
    expect(() =>
      applyAction(bumped, { type: 'startAttack', playerId: me.id, from, to: target.homeCountry }),
    ).toThrow(IllegalActionError);
  });

  it('lifts protection the moment the player ends their first turn', () => {
    let s = startGame(11);
    const first = currentPlayer(s);
    expect(first.hasTakenFirstTurn).toBe(false);
    s = applyAction(s, { type: 'endTurn', playerId: first.id }).state;
    expect(s.players.find((p) => p.id === first.id)!.hasTakenFirstTurn).toBe(true);
    for (const p of s.players) {
      if (p.id !== first.id) expect(p.hasTakenFirstTurn).toBe(false);
    }
  });

  it('nobody can be eliminated in round 1 before their first turn (200 seeds)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      let s = startGame(seed);
      const acted = new Set<string>();
      while (s.phase !== 'finished' && s.round === 1) {
        const me = currentPlayer(s).id;
        acted.add(me);
        if (s.phase === 'reinforce') {
          const own = Object.values(s.territories).find((t) => t.ownerId === me)!;
          s = applyAction(s, { type: 'allocate', playerId: me, allocations: { [own.code]: s.reinforcementsPending } }).state;
        } else if (s.phase === 'attacking') {
          s = applyAction(s, { type: 'stopAttack', playerId: me }).state;
        } else if (s.phase === 'capture') {
          s = applyAction(s, { type: 'completeCapture', playerId: me, move: 0 }).state;
        } else if (s.phase === 'action') {
          s = applyAction(s, { type: 'endTurn', playerId: me }).state;
        }
      }
      for (const p of s.players) {
        if (!acted.has(p.id)) expect(p.eliminated).toBe(false);
      }
    }
  });
});