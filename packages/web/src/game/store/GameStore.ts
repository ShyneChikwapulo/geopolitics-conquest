import type { GameEvent, GameState } from '@conquest/engine';
import type { Batch, GameRecord, GameRow, GameSetup, GameSummary } from '../types';

export interface WatchHandlers {
  /** Called whenever the game document changes (and once with its first value). */
  onGame: (record: GameRecord) => void;
  /** Called with every batch exactly once, in sequence order (existing batches first). */
  onBatches: (batches: Batch[]) => void;
  onError?: (error: Error) => void;
}

export interface GameStore {
  readonly kind: 'firestore' | 'local';
  /** Creates the game and its first batch atomically. */
  createGame(setup: GameSetup, initial: GameState, firstEvents: GameEvent[]): Promise<GameRecord>;
  /** Atomically appends events and updates the snapshot. Rejects if the game changed elsewhere. */
  commit(record: GameRecord, state: GameState, events: GameEvent[]): Promise<GameRecord>;
  loadGame(id: string): Promise<GameRecord | null>;
  loadBatches(id: string): Promise<Batch[]>;
  /** The signed-in user's games, newest first. */
  listMine(): Promise<GameRow[]>;
  /** Recently finished games from everyone (public), for platform-wide analytics. */
  listFinished(max: number): Promise<GameRow[]>;
  watch(id: string, handlers: WatchHandlers): () => void;
  deleteGame(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Helpers shared by every store implementation
// ---------------------------------------------------------------------------------------------

/** Event batches are written in documents of at most this many events (Firestore documents max out at 1 MiB). */
export const MAX_EVENTS_PER_BATCH = 250;

/** Zero-padded so document ids sort in sequence order. */
export const padSeq = (n: number): string => String(n).padStart(8, '0');

/** Strips `undefined` (which Firestore rejects) and detaches the value from the live game objects. */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function chunkEvents(events: readonly GameEvent[], size = MAX_EVENTS_PER_BATCH): GameEvent[][] {
  if (events.length === 0) return [];
  const out: GameEvent[][] = [];
  for (let i = 0; i < events.length; i += size) out.push(events.slice(i, i + size) as GameEvent[]);
  return out;
}

export function countStats(events: readonly GameEvent[]): { battles: number; conquests: number } {
  let battles = 0;
  let conquests = 0;
  for (const e of events) {
    if (e.type === 'battleRound') battles++;
    else if (e.type === 'territoryConquered') conquests++;
  }
  return { battles, conquests };
}

export function summarize(initial: GameState, state: GameState, stats: { battles: number; conquests: number }): GameSummary {
  const human = initial.players.find((p) => p.isHuman)!;
  const finalHuman = state.players.find((p) => p.id === human.id)!;
  return {
    rounds: state.round,
    winnerId: state.winnerId,
    humanWon: state.winnerId === human.id,
    humanEliminated: finalHuman.eliminated,
    humanSeat: initial.players.findIndex((p) => p.id === human.id),
    winnerSeat: state.winnerId ? initial.players.findIndex((p) => p.id === state.winnerId) : null,
    battles: stats.battles,
    conquests: stats.conquests,
  };
}

/** Builds the next version of a record after a commit (pure, shared by all stores). */
export function nextRecord(record: GameRecord, state: GameState, events: readonly GameEvent[], now: number): { record: GameRecord; chunks: GameEvent[][] } {
  const chunks = chunkEvents(events);
  const add = countStats(events);
  const stats = { battles: record.stats.battles + add.battles, conquests: record.stats.conquests + add.conquests };
  const finished = state.phase === 'finished';
  const next: GameRecord = {
    ...record,
    state: toPlain(state),
    version: state.version,
    round: state.round,
    status: finished ? 'finished' : 'active',
    winnerId: state.winnerId,
    batches: record.batches + chunks.length,
    stats,
    updatedAt: now,
  };
  if (finished) next.summary = summarize(record.initial, state, stats);
  return { record: next, chunks };
}

/** Light structural check so a malformed or legacy document never crashes the UI. */
export function parseRecord(data: unknown): GameRecord | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<GameRecord>;
  if (typeof d.id !== 'string' || typeof d.ownerUid !== 'string') return null;
  if (!d.initial || !d.state || !Array.isArray(d.state.players) || !d.state.territories) return null;
  if (typeof d.batches !== 'number' || typeof d.version !== 'number') return null;
  return d as GameRecord;
}

export function newGameId(): string {
  return crypto.randomUUID();
}
