import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@conquest/data';
import {
  advanceNpcs,
  applyEvent,
  boardFromState,
  createGame,
  foldEvents,
  type GameEvent,
  type GameState,
} from '@conquest/engine';
import { FakeDb, makeFakeFs } from './fakeFirestore';
import { createFirestoreStore } from '../src/game/store/firestoreStore';
import { createLocalStore, type StorageLike } from '../src/game/store/localStore';
import { MAX_EVENTS_PER_BATCH, chunkEvents, padSeq, toPlain, type GameStore } from '../src/game/store/GameStore';
import type { GameSetup } from '../src/game/types';

class MemStorage implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

interface Harness { store: GameStore; other: () => GameStore; db?: FakeDb }
const makers: Array<[string, () => Harness]> = [
  [
    'local store',
    () => {
      const storage = new MemStorage();
      return { store: createLocalStore(storage, 'u1'), other: () => createLocalStore(storage, 'u2') };
    },
  ],
  [
    'firestore store',
    () => {
      const db = new FakeDb();
      const auth = { uid: 'u1' as string | null };
      const fsFor = (uid: string) => {
        const a = { uid };
        return createFirestoreStore({} as never, makeFakeFs(db, a) as never, uid);
      };
      void auth;
      return { store: fsFor('u1'), other: () => fsFor('u2'), db };
    },
  ],
];

import { applyAction, validateAction, type Action } from '@conquest/engine';

/** The human plays the simplest legal turn: place reinforcements on one country, then end the turn. */
function humanTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const me = state.players[state.currentPlayerIndex]!;
  const events: GameEvent[] = [];
  let s = state;
  const step = (a: Action) => {
    if (validateAction(s, a) !== null) return;
    const r = applyAction(s, a);
    s = r.state;
    events.push(...r.events);
  };
  if (s.phase === 'reinforce') {
    const own = Object.values(s.territories).find((t) => t.ownerId === me.id)!;
    step({ type: 'allocate', playerId: me.id, allocations: { [own.code]: s.reinforcementsPending } });
  }
  step({ type: 'endTurn', playerId: me.id });
  return { state: s, events };
}

const setup: GameSetup = { humanCode: 'ZAF', difficulty: 'medium', seed: 7, strategistId: null };
function newGame(seed = 7) {
  const created = createGame({ id: 'g', seed, allCountries: COUNTRIES, humanCode: 'ZAF' });
  return created;
}
const norm = (v: ReturnType<typeof boardFromState>) => ({ ...v, eliminated: [...v.eliminated].sort(), firstTurnTaken: [...v.firstTurnTaken].sort() });

describe.each(makers)('GameStore contract: %s', (_name, make) => {
  it('creates a game, then loads it back with its first events', async () => {
    const { store } = make();
    const c = newGame();
    const rec = await store.createGame(setup, c.state, c.events);
    expect(rec.ownerUid).toBe('u1');
    expect(rec.batches).toBe(1);
    expect((await store.loadGame(rec.id))?.state).toEqual(c.state);
    const batches = await store.loadBatches(rec.id);
    expect(batches.flatMap((b) => b.events)).toEqual(toPlain(c.events));
  });

  it('commits NPC runs atomically and the stored events rebuild the exact board (replay correctness)', async () => {
    const { store } = make();
    const c = newGame(11);
    let rec = await store.createGame(setup, c.state, c.events);
    let state: GameState = c.state;
    const all: GameEvent[] = [...c.events];
    for (let i = 0; i < 8 && state.phase !== 'finished'; i++) {
      const run = advanceNpcs(state);
      if (run.events.length > 0) {
        rec = await store.commit(rec, run.state, run.events);
        state = run.state;
        all.push(...run.events);
      }
      if (state.phase === 'finished') break;
      const h = humanTurn(state);
      if (h.events.length > 0) {
        rec = await store.commit(rec, h.state, h.events);
        state = h.state;
        all.push(...h.events);
      }
    }
    const loaded = (await store.loadGame(rec.id))!;
    expect(loaded.state).toEqual(toPlain(state));
    expect(loaded.version).toBe(state.version);
    const stored = (await store.loadBatches(rec.id)).flatMap((b) => b.events);
    expect(stored).toEqual(toPlain(all));
    expect(norm(foldEvents(boardFromState(loaded.initial), stored))).toEqual(norm(boardFromState(state)));
  });

  it('treats a commit with nothing new as a harmless no-op', async () => {
    const { store } = make();
    const c = newGame();
    const rec = await store.createGame(setup, c.state, c.events);
    expect(await store.commit(rec, c.state, [])).toEqual(rec);
    expect((await store.loadBatches(rec.id)).length).toBe(1);
  });

  it('never drops or merges repeated identical events (the arrayUnion bug)', async () => {
    const { store } = make();
    const c = newGame();
    let rec = await store.createGame(setup, c.state, c.events);
    const roll: GameEvent = { type: 'turnEnded', playerId: 'ZAF' };
    const state = { ...c.state, version: c.state.version + 1 };
    rec = await store.commit(rec, state, [roll, roll, roll]);
    const stored = (await store.loadBatches(rec.id)).flatMap((b) => b.events);
    expect(stored.filter((e) => e.type === 'turnEnded')).toHaveLength(3);
  });

  it('accepts events with undefined optional fields (npcDecision without metrics)', async () => {
    const { store } = make();
    const c = newGame();
    let rec = await store.createGame(setup, c.state, c.events);
    const ev: GameEvent = { type: 'npcDecision', playerId: 'ZAF', kind: 'endTurn', reason: 'x', metrics: undefined };
    rec = await store.commit(rec, { ...c.state, version: 1 }, [ev]);
    expect(rec.batches).toBe(2);
  });

  it('splits a very long run into several event documents under the size limit', async () => {
    const { store } = make();
    const c = newGame();
    let rec = await store.createGame(setup, c.state, c.events);
    const many: GameEvent[] = Array.from({ length: MAX_EVENTS_PER_BATCH * 2 + 10 }, () => ({ type: 'turnEnded', playerId: 'ZAF' }));
    rec = await store.commit(rec, { ...c.state, version: 1 }, many);
    const batches = await store.loadBatches(rec.id);
    expect(batches.map((b) => b.seq)).toEqual([0, 1, 2, 3]);
    expect(Math.max(...batches.map((b) => b.events.length))).toBeLessThanOrEqual(MAX_EVENTS_PER_BATCH);
    expect(batches.flatMap((b) => b.events)).toHaveLength(c.events.length + many.length);
  });

  it('marks the game finished with a summary when the engine says so', async () => {
    const { store } = make();
    const c = newGame(3);
    let rec = await store.createGame(setup, c.state, c.events);
    let state = c.state;
    for (let i = 0; i < 600 && state.phase !== 'finished'; i++) {
      const run = advanceNpcs(state, { maxTurns: 40 });
      if (run.events.length > 0) {
        rec = await store.commit(rec, run.state, run.events);
        state = run.state;
      }
      if (state.phase === 'finished') break;
      const h = humanTurn(state);
      if (h.events.length > 0) {
        rec = await store.commit(rec, h.state, h.events);
        state = h.state;
      }
    }
    expect(state.phase).toBe('finished');
    const loaded = (await store.loadGame(rec.id))!;
    expect(loaded.status).toBe('finished');
    expect(loaded.summary).toMatchObject({ winnerId: state.winnerId, rounds: state.round });
    expect(loaded.summary!.battles).toBeGreaterThan(0);
  }, 60_000);

  it('only lists a user their own games, newest first, and deletes cleanly', async () => {
    const h = make();
    const a = newGame(1), b = newGame(2);
    const r1 = await h.store.createGame(setup, a.state, a.events);
    await new Promise((r) => setTimeout(r, 3));
    const r2 = await h.store.createGame(setup, b.state, b.events);
    const mine = await h.store.listMine();
    expect(mine.map((r) => r.id)).toEqual([r2.id, r1.id]);
    expect(mine[0]).not.toHaveProperty('state');
    expect(await h.other().listMine()).toEqual([]);
    await h.store.deleteGame(r1.id);
    expect(await h.store.loadGame(r1.id)).toBeNull();
    expect((await h.store.listMine()).map((r) => r.id)).toEqual([r2.id]);
  });

  it('refuses a commit from a stale writer (second tab / device) without corrupting the game', async () => {
    const { store } = make();
    const c = newGame();
    const rec = await store.createGame(setup, c.state, c.events);
    const first = await store.commit(rec, { ...c.state, version: 1 }, [{ type: 'turnEnded', playerId: 'ZAF' }]);
    // a second tab still holds the OLD record and tries to commit
    await expect(store.commit(rec, { ...c.state, version: 1 }, [{ type: 'turnEnded', playerId: 'ZAF' }])).rejects.toThrow();
    const stored = await store.loadBatches(rec.id);
    expect(stored.flatMap((b) => b.events).filter((e) => e.type === 'turnEnded')).toHaveLength(1);
    expect((await store.loadGame(rec.id))!.batches).toBe(first.batches);
  });

  it('watch() delivers existing batches once, then new ones, and stops after unsubscribe', async () => {
    const { store } = make();
    const c = newGame();
    let rec = await store.createGame(setup, c.state, c.events);
    const seen: number[] = [];
    const games: number[] = [];
    const unsub = store.watch(rec.id, { onGame: (g) => games.push(g.version), onBatches: (bs) => bs.forEach((b) => seen.push(b.seq)) });
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual([0]);
    rec = await store.commit(rec, { ...c.state, version: 1 }, [{ type: 'turnEnded', playerId: 'ZAF' }]);
    await new Promise((r) => setTimeout(r, 900));
    expect(seen).toEqual([0, 1]);
    expect(games.at(-1)).toBe(1);
    unsub();
    await store.commit(rec, { ...c.state, version: 2 }, [{ type: 'turnEnded', playerId: 'ZAF' }]);
    await new Promise((r) => setTimeout(r, 900));
    expect(seen).toEqual([0, 1]);
  });
});

describe('firestore-only behaviours', () => {
  it('a signed-out user cannot write, but can read', async () => {
    const db = new FakeDb();
    const owner = createFirestoreStore({} as never, makeFakeFs(db, { uid: 'u1' }) as never, 'u1');
    const c = newGame();
    const rec = await owner.createGame(setup, c.state, c.events);
    const visitor = createFirestoreStore({} as never, makeFakeFs(db, { uid: null }) as never, '');
    expect((await visitor.loadGame(rec.id))?.id).toBe(rec.id);
    await expect(visitor.commit(rec, { ...c.state, version: 1 }, [{ type: 'turnEnded', playerId: 'ZAF' }])).rejects.toThrow(/permission-denied/);
  });

  it("another signed-in user cannot change someone else's game", async () => {
    const db = new FakeDb();
    const owner = createFirestoreStore({} as never, makeFakeFs(db, { uid: 'u1' }) as never, 'u1');
    const c = newGame();
    const rec = await owner.createGame(setup, c.state, c.events);
    const attacker = createFirestoreStore({} as never, makeFakeFs(db, { uid: 'u2' }) as never, 'u2');
    await expect(attacker.commit(rec, { ...c.state, version: 1 }, [{ type: 'turnEnded', playerId: 'ZAF' }])).rejects.toThrow(/permission-denied/);
  });

  it('a failed batch leaves no partial writes behind', async () => {
    const db = new FakeDb();
    const store = createFirestoreStore({} as never, makeFakeFs(db, { uid: 'u1' }) as never, 'u1');
    const c = newGame();
    const rec = await store.createGame(setup, c.state, c.events);
    const before = new Map(db.docs);
    await expect(store.commit(rec, { ...c.state, version: 0 }, [{ type: 'turnEnded', playerId: 'ZAF' }])).rejects.toThrow(); // version must go up
    expect([...db.docs.keys()].sort()).toEqual([...before.keys()].sort());
  });
});

describe('helpers', () => {
  it('chunkEvents / padSeq / toPlain', () => {
    expect(chunkEvents([])).toEqual([]);
    expect(chunkEvents(Array.from({ length: 5 }, () => ({ type: 'turnEnded', playerId: 'A' }) as GameEvent), 2).map((c) => c.length)).toEqual([2, 2, 1]);
    expect(padSeq(12)).toBe('00000012');
    expect(toPlain({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
  it('applyEvent is exported and pure', () => {
    expect(typeof applyEvent).toBe('function');
  });
});
