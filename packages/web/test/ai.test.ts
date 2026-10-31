import { describe, expect, it } from 'vitest';
import type { AttackCandidate, GameEvent } from '@conquest/engine';
import { battleFacts, streamCommentary, templateCommentary, validateCommentary, type BattleFacts } from '../src/ai/commentary';
import { extractJson, extractNumbers, mentions, onlyAllowedNumbers } from '../src/ai/facts';
import { parseAdvisorReply, validateExplanation, advisorUserPrompt } from '../src/ai/advisor';
import type { LlmSettings } from '../src/config';

const facts = (over: Partial<BattleFacts> = {}): BattleFacts => ({
  battleRound: 2,
  attacker: 'Brazil',
  defender: 'India',
  attackerCountry: 'Brazil',
  defenderCountry: 'India',
  pairs: [
    { attacker: 6, defender: 2, winner: 'attacker' },
    { attacker: 1, defender: 5, winner: 'defender' },
  ],
  attackerLosses: 1,
  defenderLosses: 1,
  attackerSoldiersAfter: 9,
  defenderSoldiersAfter: 1,
  outcome: 'ongoing',
  ...over,
});

describe('fact helpers', () => {
  it('extracts digits and counted number-words', () => {
    expect(extractNumbers('lost 3 soldiers and two dice, 78% sure')).toEqual([3, 78, 2]);
    expect(extractNumbers('one of the best')).toEqual([]); // "one" not used as a count
  });
  it('checks numbers against an allowed set', () => {
    expect(onlyAllowedNumbers('9 against 1', new Set([9, 1]))).toBe(true);
    expect(onlyAllowedNumbers('9 against 4', new Set([9, 1]))).toBe(false);
  });
  it('matches names ignoring case and accents', () => {
    expect(mentions('Côte d’Ivoire advances', "cote d’ivoire")).toBe(true);
    expect(mentions('Peru advances', 'Brazil')).toBe(false);
  });
  it('extracts JSON from fenced or chatty replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! {"a":2} hope that helps')).toEqual({ a: 2 });
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('{broken')).toBeNull();
  });
});

describe('validateCommentary: accepts only what the engine said', () => {
  it('accepts a faithful sentence', () => {
    expect(validateCommentary('Brazil and India trade blows in round 2: each side loses 1 soldier, leaving 9 against 1.', facts())).toBe(true);
    expect(validateCommentary('India clings on as Brazil presses, with dice 6 and 2 then 1 and 5.', facts())).toBe(true);
  });
  it('rejects a wrong number', () => {
    expect(validateCommentary('Brazil loses 4 soldiers as India fights back.', facts())).toBe(false);
    expect(validateCommentary('Brazil loses three soldiers as India fights back.', facts())).toBe(false);
  });
  it('rejects an invented conquest, but allows saying the defender held', () => {
    expect(validateCommentary('India falls to Brazil in a stunning collapse.', facts())).toBe(false);
    expect(validateCommentary('Brazil captured India after a brutal exchange.', facts())).toBe(false);
    expect(validateCommentary('India holds firm and Brazil fails to break through.', facts())).toBe(true);
    expect(validateCommentary('India falls to Brazil in a stunning collapse.', facts({ outcome: 'conquered', defenderSoldiersAfter: 0 }))).toBe(true);
  });
  it('rejects dragging in a country that is not in the fight', () => {
    expect(validateCommentary('Brazil beats India much as Germany once did.', facts())).toBe(false);
    expect(validateCommentary('Brazil beats India, and Guinea-Bissau watches on.', facts())).toBe(false);
  });
  it('does not confuse similar names (Niger/Nigeria, Guinea/Equatorial Guinea)', () => {
    const f = facts({ attacker: 'Nigeria', attackerCountry: 'Nigeria', defender: 'Equatorial Guinea', defenderCountry: 'Equatorial Guinea' });
    expect(validateCommentary('Nigeria presses Equatorial Guinea hard, 9 against 1.', f)).toBe(true);
    expect(validateCommentary('Nigeria presses Niger hard, 9 against 1.', f)).toBe(false);
  });
  it('rejects text that names neither country, markdown, and absurd lengths', () => {
    expect(validateCommentary('Narnia attacks Mordor with great fury today.', facts())).toBe(false);
    expect(validateCommentary('**Brazil** attacks India with fury today.', facts())).toBe(false);
    expect(validateCommentary('Brazil.', facts())).toBe(false);
    expect(validateCommentary('Brazil attacks India. ' + 'x'.repeat(500), facts())).toBe(false);
  });
  it('the factual template always passes its own validator', () => {
    for (const outcome of ['ongoing', 'conquered', 'attackFailed'] as const) {
      for (let k = 1; k <= 9; k++) {
        const f = facts({
          outcome,
          pairs: Array.from({ length: k }, (_, i) => ({ attacker: (i % 6) + 1, defender: ((i + 2) % 6) + 1, winner: 'tie' as const })),
          defenderSoldiersAfter: outcome === 'conquered' ? 0 : 3,
          attackerSoldiersAfter: outcome === 'attackFailed' ? 1 : 7,
        });
        expect(validateCommentary(templateCommentary(f), f), templateCommentary(f)).toBe(true);
      }
    }
  });
});

describe('battleFacts', () => {
  it('derives the outcome from the numbers in the event', () => {
    const base = { type: 'battleRound', playerId: 'BRA', from: 'BRA', to: 'IND', round: 1, pairs: [{ attacker: 6, defender: 1, result: 'attacker' }], attackerLosses: 0, defenderLosses: 1 } as const;
    const names = { attacker: 'Brazil', defender: 'India', attackerCountry: 'Brazil', defenderCountry: 'India' };
    const mk = (a: number, d: number) => battleFacts({ ...base, pairs: [...base.pairs], attackerSoldiersAfter: a, defenderSoldiersAfter: d } as unknown as Extract<GameEvent, { type: 'battleRound' }>, names).outcome;
    expect(mk(5, 0)).toBe('conquered');
    expect(mk(1, 3)).toBe('attackFailed');
    expect(mk(5, 3)).toBe('ongoing');
  });
});

// ------- streaming with a fake fetch ------------------------------------------------------
const settings: LlmSettings = { endpoint: 'https://x.test/v1/chat/completions', apiKey: 'k', model: 'm', viaProxy: false };
function sse(parts: string[]): typeof fetch {
  const enc = new TextEncoder();
  return (async () =>
    new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(enc.encode(': OPENROUTER PROCESSING\n\n'));
          for (const p of parts) c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`));
          c.enqueue(enc.encode('data: [DONE]\n\n'));
          c.close();
        },
      }),
      { status: 200 },
    )) as unknown as typeof fetch;
}

describe('streamCommentary', () => {
  it('streams a valid answer and reports it as LLM-written', async () => {
    const shown: string[] = [];
    const r = await streamCommentary(facts(), settings, (t) => shown.push(t), undefined, sse(['Brazil and India ', 'each lose 1 soldier, ', 'leaving 9 against 1.']));
    expect(r.source).toBe('llm');
    expect(r.text).toBe('Brazil and India each lose 1 soldier, leaving 9 against 1.');
    expect(shown.length).toBeGreaterThan(2);
  });
  it('replaces an answer with a wrong number by the factual template', async () => {
    const shown: Array<[string, boolean]> = [];
    const r = await streamCommentary(facts(), settings, (t, p) => shown.push([t, p]), undefined, sse(['Brazil loses 7 soldiers to India.']));
    expect(r.source).toBe('template');
    expect(r.text).toBe(templateCommentary(facts()));
    expect(shown.at(-1)).toEqual([templateCommentary(facts()), false]);
  });
  it('falls back on HTTP errors, network errors and when no LLM is configured', async () => {
    const t = templateCommentary(facts());
    expect((await streamCommentary(facts(), settings, () => {}, undefined, (async () => new Response('no', { status: 429 })) as unknown as typeof fetch)).text).toBe(t);
    expect((await streamCommentary(facts(), settings, () => {}, undefined, (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).text).toBe(t);
    expect((await streamCommentary(facts(), null, () => {})).source).toBe('template');
  });
});

// ------- advisor --------------------------------------------------------------------------
const cand = (i: number, to: string, win: number, loss: number): AttackCandidate => ({
  index: i, from: 'BRA', fromName: 'Brazil', to: to.slice(0, 3).toUpperCase(), toName: to, defenderId: 'X', defenderName: to,
  attackerSoldiers: 12, defenderSoldiers: 4 + i, winProbability: win, expectedLosses: loss, value: 14.2, eliminatesDefender: i === 1,
});
const cands = [cand(0, 'India', 0.78, 3.4), cand(1, 'Chile', 0.9, 2.1), cand(2, 'Kenya', 0.6, 5)];

describe('parseAdvisorReply', () => {
  it('accepts a faithful JSON reply, even inside a code fence', () => {
    const r = parseAdvisorReply('```json\n{"choice":1,"reason":"Chile is a 90% win and wipes out a rival, costing about 2 soldiers."}\n```', cands);
    expect(r).toEqual({ index: 1, reason: 'Chile is a 90% win and wipes out a rival, costing about 2 soldiers.' });
  });
  it('rejects bad indexes, junk, invented numbers and unrelated countries', () => {
    expect(parseAdvisorReply('{"choice":5,"reason":"Chile looks best overall."}', cands)).toBeNull();
    expect(parseAdvisorReply('{"choice":"x","reason":"Chile looks best overall."}', cands)).toBeNull();
    expect(parseAdvisorReply('not json', cands)).toBeNull();
    expect(parseAdvisorReply('{"choice":1,"reason":"Chile is a 99% win, so go."}', cands)).toBeNull();
    expect(parseAdvisorReply('{"choice":1,"reason":"Attack Chile because Peru is weak and Kenya is strong."}', cands)).toBeNull();
    expect(parseAdvisorReply('{"choice":0,"reason":"ok"}', cands)).toBeNull();
  });
  it('shows the model only facts: the prompt contains no action it could invent', () => {
    const p = JSON.parse(advisorUserPrompt(cands)) as Array<Record<string, unknown>>;
    expect(p).toHaveLength(3);
    expect(Object.keys(p[0]!)).toEqual(['index', 'attack', 'defender', 'yourSoldiers', 'theirSoldiers', 'winChancePercent', 'expectedSoldiersLost', 'eliminatesDefender']);
  });
});

describe('validateExplanation', () => {
  const f = { player: 'Brazil', kind: 'attack', heuristicReason: 'Attacking India from Brazil (12 vs 4): 78% to win, expect to lose ~3.4 soldiers.', metrics: { winProbability: 0.78, expectedLosses: 3.4 }, round: 5 };
  it('accepts numbers from the engine and rejects invented ones', () => {
    expect(validateExplanation('Brazil sees a 78% chance against India and will accept about 3 soldiers lost in return for the prize.', f)).toBe(true);
    expect(validateExplanation('Brazil sees a 95% chance against India and will accept the losses for the prize.', f)).toBe(false);
  });
});
