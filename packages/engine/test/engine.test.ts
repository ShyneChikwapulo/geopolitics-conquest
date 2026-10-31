import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  currentPlayer,
  IllegalActionError,
  soldiersForPopulation,
  validateAction,
  type GameState,
  type Player,
} from '../src';
import { COUNTRIES, scripted } from './fixtures';

function makeState(
  players: string[],
  territories: Array<{ code: string; owner: string; soldiers: number; base?: number }>,
): GameState {
  return {
    id: 'test',
    seed: 1,
    rngState: 1,
    players: players.map(
      (id, i): Player => ({
        id, name: id, homeCountry: id, isHuman: i === 0, colorIndex: i, eliminated: false,
        hasTakenFirstTurn: true,
      }),
    ),
    territories: Object.fromEntries(
      territories.map((t) => [
        t.code,
        { code: t.code, name: t.code, ownerId: t.owner, soldiers: t.soldiers, baseValue: t.base ?? t.soldiers },
      ]),
    ),
    currentPlayerIndex: 0,
    round: 1,
    phase: 'action',
    reinforcementsPending: 0,
    attackUsed: false,
    attack: null,
    capture: null,
    winnerId: null,
    version: 0,
  };
}

describe('createGame', () => {
  const make = (seed: number, humanCode = 'ZAF') =>
    createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode });

  it('creates 10 distinct players including exactly one human', () => {
    const { state } = make(42);
    expect(state.players).toHaveLength(10);
    expect(new Set(state.players.map((p) => p.id)).size).toBe(10);
    expect(state.players.filter((p) => p.isHuman).map((p) => p.id)).toEqual(['ZAF']);
    expect(Object.keys(state.territories)).toHaveLength(10);
  });

  it('allocates soldiers from the population table and each player owns their home', () => {
    const { state } = make(42);
    for (const p of state.players) {
      const t = state.territories[p.homeCountry]!;
      const pop = COUNTRIES.find((c) => c.code === p.homeCountry)!.population;
      expect(t.ownerId).toBe(p.id);
      expect(t.soldiers).toBe(soldiersForPopulation(pop));
      expect(t.baseValue).toBe(t.soldiers);
    }
    expect(state.territories['ZAF']!.soldiers).toBe(5);
  });

  it('is deterministic per seed and randomises the first player across seeds', () => {
    expect(make(7).state).toEqual(make(7).state);
    const firsts = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) firsts.add(make(seed).state.players[0]!.id);
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('starts round 1 with no reinforcement phase', () => {
    const { state } = make(1);
    expect(state.round).toBe(1);
    expect(state.phase).toBe('action');
  });

  it('rejects bad input', () => {
    expect(() => make(1, 'XXX')).toThrow();
    expect(() => createGame({ id: 'g', seed: 1, allCountries: COUNTRIES.slice(0, 5), humanCode: 'ZAF' })).toThrow();
  });
});

describe('validation', () => {
  const base = () =>
    makeState(
      ['A', 'B'],
      [
        { code: 'X', owner: 'A', soldiers: 5 },
        { code: 'W', owner: 'A', soldiers: 2 },
        { code: 'Y', owner: 'B', soldiers: 3 },
      ],
    );

  it('only the current player may act', () => {
    expect(validateAction(base(), { type: 'endTurn', playerId: 'B' })).toBe('It is not your turn.');
  });

  it('transfers must leave at least 1 soldier behind', () => {
    const s = base();
    expect(validateAction(s, { type: 'transfer', playerId: 'A', from: 'X', to: 'W', count: 5 })).toMatch(/at least 1/);
    const r = applyAction(s, { type: 'transfer', playerId: 'A', from: 'X', to: 'W', count: 4 });
    expect(r.state.territories['X']!.soldiers).toBe(1);
    expect(r.state.territories['W']!.soldiers).toBe(6);
  });

  it('cannot transfer to a country you do not control', () => {
    expect(validateAction(base(), { type: 'transfer', playerId: 'A', from: 'X', to: 'Y', count: 1 })).toMatch(/do not control/);
  });

  it('cannot attack yourself, or from a country with fewer than 2 soldiers', () => {
    const s = makeState(
      ['A', 'B'],
      [
        { code: 'X', owner: 'A', soldiers: 1 },
        { code: 'W', owner: 'A', soldiers: 4 },
        { code: 'Y', owner: 'B', soldiers: 3 },
      ],
    );
    expect(validateAction(s, { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' })).toMatch(/at least 2/);
    expect(validateAction(s, { type: 'startAttack', playerId: 'A', from: 'W', to: 'X' })).toMatch(/own country/);
  });

  it('blocks transfers and ending the turn mid-attack', () => {
    const s = applyAction(base(), { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    expect(validateAction(s, { type: 'transfer', playerId: 'A', from: 'X', to: 'W', count: 1 })).toMatch(/attack is in progress/);
    expect(validateAction(s, { type: 'endTurn', playerId: 'A' })).toMatch(/stop your attack/);
  });

  it('throws IllegalActionError when applying an illegal action', () => {
    expect(() => applyAction(base(), { type: 'roll', playerId: 'A' })).toThrow(IllegalActionError);
  });
});

describe('attacks', () => {
  const three = () =>
    makeState(
      ['A', 'B', 'C'],
      [
        { code: 'X', owner: 'A', soldiers: 5 },
        { code: 'Y', owner: 'B', soldiers: 2, base: 9 },
        { code: 'Z', owner: 'C', soldiers: 3 },
      ],
    );

  it('continues after a partial result (brief-style mixed round)', () => {
    const s0 = makeState(
      ['A', 'B'],
      [
        { code: 'X', owner: 'A', soldiers: 5 },
        { code: 'Y', owner: 'B', soldiers: 3 },
      ],
    );
    const s1 = applyAction(s0, { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    const r = applyAction(s1, { type: 'roll', playerId: 'A' }, { roller: scripted([6, 1, 3, 2, 5, 3]) });
    expect(r.state.territories['X']!.soldiers).toBe(4);
    expect(r.state.territories['Y']!.soldiers).toBe(2);
    expect(r.state.phase).toBe('attacking');
    expect(r.state.attack?.rounds).toBe(1);
  });

  it('a tie changes nothing and the attack continues', () => {
    const s0 = makeState(
      ['A', 'B'],
      [
        { code: 'X', owner: 'A', soldiers: 3 },
        { code: 'Y', owner: 'B', soldiers: 3 },
      ],
    );
    const s1 = applyAction(s0, { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    const r = applyAction(s1, { type: 'roll', playerId: 'A' }, { roller: scripted([4, 2, 4, 2]) });
    expect(r.state.territories['X']!.soldiers).toBe(3);
    expect(r.state.territories['Y']!.soldiers).toBe(3);
    expect(r.state.phase).toBe('attacking');
  });

  it('attacker reduced to 1 soldier fails and keeps their territory; defender keeps theirs', () => {
    const s0 = makeState(
      ['A', 'B'],
      [
        { code: 'X', owner: 'A', soldiers: 2 },
        { code: 'Y', owner: 'B', soldiers: 5 },
      ],
    );
    const s1 = applyAction(s0, { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    const r = applyAction(s1, { type: 'roll', playerId: 'A' }, { roller: scripted([1, 6]) });
    expect(r.state.territories['X']).toMatchObject({ ownerId: 'A', soldiers: 1 });
    expect(r.state.territories['Y']).toMatchObject({ ownerId: 'B', soldiers: 5 });
    expect(r.state.phase).toBe('action');
    expect(r.state.attackUsed).toBe(true);
    expect(r.events.some((e) => e.type === 'attackFailed')).toBe(true);
  });

  it('stopping an attack ends the turn', () => {
    const s1 = applyAction(three(), { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    const r = applyAction(s1, { type: 'stopAttack', playerId: 'A' });
    expect(currentPlayer(r.state).id).toBe('B');
    expect(r.state.attack).toBeNull();
  });

  it('conquest: gain uses the base value, capture lets you move soldiers, one attack per turn', () => {
    const s1 = applyAction(three(), { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    const r = applyAction(s1, { type: 'roll', playerId: 'A' }, { roller: scripted([6, 6, 1, 1]) });

    expect(r.state.territories['Y']).toMatchObject({ ownerId: 'A', soldiers: 4 });
    expect(r.state.territories['X']!.soldiers).toBe(5);
    expect(r.state.phase).toBe('capture');
    expect(r.state.players.find((p) => p.id === 'B')!.eliminated).toBe(true);
    expect(r.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['battleRound', 'territoryConquered', 'playerEliminated']),
    );

    const c = applyAction(r.state, { type: 'completeCapture', playerId: 'A', move: 3 }).state;
    expect(c.territories['X']!.soldiers).toBe(2);
    expect(c.territories['Y']!.soldiers).toBe(7);
    expect(c.phase).toBe('action');
    expect(validateAction(c, { type: 'startAttack', playerId: 'A', from: 'X', to: 'Z' })).toMatch(/already attacked/);
  });

  it('capture cannot strip the attacking country below 1 soldier', () => {
    const s1 = applyAction(three(), { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    const r = applyAction(s1, { type: 'roll', playerId: 'A' }, { roller: scripted([6, 6, 1, 1]) });
    expect(validateAction(r.state, { type: 'completeCapture', playerId: 'A', move: 5 })).toMatch(/at least 1/);
  });

  it('eliminated players are skipped; a new round grants 2 soldiers per country', () => {
    let s = applyAction(three(), { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    s = applyAction(s, { type: 'roll', playerId: 'A' }, { roller: scripted([6, 6, 1, 1]) }).state;
    s = applyAction(s, { type: 'completeCapture', playerId: 'A', move: 0 }).state;
    s = applyAction(s, { type: 'endTurn', playerId: 'A' }).state;
    expect(currentPlayer(s).id).toBe('C');
    expect(s.round).toBe(1);

    s = applyAction(s, { type: 'endTurn', playerId: 'C' }).state;
    expect(currentPlayer(s).id).toBe('A');
    expect(s.round).toBe(2);
    expect(s.phase).toBe('reinforce');
    expect(s.reinforcementsPending).toBe(4);
  });

  it('conquering the last country wins the game', () => {
    const s0 = makeState(
      ['A', 'B'],
      [
        { code: 'X', owner: 'A', soldiers: 5 },
        { code: 'Y', owner: 'B', soldiers: 1, base: 1 },
      ],
    );
    const s1 = applyAction(s0, { type: 'startAttack', playerId: 'A', from: 'X', to: 'Y' }).state;
    const r = applyAction(s1, { type: 'roll', playerId: 'A' }, { roller: scripted([6, 1]) });
    expect(r.state.phase).toBe('finished');
    expect(r.state.winnerId).toBe('A');
    expect(r.events.some((e) => e.type === 'gameWon')).toBe(true);
    expect(validateAction(r.state, { type: 'endTurn', playerId: 'A' })).toBe('The game is over.');
  });
});

describe('reinforcements', () => {
  const trio = () =>
    makeState(
      ['A', 'B', 'C'],
      [
        { code: 'X', owner: 'A', soldiers: 3 },
        { code: 'Y', owner: 'B', soldiers: 3 },
        { code: 'Z', owner: 'C', soldiers: 3 },
      ],
    );

  it('round 2 starts with a reinforce phase that must be allocated exactly', () => {
    let s = trio();
    s = applyAction(s, { type: 'endTurn', playerId: 'A' }).state;
    s = applyAction(s, { type: 'endTurn', playerId: 'B' }).state;
    expect(s.round).toBe(1);
    s = applyAction(s, { type: 'endTurn', playerId: 'C' }).state;

    expect(s.round).toBe(2);
    expect(currentPlayer(s).id).toBe('A');
    expect(s.phase).toBe('reinforce');
    expect(s.reinforcementsPending).toBe(2);

    expect(validateAction(s, { type: 'endTurn', playerId: 'A' })).toMatch(/Allocate/);
    expect(validateAction(s, { type: 'allocate', playerId: 'A', allocations: { X: 1 } })).toMatch(/exactly 2/);
    expect(validateAction(s, { type: 'allocate', playerId: 'A', allocations: { X: 1, Y: 1 } })).toMatch(/do not control/);

    const r = applyAction(s, { type: 'allocate', playerId: 'A', allocations: { X: 2 } });
    expect(r.state.territories['X']!.soldiers).toBe(5);
    expect(r.state.phase).toBe('action');
    expect(r.state.reinforcementsPending).toBe(0);
  });
});