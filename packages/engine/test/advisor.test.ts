import { describe, expect, it } from 'vitest';
import {
  advanceNpcsAsync,
  applyAction,
  BALANCED,
  createGame,
  currentPlayer,
  rankAttackPlans,
  runNpcTurn,
  runNpcTurnAsync,
  RunAbortedError,
  toCandidates,
  validateChoice,
  type Advisor,
  type GameState,
} from '../src';
import { COUNTRIES } from './fixtures';

/** Plays NPC turns until an NPC has at least two attack options, returning that state. */
function stateWithChoice(): GameState {
  for (let seed = 1; seed <= 300; seed++) {
    let s = createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
    for (let i = 0; i < 400 && s.phase !== 'finished'; i++) {
      if (s.phase === 'action' && !s.attackUsed && rankAttackPlans(s, currentPlayer(s).id, BALANCED, 3).length >= 2) return s;
      s = applyAction(s, { type: 'endTurn', playerId: currentPlayer(s).id }).state;
      if (s.phase === 'reinforce') {
        const me = currentPlayer(s);
        const own = Object.values(s.territories).find((t) => t.ownerId === me.id)!;
        s = applyAction(s, { type: 'allocate', playerId: me.id, allocations: { [own.code]: s.reinforcementsPending } }).state;
      }
    }
  }
  throw new Error('no state with a choice found');
}

describe('validateChoice', () => {
  const cands = toCandidates(stateWithChoice(), rankAttackPlans(stateWithChoice(), currentPlayer(stateWithChoice()).id, BALANCED, 3));
  it('accepts a valid index with a reason, and trims/limits the reason', () => {
    expect(validateChoice({ index: 1, reason: '  Weak   neighbour  ' }, cands)).toEqual({ index: 1, reason: 'Weak neighbour' });
    expect(validateChoice({ index: 0, reason: 'x'.repeat(1000) }, cands)!.reason).toHaveLength(400);
  });
  it('rejects bad indexes, empty reasons and non-objects', () => {
    expect(validateChoice({ index: 7, reason: 'valid reason' }, cands)).toBeNull();
    expect(validateChoice({ index: -1, reason: 'valid reason' }, cands)).toBeNull();
    expect(validateChoice({ index: 1.5, reason: 'valid reason' }, cands)).toBeNull();
    expect(validateChoice({ index: 0, reason: '  ' }, cands)).toBeNull();
    expect(validateChoice(null, cands)).toBeNull();
  });
});

describe('rankAttackPlans', () => {
  it('lists distinct targets, best first, and index 0 is what the heuristic would pick', () => {
    const s = stateWithChoice();
    const me = currentPlayer(s).id;
    const plans = rankAttackPlans(s, me, BALANCED, 3);
    expect(new Set(plans.map((p) => p.to.code)).size).toBe(plans.length);
    for (let i = 1; i < plans.length; i++) expect(plans[i - 1]!.utility).toBeGreaterThanOrEqual(plans[i]!.utility);
    const first = runNpcTurn(s).events.find((e) => e.type === 'attackStarted');
    if (first && first.type === 'attackStarted') expect(first.to).toBe(plans[0]!.to.code);
  });
});

describe('runNpcTurnAsync with an advisor', () => {
  it('behaves exactly like the sync runner when no advisor is configured', async () => {
    const s = stateWithChoice();
    expect(await runNpcTurnAsync(s)).toEqual(runNpcTurn(s));
  });

  it('attacks the target the advisor picks, tagging the decision as an LLM decision', async () => {
    const s = stateWithChoice();
    const me = currentPlayer(s).id;
    const plans = rankAttackPlans(s, me, BALANCED, 3);
    const pick = plans.length - 1; // deliberately NOT the heuristic favourite
    const advisor: Advisor = async ({ candidates }) => ({ index: pick, reason: `Going for ${candidates[pick]!.toName}.` });
    const r = await runNpcTurnAsync(s, { advisor, advisorFor: (id) => id === me });
    const llm = r.events.find((e) => e.type === 'npcDecision' && e.source === 'llm');
    expect(llm).toBeTruthy();
    const attack = r.events.find((e) => e.type === 'attackStarted');
    expect(attack && attack.type === 'attackStarted' ? attack.to : null).toBe(plans[pick]!.to.code);
  });

  it('falls back to the heuristic when the advisor fails, times out, or returns nonsense', async () => {
    const s = stateWithChoice();
    const me = currentPlayer(s).id;
    const expected = runNpcTurn(s);
    for (const advisor of [
      (async () => {
        throw new Error('network');
      }) as Advisor,
      (async () => ({ index: 99, reason: 'invalid index' })) as Advisor,
      (async () => null) as Advisor,
      (() => new Promise(() => {})) as Advisor, // never resolves
    ]) {
      const r = await runNpcTurnAsync(s, { advisor, advisorFor: (id) => id === me, advisorTimeoutMs: 30 });
      expect(r).toEqual(expected);
    }
  });

  it('only consults the advisor for the NPCs it is enabled for, at most once per turn', async () => {
    const s = stateWithChoice();
    const me = currentPlayer(s).id;
    let calls = 0;
    const advisor: Advisor = async () => {
      calls++;
      return { index: 0, reason: 'The obvious choice.' };
    };
    await runNpcTurnAsync(s, { advisor, advisorFor: () => false });
    expect(calls).toBe(0);
    await runNpcTurnAsync(s, { advisor, advisorFor: (id) => id === me });
    expect(calls).toBe(1);
  });

  it('reports thinking state and can be aborted', async () => {
    const s = stateWithChoice();
    const me = currentPlayer(s).id;
    const seen: Array<string | null> = [];
    const advisor: Advisor = async () => ({ index: 0, reason: 'The obvious choice.' });
    await runNpcTurnAsync(s, { advisor, advisorFor: (id) => id === me, onThinking: (id) => seen.push(id) });
    expect(seen).toEqual([me, null]);
    await expect(runNpcTurnAsync(s, { shouldAbort: () => true })).rejects.toBeInstanceOf(RunAbortedError);
  });

  it('advanceNpcsAsync stops at the human, like the sync version', async () => {
    const s = createGame({ id: 'g', seed: 5, allCountries: COUNTRIES, humanCode: 'ZAF' }).state;
    const r = await advanceNpcsAsync(s);
    const p = currentPlayer(r.state);
    expect(r.state.phase === 'finished' || (p.isHuman && !p.eliminated)).toBe(true);
  });
});
