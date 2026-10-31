import type { GameEvent, GameState } from '@conquest/engine';
import type { Batch, GameRecord, GameRow, GameSetup } from '../types';
import { toRow } from '../types';
import {
  countStats,
  newGameId,
  nextRecord,
  parseRecord,
  toPlain,
  type GameStore,
  type WatchHandlers,
  chunkEvents,
} from './GameStore';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const NS = 'cq:v3';
const MAX_LOCAL_GAMES = 12;

/** A GameStore backed by localStorage. Used for local development and as the offline fallback. */
export function createLocalStore(storage: StorageLike, uid: string, now: () => number = Date.now): GameStore {
  const indexKey = `${NS}:index:${uid}`;
  const gameKey = (id: string) => `${NS}:game:${id}`;
  const batchKey = (id: string) => `${NS}:batches:${id}`;

  const readIndex = (): string[] => {
    try {
      return JSON.parse(storage.getItem(indexKey) ?? '[]') as string[];
    } catch {
      return [];
    }
  };
  const writeIndex = (ids: string[]) => storage.setItem(indexKey, JSON.stringify(ids));
  const read = <T,>(key: string): T | null => {
    const raw = storage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  /** Writes, and if the browser's quota is exhausted drops the oldest game and retries once. */
  const safeSet = (key: string, value: unknown): void => {
    const text = JSON.stringify(value);
    try {
      storage.setItem(key, text);
    } catch {
      const ids = readIndex();
      const oldest = ids[ids.length - 1];
      if (oldest && ids.length > 1) {
        storage.removeItem(gameKey(oldest));
        storage.removeItem(batchKey(oldest));
        writeIndex(ids.slice(0, -1));
        storage.setItem(key, text);
      } else {
        throw new Error('Browser storage is full.');
      }
    }
  };

  const store: GameStore = {
    kind: 'local',

    async createGame(setup: GameSetup, initial: GameState, firstEvents: GameEvent[]): Promise<GameRecord> {
      const id = newGameId();
      const t = now();
      const chunks = chunkEvents(firstEvents);
      const stats = countStats(firstEvents);
      const record: GameRecord = {
        ...setup,
        id,
        ownerUid: uid,
        createdAt: t,
        updatedAt: t,
        status: 'active',
        round: initial.round,
        version: initial.version,
        batches: chunks.length,
        winnerId: null,
        stats,
        initial: toPlain(initial),
        state: toPlain(initial),
      };
      const batches: Batch[] = chunks.map((events, seq) => ({ seq, at: t, events: toPlain(events) }));
      const ids = [id, ...readIndex().filter((x) => x !== id)];
      // Trim the oldest games so the browser's quota is never the reason a new game fails.
      while (ids.length > MAX_LOCAL_GAMES) {
        const drop = ids.pop()!;
        storage.removeItem(gameKey(drop));
        storage.removeItem(batchKey(drop));
      }
      safeSet(gameKey(id), record);
      safeSet(batchKey(id), batches);
      writeIndex(ids);
      return record;
    },

    async commit(record: GameRecord, state: GameState, events: GameEvent[]): Promise<GameRecord> {
      if (events.length === 0 && state.version === record.version) return record; // nothing changed
      const stored = read<GameRecord>(gameKey(record.id));
      if (!stored || stored.ownerUid !== uid) throw new Error('This game no longer exists.');
      if (stored.batches !== record.batches || stored.version !== record.version) {
        throw new Error('This game was changed in another tab. Reload to continue.');
      }
      const { record: next, chunks } = nextRecord(record, state, events, now());
      const batches = read<Batch[]>(batchKey(record.id)) ?? [];
      chunks.forEach((evs, i) => batches.push({ seq: record.batches + i, at: next.updatedAt, events: toPlain(evs) }));
      safeSet(batchKey(record.id), batches);
      safeSet(gameKey(record.id), next);
      return next;
    },

    async loadGame(id: string): Promise<GameRecord | null> {
      return parseRecord(read(gameKey(id)));
    },

    async loadBatches(id: string): Promise<Batch[]> {
      return (read<Batch[]>(batchKey(id)) ?? []).sort((a, b) => a.seq - b.seq);
    },

    async listMine(): Promise<GameRow[]> {
      return readIndex()
        .map((id) => parseRecord(read(gameKey(id))))
        .filter((r): r is GameRecord => r !== null && r.ownerUid === uid)
        .map(toRow)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async listFinished(max: number): Promise<GameRow[]> {
      return (await store.listMine()).filter((r) => r.status === 'finished').slice(0, max);
    },

    watch(id: string, handlers: WatchHandlers): () => void {
      let seen = 0;
      let lastUpdated = -1;
      let stopped = false;
      const tick = () => {
        if (stopped) return;
        const rec = parseRecord(read(gameKey(id)));
        if (rec && rec.updatedAt !== lastUpdated) {
          lastUpdated = rec.updatedAt;
          handlers.onGame(rec);
        }
        const batches = (read<Batch[]>(batchKey(id)) ?? []).sort((a, b) => a.seq - b.seq);
        if (batches.length > seen) {
          const fresh = batches.slice(seen);
          seen = batches.length;
          handlers.onBatches(fresh);
        }
      };
      tick();
      const timer = setInterval(tick, 700);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    },

    async deleteGame(id: string): Promise<void> {
      storage.removeItem(gameKey(id));
      storage.removeItem(batchKey(id));
      writeIndex(readIndex().filter((x) => x !== id));
    },
  };
  return store;
}
