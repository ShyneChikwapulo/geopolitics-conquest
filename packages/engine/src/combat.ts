import type { DiceRoller } from './rng';
import type { DicePair } from './types';

export interface RoundResolution {
  pairs: DicePair[];
  attackerLosses: number;
  defenderLosses: number;
}

/** Dice rolled by EACH side: limited by (attacker - 1) and by the defender's soldiers. */
export function diceCount(attackerSoldiers: number, defenderSoldiers: number): number {
  return Math.max(0, Math.min(attackerSoldiers - 1, defenderSoldiers));
}

/** Die i fights die i. Higher wins, the lower die's soldier dies, a tie kills nobody. */
export function resolvePairs(
  attackerDice: readonly number[],
  defenderDice: readonly number[],
): RoundResolution {
  if (attackerDice.length !== defenderDice.length) {
    throw new Error('Attacker and defender must roll the same number of dice.');
  }
  const pairs: DicePair[] = [];
  let attackerLosses = 0;
  let defenderLosses = 0;
  for (let i = 0; i < attackerDice.length; i++) {
    const attacker = attackerDice[i] as number;
    const defender = defenderDice[i] as number;
    if (attacker > defender) {
      defenderLosses++;
      pairs.push({ attacker, defender, result: 'attacker' });
    } else if (defender > attacker) {
      attackerLosses++;
      pairs.push({ attacker, defender, result: 'defender' });
    } else {
      pairs.push({ attacker, defender, result: 'tie' });
    }
  }
  return { pairs, attackerLosses, defenderLosses };
}

/** Rolls all attacker dice first, then all defender dice. */
export function rollRound(
  roller: DiceRoller,
  attackerSoldiers: number,
  defenderSoldiers: number,
): RoundResolution {
  const n = diceCount(attackerSoldiers, defenderSoldiers);
  if (n < 1) throw new Error('Not enough soldiers to fight.');
  const attackerDice = Array.from({ length: n }, () => roller.die());
  const defenderDice = Array.from({ length: n }, () => roller.die());
  return resolvePairs(attackerDice, defenderDice);
}