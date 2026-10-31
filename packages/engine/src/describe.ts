import type { GameEvent } from './types';

/** Resolves a country code / player id to a display name. */
export type NameLookup = (code: string) => string;

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/**
 * Plain, strictly factual one-line description of an event (or null if it has none).
 * Used for the live log and as the guaranteed-accurate fallback for AI commentary.
 */
export function describeEvent(e: GameEvent, name: NameLookup): string | null {
  switch (e.type) {
    case 'turnStarted':
      return `Round ${e.round}: ${name(e.playerId)}'s turn.`;
    case 'reinforcementsGranted':
      return `${name(e.playerId)} receives ${plural(e.amount, 'reinforcement', 'reinforcements')} for ${plural(e.territoriesHeld, 'country', 'countries')}.`;
    case 'reinforcementsAllocated': {
      const parts = Object.entries(e.allocations).map(([code, n]) => `+${n} ${name(code)}`);
      return `${name(e.playerId)} places soldiers: ${parts.join(', ')}.`;
    }
    case 'transferred':
      return `${name(e.playerId)} moves ${plural(e.count, 'soldier', 'soldiers')} from ${name(e.from)} to ${name(e.to)}.`;
    case 'attackStarted':
      return `${name(e.playerId)} attacks ${name(e.to)} from ${name(e.from)} (${e.attackerSoldiers} vs ${e.defenderSoldiers}).`;
    case 'battleRound': {
      const dice = e.pairs.map((p) => `${p.attacker}v${p.defender}`).join(', ');
      return (
        `Battle round ${e.round} (${dice}): ${name(e.from)} loses ${e.attackerLosses}, ` +
        `${name(e.to)} loses ${e.defenderLosses}. Now ${e.attackerSoldiersAfter} vs ${e.defenderSoldiersAfter}.`
      );
    }
    case 'territoryConquered':
      return `${name(e.playerId)} conquers ${name(e.to)} from ${name(e.previousOwnerId)} and gains ${plural(e.gained, 'soldier', 'soldiers')}!`;
    case 'captureCompleted':
      return e.moved > 0 ? `${name(e.playerId)} reinforces ${name(e.to)} with ${plural(e.moved, 'soldier', 'soldiers')}.` : null;
    case 'attackFailed':
      return `${name(e.playerId)}'s attack on ${name(e.to)} fails: ${name(e.from)} is down to 1 soldier.`;
    case 'attackStopped':
      return `${name(e.playerId)} calls off the attack on ${name(e.to)}.`;
    case 'playerEliminated':
      return `${name(e.playerId)} is eliminated by ${name(e.byPlayerId)}!`;
    case 'gameWon':
      return `${name(e.playerId)} has conquered the world!`;
    case 'gameStarted':
    case 'turnEnded':
    case 'npcDecision':
      return null;
  }
}
