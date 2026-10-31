import type { CountryCode, GameState, PlayerId } from '../types';
import { territoriesOf } from '../engine';
import type { AttackPlan } from './brain';

/** One legal, heuristic-vetted way for an NPC to spend its attack this turn. */
export interface AttackCandidate {
  index: number;
  from: CountryCode;
  fromName: string;
  to: CountryCode;
  toName: string;
  defenderId: PlayerId;
  defenderName: string;
  /** Soldiers that would be on the attacking country after any massing transfers. */
  attackerSoldiers: number;
  defenderSoldiers: number;
  winProbability: number;
  expectedLosses: number;
  /** Heuristic value of the capture, in soldier-equivalents. */
  value: number;
  /** True if capturing it wipes the defender out of the game. */
  eliminatesDefender: boolean;
}

export interface AdvisorChoice {
  index: number;
  reason: string;
}

export interface AdvisorContext {
  state: GameState;
  playerId: PlayerId;
  candidates: AttackCandidate[];
}

/**
 * An advisor picks ONE of the engine-vetted candidates and explains why. It can never invent an action:
 * the only thing it returns is an index into a list the engine built, and the engine still validates the
 * resulting action before it is applied.
 */
export type Advisor = (ctx: AdvisorContext) => Promise<AdvisorChoice | null>;

export function toCandidates(state: GameState, plans: readonly AttackPlan[]): AttackCandidate[] {
  return plans.map((p, index) => ({
    index,
    from: p.from.code,
    fromName: p.from.name,
    to: p.to.code,
    toName: p.to.name,
    defenderId: p.to.ownerId,
    defenderName: state.players.find((x) => x.id === p.to.ownerId)?.name ?? p.to.ownerId,
    attackerSoldiers: p.force,
    defenderSoldiers: p.to.soldiers,
    winProbability: p.winProbability,
    expectedLosses: p.expectedLosses,
    value: p.value,
    eliminatesDefender: territoriesOf(state, p.to.ownerId).length === 1,
  }));
}

/** Accepts a choice only if it is a valid index with a usable explanation; anything else is discarded. */
export function validateChoice(choice: AdvisorChoice | null | undefined, candidates: readonly AttackCandidate[]): AdvisorChoice | null {
  if (!choice) return null;
  if (!Number.isInteger(choice.index) || choice.index < 0 || choice.index >= candidates.length) return null;
  const reason = typeof choice.reason === 'string' ? choice.reason.trim().replace(/\s+/g, ' ') : '';
  if (reason.length < 5) return null;
  return { index: choice.index, reason: reason.slice(0, 400) };
}
