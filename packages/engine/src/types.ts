export type PlayerId = string;
export type CountryCode = string;

export interface CountryDef {
  code: CountryCode; // ISO 3166-1 alpha-3
  name: string;
  population: number;
}

export interface Player {
  id: PlayerId; // equals the home country code
  name: string;
  homeCountry: CountryCode;
  isHuman: boolean;
  colorIndex: number;
  eliminated: boolean;
}

export interface Territory {
  code: CountryCode;
  name: string;
  ownerId: PlayerId;
  soldiers: number;
  /** Soldiers this country started with (population table). Used for the capture bonus. */
  baseValue: number;
}

export type Phase = 'reinforce' | 'action' | 'attacking' | 'capture' | 'finished';

export interface AttackInProgress {
  from: CountryCode;
  to: CountryCode;
  rounds: number;
}

export interface PendingCapture {
  from: CountryCode;
  to: CountryCode;
}

export interface GameState {
  id: string;
  seed: number;
  rngState: number;
  /** Players in turn order. */
  players: Player[];
  territories: Record<CountryCode, Territory>;
  currentPlayerIndex: number;
  round: number;
  phase: Phase;
  reinforcementsPending: number;
  attackUsed: boolean;
  attack: AttackInProgress | null;
  capture: PendingCapture | null;
  winnerId: PlayerId | null;
  /** Incremented on every applied action (optimistic concurrency). */
  version: number;
}

export type PairResult = 'attacker' | 'defender' | 'tie';

export interface DicePair {
  attacker: number;
  defender: number;
  result: PairResult;
}

export type Action =
  | { type: 'allocate'; playerId: PlayerId; allocations: Record<CountryCode, number> }
  | { type: 'transfer'; playerId: PlayerId; from: CountryCode; to: CountryCode; count: number }
  | { type: 'startAttack'; playerId: PlayerId; from: CountryCode; to: CountryCode }
  | { type: 'roll'; playerId: PlayerId }
  | { type: 'stopAttack'; playerId: PlayerId }
  | { type: 'completeCapture'; playerId: PlayerId; move: number }
  | { type: 'endTurn'; playerId: PlayerId };

/** Events are the single source of truth for the UI animations and the AI commentary. */
export type GameEvent =
  | { type: 'gameStarted'; gameId: string; humanPlayerId: PlayerId; turnOrder: PlayerId[] }
  | { type: 'turnStarted'; playerId: PlayerId; round: number }
  | { type: 'reinforcementsGranted'; playerId: PlayerId; amount: number; territoriesHeld: number }
  | { type: 'reinforcementsAllocated'; playerId: PlayerId; allocations: Record<CountryCode, number> }
  | {
      type: 'transferred';
      playerId: PlayerId;
      from: CountryCode;
      to: CountryCode;
      count: number;
      fromSoldiersAfter: number;
      toSoldiersAfter: number;
    }
  | {
      type: 'attackStarted';
      playerId: PlayerId;
      defenderId: PlayerId;
      from: CountryCode;
      to: CountryCode;
      attackerSoldiers: number;
      defenderSoldiers: number;
    }
  | {
      type: 'battleRound';
      playerId: PlayerId;
      from: CountryCode;
      to: CountryCode;
      round: number;
      pairs: DicePair[];
      attackerLosses: number;
      defenderLosses: number;
      attackerSoldiersAfter: number;
      defenderSoldiersAfter: number;
    }
  | {
      type: 'territoryConquered';
      playerId: PlayerId;
      previousOwnerId: PlayerId;
      from: CountryCode;
      to: CountryCode;
      gained: number;
      soldiersOnTerritory: number;
    }
  | {
      type: 'captureCompleted';
      playerId: PlayerId;
      from: CountryCode;
      to: CountryCode;
      moved: number;
      fromSoldiersAfter: number;
      toSoldiersAfter: number;
    }
  | { type: 'attackFailed'; playerId: PlayerId; from: CountryCode; to: CountryCode }
  | { type: 'attackStopped'; playerId: PlayerId; from: CountryCode; to: CountryCode }
  | { type: 'playerEliminated'; playerId: PlayerId; byPlayerId: PlayerId }
  | { type: 'turnEnded'; playerId: PlayerId }
  | { type: 'gameWon'; playerId: PlayerId };