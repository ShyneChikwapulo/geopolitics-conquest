import type { Firestore } from 'firebase/firestore';
import type * as FirestoreModule from 'firebase/firestore';
import type { GameEvent, GameState } from '@conquest/engine';
import type { Batch, GameRecord, GameRow, GameSetup } from '../types';
import { toRow } from '../types';
import { chunkEvents, countStats, newGameId, nextRecord, padSeq, parseRecord, toPlain, type GameStore, type WatchHandlers } from './GameStore';

type Fs = typeof FirestoreModule;

/**
 * The Firestore-backed store.
 *
 * Data model
 *   games/{gameId}                  the record: setup, snapshot (`state`), `initial`, counters, summary
 *   games/{gameId}/events/{seq}     append-only batches of GameEvents (zero-padded seq as document id)
 *
 * Every commit is ONE atomic write batch (snapshot update + new event documents), so a viewer can never
 * see a snapshot that is ahead of its events, and a crash mid-save cannot leave a half-written game.
 */
export function createFirestoreStore(db: Firestore, fs: Fs, uid: string, now: () => number = Date.now): GameStore {
  const gameRef = (id: string) => fs.doc(db, 'games', id);
  const eventRef = (id: string, seq: number) => fs.doc(db, 'games', id, 'events', padSeq(seq));
  const eventsQuery = (id: string) => fs.query(fs.collection(db, 'games', id, 'events'), fs.orderBy('seq'));

  const store: GameStore = {
    kind: 'firestore',

    async createGame(setup: GameSetup, initial: GameState, firstEvents: GameEvent[]): Promise<GameRecord> {
      const id = newGameId();
      const t = now();
      const chunks = chunkEvents(firstEvents);
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
        stats: countStats(firstEvents),
        initial: toPlain(initial),
        state: toPlain(initial),
      };
      const batch = fs.writeBatch(db);
      batch.set(gameRef(id), toPlain(record));
      chunks.forEach((events, seq) => batch.set(eventRef(id, seq), { seq, at: t, events: toPlain(events) }));
      await batch.commit();
      return record;
    },

    async commit(record: GameRecord, state: GameState, events: GameEvent[]): Promise<GameRecord> {
      if (events.length === 0 && state.version === record.version) return record; // nothing changed
      const { record: next, chunks } = nextRecord(record, state, events, now());
      const batch = fs.writeBatch(db);
      const update: Record<string, unknown> = {
        state: next.state,
        version: next.version,
        round: next.round,
        status: next.status,
        winnerId: next.winnerId,
        batches: next.batches,
        stats: next.stats,
        updatedAt: next.updatedAt,
      };
      if (next.summary) update.summary = next.summary;
      batch.update(gameRef(record.id), toPlain(update));
      chunks.forEach((evs, i) => {
        const seq = record.batches + i;
        batch.set(eventRef(record.id, seq), { seq, at: next.updatedAt, events: toPlain(evs) });
      });
      await batch.commit();
      return next;
    },

    async loadGame(id: string): Promise<GameRecord | null> {
      const snap = await fs.getDoc(gameRef(id));
      return snap.exists() ? parseRecord(snap.data()) : null;
    },

    async loadBatches(id: string): Promise<Batch[]> {
      const snap = await fs.getDocs(eventsQuery(id));
      return snap.docs.map((d) => d.data() as Batch).sort((a, b) => a.seq - b.seq);
    },

    async listMine(): Promise<GameRow[]> {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'games'), fs.where('ownerUid', '==', uid), fs.limit(100)));
      return snap.docs
        .map((d) => parseRecord(d.data()))
        .filter((r): r is GameRecord => r !== null)
        .map(toRow)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async listFinished(max: number): Promise<GameRow[]> {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'games'), fs.where('status', '==', 'finished'), fs.limit(max)));
      return snap.docs
        .map((d) => parseRecord(d.data()))
        .filter((r): r is GameRecord => r !== null)
        .map(toRow);
    },

    watch(id: string, handlers: WatchHandlers): () => void {
      const delivered = new Set<number>();
      const unsubGame = fs.onSnapshot(
        gameRef(id),
        (snap) => {
          const rec = snap.exists() ? parseRecord(snap.data()) : null;
          if (rec) handlers.onGame(rec);
        },
        (err) => handlers.onError?.(err),
      );
      const unsubEvents = fs.onSnapshot(
        eventsQuery(id),
        (snap) => {
          const fresh = snap.docs
            .map((d) => d.data() as Batch)
            .filter((b) => !delivered.has(b.seq))
            .sort((a, b) => a.seq - b.seq);
          if (fresh.length === 0) return;
          fresh.forEach((b) => delivered.add(b.seq));
          handlers.onBatches(fresh);
        },
        (err) => handlers.onError?.(err),
      );
      return () => {
        unsubGame();
        unsubEvents();
      };
    },

    async deleteGame(id: string): Promise<void> {
      // Events first (their rules look up the parent game), then the game itself.
      const snap = await fs.getDocs(fs.collection(db, 'games', id, 'events'));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = fs.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await fs.deleteDoc(gameRef(id));
    },
  };
  return store;
}
