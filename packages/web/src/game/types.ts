import type { Difficulty, GameEvent, GameState } from '@conquest/engine';

export type GameStatus = 'active' | 'finished';

/** Everything chosen when a game starts. */
export interface GameSetup {
  humanCode: string;
  difficulty: Difficulty;
  seed: number;
  /** The one NPC (if any) whose attack choices are made by the LLM advisor. */
  strategistId: string | null;
}

export interface GameStats {
  battles: number;
  conquests: number;
}

/** The small summary used by History and Analytics (filled in when a game finishes). */
export interface GameSummary {
  rounds: number;
  winnerId: string | null;
  humanWon: boolean;
  humanEliminated: boolean;
  humanSeat: number;
  winnerSeat: number | null;
  battles: number;
  conquests: number;
}

export interface GameRecord extends GameSetup {
  id: string;
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
  status: GameStatus;
  round: number;
  /** Mirrors state.version; strictly increases with every committed change. */
  version: number;
  /** Number of event batches written so far (also the next batch's sequence number). */
  batches: number;
  winnerId: string | null;
  stats: GameStats;
  /** The board as it was at the very start (replays begin here). */
  initial: GameState;
  /** The board right now (resuming continues from here). */
  state: GameState;
  summary?: GameSummary;
}

/** A run of events, stored as one append-only document. */
export interface Batch {
  seq: number;
  at: number;
  events: GameEvent[];
}

export type GameRow = Omit<GameRecord, 'initial' | 'state'>;

export function toRow(r: GameRecord): GameRow {
  const { initial: _initial, state: _state, ...row } = r;
  return row;
}
