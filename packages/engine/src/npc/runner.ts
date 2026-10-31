import { applyAction, currentPlayer, type ApplyOptions } from '../engine';
import type { GameEvent, GameState, PlayerId } from '../types';
import { decideNpc, rankAttackPlans, type Decision, type DecisionHints } from './brain';
import { toCandidates, validateChoice, type Advisor } from './advisor';
import { BALANCED, type NpcProfile } from './profiles';

export interface RunOptions extends ApplyOptions {
  /** Which profile a given NPC plays with. Defaults to BALANCED for everyone. */
  profileFor?: (playerId: PlayerId) => NpcProfile;
  /** Replaces the default decision function (used for difficulty levels). */
  decide?: (state: GameState, profile: NpcProfile, hints?: DecisionHints) => Decision;
  /** Safety valve: maximum decisions in a single turn. */
  maxDecisionsPerTurn?: number;
}

export interface RunResult {
  state: GameState;
  events: GameEvent[];
}

/** Plays the whole current turn for an NPC. Every decision is emitted as an `npcDecision` event first. */
export function runNpcTurn(state: GameState, options: RunOptions = {}): RunResult {
  const profileFor = options.profileFor ?? (() => BALANCED);
  const decide = options.decide ?? decideNpc;
  const cap = options.maxDecisionsPerTurn ?? 600;
  const me = currentPlayer(state).id;
  const profile = profileFor(me);
  const events: GameEvent[] = [];
  let s = state;
  let steps = 0;

  while (s.phase !== 'finished' && currentPlayer(s).id === me) {
    if (++steps > cap) throw new Error(`NPC ${me} exceeded ${cap} decisions in one turn.`);
    const d = decide(s, profile);
    events.push({ type: 'npcDecision', playerId: me, kind: d.kind, reason: d.reason, metrics: d.metrics });
    const r = applyAction(s, d.action, options);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/** Runs NPC turns until it is the (living) human's turn or the game is over. */
export function advanceNpcs(state: GameState, options: RunOptions & { maxTurns?: number } = {}): RunResult {
  const maxTurns = options.maxTurns ?? 10_000;
  const events: GameEvent[] = [];
  let s = state;
  let turns = 0;
  while (s.phase !== 'finished') {
    const p = currentPlayer(s);
    if (p.isHuman && !p.eliminated) break;
    if (++turns > maxTurns) break;
    const r = runNpcTurn(s, options);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

// ---------------------------------------------------------------------------------------------
// Async variants: identical behaviour, plus an optional LLM "advisor" for chosen NPCs.
// ---------------------------------------------------------------------------------------------

export interface AsyncRunOptions extends RunOptions {
  advisor?: Advisor;
  /** Which NPCs consult the advisor (default: none). */
  advisorFor?: (playerId: PlayerId) => boolean;
  /** Give up on the advisor after this long and use the heuristic's own choice. */
  advisorTimeoutMs?: number;
  /** Called with the NPC's id while it waits for the advisor, then with null. */
  onThinking?: (playerId: PlayerId | null) => void;
  /** Checked between decisions; return true to abandon the run (the caller discards the result). */
  shouldAbort?: () => boolean;
}

export class RunAbortedError extends Error {
  constructor() {
    super('NPC run aborted');
    this.name = 'RunAbortedError';
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

export async function runNpcTurnAsync(state: GameState, options: AsyncRunOptions = {}): Promise<RunResult> {
  const profileFor = options.profileFor ?? (() => BALANCED);
  const decide = options.decide ?? decideNpc;
  const cap = options.maxDecisionsPerTurn ?? 600;
  const me = currentPlayer(state).id;
  const profile = profileFor(me);
  const useAdvisor = Boolean(options.advisor && options.advisorFor?.(me));
  const events: GameEvent[] = [];
  let s = state;
  let steps = 0;
  let consulted = false;
  let hints: DecisionHints | undefined;

  while (s.phase !== 'finished' && currentPlayer(s).id === me) {
    if (options.shouldAbort?.()) throw new RunAbortedError();
    if (++steps > cap) throw new Error(`NPC ${me} exceeded ${cap} decisions in one turn.`);

    if (useAdvisor && !consulted && s.phase === 'action' && !s.attackUsed) {
      consulted = true;
      const plans = rankAttackPlans(s, me, profile, 3);
      if (plans.length >= 2) {
        const candidates = toCandidates(s, plans);
        options.onThinking?.(me);
        const raw = await withTimeout(
          options.advisor!({ state: s, playerId: me, candidates }),
          options.advisorTimeoutMs ?? 6000,
        );
        options.onThinking?.(null);
        if (options.shouldAbort?.()) throw new RunAbortedError();
        const choice = validateChoice(raw, candidates);
        if (choice) {
          const picked = candidates[choice.index]!;
          hints = { target: picked.to };
          events.push({
            type: 'npcDecision',
            playerId: me,
            kind: 'attack',
            reason: choice.reason,
            source: 'llm',
            metrics: {
              winProbability: picked.winProbability,
              expectedLosses: picked.expectedLosses,
              utility: plans[choice.index]!.utility,
            },
          });
        }
      }
    }

    const d = decide(s, profile, hints);
    events.push({ type: 'npcDecision', playerId: me, kind: d.kind, reason: d.reason, metrics: d.metrics });
    const r = applyAction(s, d.action, options);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

export async function advanceNpcsAsync(
  state: GameState,
  options: AsyncRunOptions & { maxTurns?: number } = {},
): Promise<RunResult> {
  const maxTurns = options.maxTurns ?? 10_000;
  const events: GameEvent[] = [];
  let s = state;
  let turns = 0;
  while (s.phase !== 'finished') {
    const p = currentPlayer(s);
    if (p.isHuman && !p.eliminated) break;
    if (++turns > maxTurns) break;
    const r = await runNpcTurnAsync(s, options);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
