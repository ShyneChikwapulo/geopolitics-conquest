import { currentPlayer, territoriesOf } from './engine';
import { decideNpc, type Decision, type DecisionHints } from './npc/brain';
import { BALANCED, DEFENSIVE, type NpcProfile } from './npc/profiles';
import { Rng } from './rng';
import type { GameState } from './types';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  blurb: string;
  /** Heuristic profile every NPC plays with. */
  profile: NpcProfile;
  /** Chance that an NPC acts on instinct instead of using its heuristic, per decision. */
  blunderRate: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    blurb: 'Rivals often act on instinct and make avoidable mistakes.',
    profile: BALANCED,
    blunderRate: 0.3,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    blurb: 'Rivals weigh the odds before every attack.',
    profile: BALANCED,
    blunderRate: 0,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    blurb: 'Rivals defend carefully and only attack when the odds are strongly in their favour.',
    profile: DEFENSIVE,
    blunderRate: 0,
  },
};

export function isDifficulty(x: unknown): x is Difficulty {
  return x === 'easy' || x === 'medium' || x === 'hard';
}

/** A deterministic RNG for blunders: depends only on the game seed and how far the game has progressed. */
function blunderRng(state: GameState): Rng {
  return new Rng((state.seed ^ Math.imul(state.version + 1, 0x9e3779b1)) >>> 0);
}

/** What an NPC does when it acts on instinct: legal, but without weighing the odds. */
export function sloppyDecision(state: GameState, rng: Rng): Decision {
  const me = currentPlayer(state).id;
  const mine = territoriesOf(state, me);
  const pick = <T>(items: T[]): T => items[rng.int(0, items.length - 1)] as T;

  switch (state.phase) {
    case 'reinforce': {
      const t = pick(mine);
      return {
        kind: 'allocate',
        action: { type: 'allocate', playerId: me, allocations: { [t.code]: state.reinforcementsPending } },
        reason: `Acting on instinct: all ${state.reinforcementsPending} reinforcements go to ${t.name} without a plan.`,
      };
    }
    case 'action': {
      const attackers = mine.filter((t) => t.soldiers >= 2);
      const targets = Object.values(state.territories).filter((t) => {
        if (t.ownerId === me) return false;
        const owner = state.players.find((p) => p.id === t.ownerId);
        return owner ? owner.hasTakenFirstTurn : false;
      });
      if (!state.attackUsed && attackers.length > 0 && targets.length > 0 && rng.next() < 0.6) {
        const from = pick(attackers);
        const to = pick(targets);
        return {
          kind: 'attack',
          action: { type: 'startAttack', playerId: me, from: from.code, to: to.code },
          reason: `Acting on instinct: attacking ${to.name} from ${from.name} without weighing the odds.`,
        };
      }
      return {
        kind: 'endTurn',
        action: { type: 'endTurn', playerId: me },
        reason: 'Acting on instinct: not sure what to do, so ending the turn.',
      };
    }
    case 'attacking': {
      const atk = state.attack!;
      const to = state.territories[atk.to]!;
      return rng.next() < 0.75
        ? { kind: 'continue', action: { type: 'roll', playerId: me }, reason: `Acting on instinct: pressing on against ${to.name}.` }
        : { kind: 'stop', action: { type: 'stopAttack', playerId: me }, reason: `Acting on instinct: losing nerve and calling off the attack on ${to.name}.` };
    }
    case 'capture': {
      const to = state.territories[state.capture!.to]!;
      return {
        kind: 'capture',
        action: { type: 'completeCapture', playerId: me, move: 0 },
        reason: `Acting on instinct: ${to.name} is taken, leaving it as it is.`,
      };
    }
    default:
      throw new Error('The game is over.');
  }
}

/** The decision function an NPC uses at a given difficulty. */
export function makeDecider(difficulty: Difficulty): (state: GameState, profile: NpcProfile, hints?: DecisionHints) => Decision {
  const { blunderRate } = DIFFICULTIES[difficulty];
  return (state, profile, hints) => {
    if (blunderRate > 0 && state.phase !== 'finished') {
      const rng = blunderRng(state);
      if (rng.next() < blunderRate) return sloppyDecision(state, rng);
    }
    return decideNpc(state, profile, hints);
  };
}
