import { currentPlayer, territoriesOf } from '../engine';
import type { Decision } from '../npc/brain';
import { decideNpc } from '../npc/brain';
import type { NpcProfile } from '../npc/profiles';
import { Rng } from '../rng';
import type { GameState, Territory } from '../types';

export type Policy = (state: GameState) => Decision;

export function npcPolicy(profile: NpcProfile): Policy {
  return (state) => decideNpc(state, profile);
}

/** A legal-but-clueless opponent, used as a baseline to prove the NPC "plays to win". */
export function randomPolicy(seed: number): Policy {
  const rng = new Rng(seed);
  const pick = <T>(items: T[]): T => items[rng.int(0, items.length - 1)] as T;

  return (state) => {
    const me = currentPlayer(state).id;
    const mine = territoriesOf(state, me);

    switch (state.phase) {
      case 'reinforce': {
        const alloc: Record<string, number> = {};
        for (let i = 0; i < state.reinforcementsPending; i++) {
          const t = pick(mine);
          alloc[t.code] = (alloc[t.code] ?? 0) + 1;
        }
        return { kind: 'allocate', action: { type: 'allocate', playerId: me, allocations: alloc }, reason: 'random' };
      }
      case 'action': {
        const attackers = mine.filter((t) => t.soldiers >= 2);
        const enemies = Object.values(state.territories).filter((t) => t.ownerId !== me);
        if (!state.attackUsed && attackers.length > 0 && enemies.length > 0 && rng.next() < 0.6) {
          return {
            kind: 'attack',
            action: { type: 'startAttack', playerId: me, from: pick(attackers).code, to: pick(enemies).code },
            reason: 'random',
          };
        }
        if (attackers.length > 0 && mine.length > 1 && rng.next() < 0.25) {
          const from = pick(attackers);
          const to = pick(mine.filter((t) => t.code !== from.code));
          return {
            kind: 'transfer',
            action: { type: 'transfer', playerId: me, from: from.code, to: to.code, count: rng.int(1, from.soldiers - 1) },
            reason: 'random',
          };
        }
        return { kind: 'endTurn', action: { type: 'endTurn', playerId: me }, reason: 'random' };
      }
      case 'attacking':
        return rng.next() < 0.8
          ? { kind: 'continue', action: { type: 'roll', playerId: me }, reason: 'random' }
          : { kind: 'stop', action: { type: 'stopAttack', playerId: me }, reason: 'random' };
      case 'capture': {
        const cap = state.capture as NonNullable<GameState['capture']>;
        const from = state.territories[cap.from] as Territory;
        return {
          kind: 'capture',
          action: { type: 'completeCapture', playerId: me, move: rng.int(0, from.soldiers - 1) },
          reason: 'random',
        };
      }
      default:
        throw new Error('The game is over.');
    }
  };
}