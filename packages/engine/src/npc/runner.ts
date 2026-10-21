import { applyAction, currentPlayer, type ApplyOptions } from '../engine';
import type { GameEvent, GameState, PlayerId } from '../types';
import { decideNpc } from './brain';
import { BALANCED, type NpcProfile } from './profiles';

export interface RunOptions extends ApplyOptions {
  /** Which profile a given NPC plays with. Defaults to BALANCED for everyone. */
  profileFor?: (playerId: PlayerId) => NpcProfile;
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
  const cap = options.maxDecisionsPerTurn ?? 600;
  const me = currentPlayer(state).id;
  const profile = profileFor(me);
  const events: GameEvent[] = [];
  let s = state;
  let steps = 0;

  while (s.phase !== 'finished' && currentPlayer(s).id === me) {
    if (++steps > cap) throw new Error(`NPC ${me} exceeded ${cap} decisions in one turn.`);
    const d = decideNpc(s, profile);
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