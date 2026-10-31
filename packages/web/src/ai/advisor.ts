import { COUNTRIES } from '@conquest/data';
import type { Advisor, AdvisorChoice, AttackCandidate, NpcMetrics } from '@conquest/engine';
import type { LlmSettings } from '../config';
import { extractJson, foreignCountry, onlyAllowedNumbers } from './facts';

const ALL_COUNTRY_NAMES = COUNTRIES.map((c) => c.name);
import { chatComplete } from './llm';

const pct = (p: number): number => Math.round(p * 100);
const one = (n: number): number => Math.round(n * 10) / 10;

export const ADVISOR_SYSTEM_PROMPT = [
  'You are the strategist for one country in a turn-based world-domination board game.',
  'You are given 2 or 3 attack options that the game engine has already verified as legal. Pick the best one for winning the game.',
  'Reply with ONLY a JSON object: {"choice": <index>, "reason": "<one or two sentences, at most 40 words>"}.',
  'STRICT RULES:',
  '- "choice" must be one of the given indexes.',
  '- In "reason", only use numbers that appear in the options, and only name countries that appear in the options.',
  '- Give a strategic reason (odds, expected losses, eliminating a rival, weakening the leader). No markdown.',
].join('\n');

/** The numbers a reason about these candidates may mention. */
export function candidateNumbers(candidates: readonly AttackCandidate[]): Set<number> {
  const s = new Set<number>();
  for (const c of candidates) {
    s.add(c.index);
    s.add(c.index + 1);
    s.add(pct(c.winProbability));
    s.add(one(c.expectedLosses));
    s.add(Math.round(c.expectedLosses));
    s.add(c.attackerSoldiers);
    s.add(c.defenderSoldiers);
    s.add(Math.round(c.value));
    s.add(one(c.value));
  }
  return s;
}

export function advisorUserPrompt(candidates: readonly AttackCandidate[]): string {
  return JSON.stringify(
    candidates.map((c) => ({
      index: c.index,
      attack: `${c.fromName} -> ${c.toName}`,
      defender: c.defenderName,
      yourSoldiers: c.attackerSoldiers,
      theirSoldiers: c.defenderSoldiers,
      winChancePercent: pct(c.winProbability),
      expectedSoldiersLost: one(c.expectedLosses),
      eliminatesDefender: c.eliminatesDefender,
    })),
  );
}

/** Validates a raw model reply against the candidates; returns a usable choice or null. */
export function parseAdvisorReply(raw: string, candidates: readonly AttackCandidate[]): AdvisorChoice | null {
  const parsed = extractJson<{ choice?: unknown; reason?: unknown }>(raw);
  if (!parsed) return null;
  const index = Number(parsed.choice);
  if (!Number.isInteger(index) || index < 0 || index >= candidates.length) return null;
  const reason = typeof parsed.reason === 'string' ? parsed.reason.trim().replace(/\s+/g, ' ') : '';
  if (reason.length < 10 || reason.length > 400) return null;
  if (/[`*#{}<>]/.test(reason)) return null;
  if (!onlyAllowedNumbers(reason, candidateNumbers(candidates))) return null;
  // It may only talk about countries that were actually on the table.
  const onTable = candidates.flatMap((c) => [c.fromName, c.toName, c.defenderName]);
  if (foreignCountry(reason, onTable, ALL_COUNTRY_NAMES)) return null;
  return { index, reason };
}

/** An advisor backed by an LLM. It can only return an index into the engine's list, plus a checked explanation. */
export function createLlmAdvisor(settings: LlmSettings, fetchImpl: typeof fetch = fetch): Advisor {
  return async ({ candidates }) => {
    const raw = await chatComplete(
      settings,
      {
        messages: [
          { role: 'system', content: ADVISOR_SYSTEM_PROMPT },
          { role: 'user', content: advisorUserPrompt(candidates) },
        ],
        maxTokens: 160,
        temperature: 0.3,
        timeoutMs: 6000,
      },
      fetchImpl,
    );
    return parseAdvisorReply(raw, candidates);
  };
}

// ---------------------------------------------------------------------------------------------
// "Explain this decision": an on-demand, longer reasoning paragraph for any NPC decision
// ---------------------------------------------------------------------------------------------

export interface DecisionFacts {
  player: string;
  kind: string;
  heuristicReason: string;
  metrics?: NpcMetrics;
  round: number;
}

export const EXPLAIN_SYSTEM_PROMPT = [
  'You explain, in plain language, why a computer-controlled country made a move in a world-domination board game.',
  'You are given the move, the engine\'s own justification and its numbers. Write ONE short paragraph (at most 70 words).',
  'STRICT RULES: use only the facts provided; never invent numbers or countries; do not change or second-guess the move; no markdown.',
].join('\n');

export function explainAllowedNumbers(f: DecisionFacts): Set<number> {
  const s = new Set<number>([f.round]);
  if (f.metrics?.winProbability != null) s.add(pct(f.metrics.winProbability));
  if (f.metrics?.expectedLosses != null) {
    s.add(one(f.metrics.expectedLosses));
    s.add(Math.round(f.metrics.expectedLosses));
  }
  // numbers already in the heuristic's sentence are fair game
  for (const m of f.heuristicReason.matchAll(/\d+(?:\.\d+)?/g)) s.add(Number(m[0]));
  return s;
}

export function validateExplanation(text: string, f: DecisionFacts): boolean {
  const t = text.trim();
  if (t.length < 20 || t.length > 600) return false;
  if (/[`*#{}<>]/.test(t)) return false;
  return onlyAllowedNumbers(t, explainAllowedNumbers(f));
}

/** Returns the model's paragraph if it passes validation, otherwise null (the caller keeps the engine's own reason). */
export async function explainDecision(settings: LlmSettings, f: DecisionFacts, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const text = await chatComplete(
      settings,
      {
        messages: [
          { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(f) },
        ],
        maxTokens: 160,
        temperature: 0.4,
        signal,
        timeoutMs: 10_000,
      },
      fetchImpl,
    );
    return validateExplanation(text, f) ? text.trim() : null;
  } catch {
    return null;
  }
}
