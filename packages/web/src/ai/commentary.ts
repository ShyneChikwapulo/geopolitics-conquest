import { COUNTRIES } from '@conquest/data';
import type { GameEvent } from '@conquest/engine';
import type { LlmSettings } from '../config';
import { foreignCountry, mentions, onlyAllowedNumbers } from './facts';

const ALL_COUNTRY_NAMES = COUNTRIES.map((c) => c.name);
import { chatStream } from './llm';

type BattleRound = Extract<GameEvent, { type: 'battleRound' }>;

/** Everything the commentator is allowed to know about a battle round. */
export interface BattleFacts {
  /** Which round of THIS attack (1, 2, 3...). Not the game round. */
  battleRound: number;
  attacker: string;
  defender: string;
  attackerCountry: string;
  defenderCountry: string;
  pairs: Array<{ attacker: number; defender: number; winner: 'attacker' | 'defender' | 'tie' }>;
  attackerLosses: number;
  defenderLosses: number;
  attackerSoldiersAfter: number;
  defenderSoldiersAfter: number;
  /** What this round led to. */
  outcome: 'ongoing' | 'conquered' | 'attackFailed';
}

export function battleFacts(
  e: BattleRound,
  names: { attackerCountry: string; defenderCountry: string; attacker: string; defender: string },
): BattleFacts {
  const outcome = e.defenderSoldiersAfter === 0 ? 'conquered' : e.attackerSoldiersAfter < 2 ? 'attackFailed' : 'ongoing';
  return {
    battleRound: e.round,
    attacker: names.attacker,
    defender: names.defender,
    attackerCountry: names.attackerCountry,
    defenderCountry: names.defenderCountry,
    pairs: e.pairs.map((p) => ({
      attacker: p.attacker,
      defender: p.defender,
      winner: p.result,
    })),
    attackerLosses: e.attackerLosses,
    defenderLosses: e.defenderLosses,
    attackerSoldiersAfter: e.attackerSoldiersAfter,
    defenderSoldiersAfter: e.defenderSoldiersAfter,
    outcome,
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The guaranteed-accurate sentence used whenever the LLM is unavailable, too slow, or gets a fact wrong. */
export function templateCommentary(f: BattleFacts): string {
  const dice = f.pairs.map((p) => `${p.attacker}-${p.defender}`).join(', ');
  const losses =
    f.attackerLosses === 0 && f.defenderLosses === 0
      ? 'Nobody loses a soldier.'
      : `${f.attackerCountry} loses ${plural(f.attackerLosses, 'soldier', 'soldiers')} and ${f.defenderCountry} loses ${plural(f.defenderLosses, 'soldier', 'soldiers')}.`;
  const tail =
    f.outcome === 'conquered'
      ? `${f.defenderCountry} falls to ${f.attackerCountry}!`
      : f.outcome === 'attackFailed'
        ? `${f.attackerCountry} is down to its last soldier, so the assault stalls.`
        : `It stands at ${f.attackerSoldiersAfter} against ${f.defenderSoldiersAfter}.`;
  return `Battle round ${f.battleRound}: ${f.attackerCountry} against ${f.defenderCountry} (dice ${dice}). ${losses} ${tail}`;
}

export const COMMENTARY_SYSTEM_PROMPT = [
  'You are a lively sports-style war correspondent narrating one round of a dice battle between two countries in a board game.',
  '"battleRound" is the round number within this one attack (it is not the game round).',
  'Write 1 or 2 short sentences (at most 45 words) in the present tense.',
  'STRICT RULES:',
  '- Use ONLY the facts in the JSON. Never invent numbers, countries, or events.',
  '- Mention the attacking and the defending country by name.',
  '- Any number you write must appear in the JSON (dice values, losses, soldiers remaining, battleRound).',
  '- Only say a country is conquered/captured/falls if outcome is "conquered". If outcome is "attackFailed", say the attack stalls.',
  '- No emojis, no markdown, no quotation marks, no headings.',
].join('\n');

export function commentaryUserPrompt(f: BattleFacts): string {
  return JSON.stringify(f);
}

/** The numbers a correct description of this round may mention. */
export function allowedNumbers(f: BattleFacts): Set<number> {
  const s = new Set<number>([f.battleRound, f.attackerLosses, f.defenderLosses, f.attackerSoldiersAfter, f.defenderSoldiersAfter, f.pairs.length]);
  for (const p of f.pairs) {
    s.add(p.attacker);
    s.add(p.defender);
  }
  return s;
}

const CLAIMS_CONQUEST = /\b(conquer(?:s|ed|ing)?|captur(?:e|es|ed|ing)|seiz(?:e|es|ed|ing)|overrun|overran|annex(?:es|ed)?|falls?|fell|crushed|wiped out|eliminat(?:e|es|ed))\b/i;
const NEGATION = /\b(not|never|no|fail(?:s|ed)?|unable|stall(?:s|ed)?|resist(?:s|ed|ing)?|hold(?:s|ing)?|held|survive[sd]?|repel(?:s|led)?|stops?|stopped|halts?|halted|prevent(?:s|ed)?|short of|before)\b/i;

/**
 * Accepts a model-written sentence only if it is consistent with the engine's facts:
 *  1. it is a sane length and has no markup;
 *  2. it names at least one of the two countries;
 *  3. every number in it appears in the facts;
 *  4. it does not drag in any other real country;
 *  5. it does not claim a conquest that did not happen.
 */
export function validateCommentary(text: string, f: BattleFacts): boolean {
  const t = text.trim();
  if (t.length < 12 || t.length > 420) return false;
  if (/[`*#\[\]{}<>]/.test(t)) return false;
  if (!mentions(t, f.attackerCountry) && !mentions(t, f.defenderCountry) && !mentions(t, f.attacker) && !mentions(t, f.defender)) return false;
  if (!onlyAllowedNumbers(t, allowedNumbers(f))) return false;
  if (foreignCountry(t, [f.attackerCountry, f.defenderCountry, f.attacker, f.defender], ALL_COUNTRY_NAMES)) return false;
  if (f.outcome !== 'conquered' && CLAIMS_CONQUEST.test(t) && !NEGATION.test(t)) return false;
  return true;
}

export interface CommentaryResult {
  text: string;
  source: 'llm' | 'template';
}

/**
 * Streams commentary from the LLM. The streamed text is shown as it arrives, then checked; if it fails the
 * check the factual template replaces it. Any error or timeout also falls back to the template.
 */
export async function streamCommentary(
  facts: BattleFacts,
  settings: LlmSettings | null,
  onText: (text: string, provisional: boolean) => void,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<CommentaryResult> {
  const fallback = templateCommentary(facts);
  if (!settings) {
    onText(fallback, false);
    return { text: fallback, source: 'template' };
  }
  try {
    const raw = await chatStream(
      settings,
      {
        messages: [
          { role: 'system', content: COMMENTARY_SYSTEM_PROMPT },
          { role: 'user', content: commentaryUserPrompt(facts) },
        ],
        maxTokens: 120,
        temperature: 0.7,
        signal,
      },
      (partial) => onText(partial, true),
      fetchImpl,
    );
    if (signal?.aborted) return { text: fallback, source: 'template' };
    const cleaned = raw.replace(/^["“”']+|["“”']+$/g, '').trim();
    if (validateCommentary(cleaned, facts)) {
      onText(cleaned, false);
      return { text: cleaned, source: 'llm' };
    }
  } catch {
    /* fall through to the template */
  }
  if (!signal?.aborted) onText(fallback, false);
  return { text: fallback, source: 'template' };
}
