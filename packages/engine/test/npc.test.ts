import { describe, expect, it } from 'vitest';
import { applyAction, currentPlayer, createGame, validateAction, type GameState, type Player } from '../src';
import {
  AGGRESSIVE,
  BALANCED,
  DEFENSIVE,
  advanceNpcs,
  bestAttackPlan,
  decideNpc,
  garrisonTarget,
  pickVictim,
  runNpcTurn,
} from '../src/npc';
import { COUNTRIES } from './fixtures';

function makeState(
  players: string[],
  territories: Array<{ code: string; owner: string; soldiers: number; base?: number }>,
  over: Partial<GameState> = {},
): GameState {
  return {
    id: 't',
    seed: 1,
    rngState: 1,
    players: players.map((id, i): Player => ({
      id, name: id, homeCountry: id, isHuman: i === 0, colorIndex: i, eliminated: false,
      hasTakenFirstTurn: true,
    })),
    territories: Object.fromEntries(
      territories.map((t) => [t.code, { code: t.code, name: t.code, ownerId: t.owner, soldiers: t.soldiers, baseValue: t.base ?? t.soldiers }]),
    ),
    currentPlayerIndex: 0,
    round: 2,
    phase: 'action',
    reinforcementsPending: 0,
    attackUsed: false,
    attack: null,
    capture: null,
    winnerId: null,
    version: 0,
    ...over,
  };
}

describe('NPC decisions', () => {
  it('attacks an overwhelmingly weak neighbour and explains why', () => {
    const s = makeState(['A', 'B'], [
      { code: 'A', owner: 'A', soldiers: 12 },
      { code: 'B', owner: 'B', soldiers: 1 },
    ]);
    const d = decideNpc(s, BALANCED);
    expect(d.kind).toBe('attack');
    expect(d.action).toMatchObject({ type: 'startAttack', from: 'A', to: 'B' });
    expect(d.reason).toMatch(/win/);
    expect(d.metrics?.winProbability).toBeGreaterThan(0.9);
  });

  it('does not suicide into a much stronger country', () => {
    const s = makeState(['A', 'B'], [
      { code: 'A', owner: 'A', soldiers: 4 },
      { code: 'B', owner: 'B', soldiers: 30 },
    ]);
    const d = decideNpc(s, BALANCED);
    expect(d.kind).toBe('endTurn');
    expect(d.reason).toMatch(/No attack clears my bar/);
  });

  it('massing: pulls surplus from other countries onto the attacker before attacking', () => {
    const s = makeState(['A', 'B'], [
      { code: 'A1', owner: 'A', soldiers: 3 },
      { code: 'A2', owner: 'A', soldiers: 20 },
      { code: 'B1', owner: 'B', soldiers: 6 },
    ]);
    const plan = bestAttackPlan(s, 'A', BALANCED);
    expect(plan).not.toBeNull();
    const d = decideNpc(s, BALANCED);
    expect(['transfer', 'attack']).toContain(d.kind);
    expect(validateAction(s, d.action)).toBeNull();
  });

  it('allocates reinforcements exactly and only to its own countries', () => {
    const s = makeState(
      ['A', 'B'],
      [
        { code: 'A1', owner: 'A', soldiers: 1 },
        { code: 'A2', owner: 'A', soldiers: 5 },
        { code: 'B1', owner: 'B', soldiers: 4 },
      ],
      { phase: 'reinforce', reinforcementsPending: 4 },
    );
    const d = decideNpc(s, BALANCED);
    expect(d.kind).toBe('allocate');
    expect(validateAction(s, d.action)).toBeNull();
    if (d.action.type === 'allocate') {
      expect(Object.values(d.action.allocations).reduce((a, b) => a + b, 0)).toBe(4);
      expect(d.action.allocations['A1']).toBeGreaterThan(0);
    }
  });

  it('breaks off a losing attack (and keeps rolling a winning one)', () => {
    const losing = makeState(
      ['A', 'B'],
      [
        { code: 'A', owner: 'A', soldiers: 3 },
        { code: 'B', owner: 'B', soldiers: 25 },
      ],
      { phase: 'attacking', attack: { from: 'A', to: 'B', rounds: 3 } },
    );
    expect(decideNpc(losing, BALANCED).kind).toBe('stop');

    const winning = makeState(
      ['A', 'B'],
      [
        { code: 'A', owner: 'A', soldiers: 15 },
        { code: 'B', owner: 'B', soldiers: 2 },
      ],
      { phase: 'attacking', attack: { from: 'A', to: 'B', rounds: 1 } },
    );
    expect(decideNpc(winning, BALANCED).kind).toBe('continue');
  });

  it('picks the weakest rival as its victim', () => {
    const s = makeState(['A', 'B', 'C'], [
      { code: 'A', owner: 'A', soldiers: 5 },
      { code: 'B', owner: 'B', soldiers: 9 },
      { code: 'C', owner: 'C', soldiers: 2 },
    ]);
    expect(pickVictim(s, 'A')).toBe('C');
  });

  it('garrison target never drops below the profile floor and respects the army cap', () => {
    const s = makeState(['A', 'B'], [
      { code: 'A1', owner: 'A', soldiers: 3 },
      { code: 'A2', owner: 'A', soldiers: 3 },
      { code: 'B1', owner: 'B', soldiers: 40 },
    ]);
    const g = garrisonTarget(s, 'A', BALANCED);
    expect(g).toBeGreaterThanOrEqual(BALANCED.garrison);
    expect(g).toBeLessThanOrEqual(Math.max(BALANCED.garrison, Math.floor((BALANCED.defenceShare * 6) / 2)));
  });
});

describe('runNpcTurn / advanceNpcs', () => {
  const start = (seed: number) => createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;

  it('plays a full turn with a justification before every action, and hands over the turn', () => {
    const s = start(5);
    const who = currentPlayer(s).id;
    const r = runNpcTurn(s);
    expect(r.events.filter((e) => e.type === 'npcDecision').length).toBeGreaterThan(0);
    expect(r.events[0]?.type).toBe('npcDecision');
    for (const e of r.events) if (e.type === 'npcDecision') expect(e.reason.length).toBeGreaterThan(5);
    expect(r.state.phase === 'finished' || currentPlayer(r.state).id !== who).toBe(true);
  });

  it('advanceNpcs stops at the living human, or at game over', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = advanceNpcs(start(seed));
      const p = currentPlayer(r.state);
      expect(r.state.phase === 'finished' || (p.isHuman && !p.eliminated)).toBe(true);
    }
  });

  it('is deterministic for the same state', () => {
    expect(runNpcTurn(start(9))).toEqual(runNpcTurn(start(9)));
  });

  it('every profile only ever produces legal actions over whole games', () => {
    for (const profile of [BALANCED, AGGRESSIVE, DEFENSIVE]) {
      for (let seed = 1; seed <= 6; seed++) {
        let s = start(seed);
        let guard = 0;
        while (s.phase !== 'finished' && s.round <= 150 && guard++ < 20_000) {
          const d = decideNpc(s, profile);
          expect(validateAction(s, d.action)).toBeNull();
          s = applyAction(s, d.action).state;
        }
      }
    }
  });
});