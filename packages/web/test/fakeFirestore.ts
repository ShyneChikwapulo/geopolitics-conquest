/**
 * A tiny in-memory stand-in for the parts of firebase/firestore the app uses. It deliberately copies the
 * real service's behaviours that matter for correctness:
 *   - `undefined` field values are rejected (unless ignoreUndefinedProperties, which we do NOT emulate here);
 *   - a write batch is atomic (all or nothing);
 *   - the security rules' "events are append-only" and "version only goes up" are emulated, so concurrent
 *     writers and stale tabs fail the same way they would in production.
 */
type Data = Record<string, unknown>;
interface Ref { path: string; id: string }
interface Constraint { kind: 'where' | 'orderBy' | 'limit'; a?: string; b?: string; c?: unknown; n?: number }

export class FakeDb {
  docs = new Map<string, Data>();
  listeners = new Set<() => void>();
  notify() { for (const l of [...this.listeners]) l(); }
}

function assertNoUndefined(v: unknown, path = ''): void {
  if (v === undefined) throw new Error(`Unsupported field value: undefined (at ${path || 'root'})`);
  if (Array.isArray(v)) v.forEach((x, i) => assertNoUndefined(x, `${path}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) assertNoUndefined(x, `${path}.${k}`);
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function makeFakeFs(db: FakeDb, auth: { uid: string | null }) {
  const doc = (_db: unknown, ...segs: string[]): Ref => ({ path: segs.join('/'), id: segs[segs.length - 1]! });
  const collection = (_db: unknown, ...segs: string[]) => ({ path: segs.join('/'), isCollection: true as const });
  const where = (a: string, b: string, c: unknown): Constraint => ({ kind: 'where', a, b, c });
  const orderBy = (a: string): Constraint => ({ kind: 'orderBy', a });
  const limit = (n: number): Constraint => ({ kind: 'limit', n });
  const query = (coll: { path: string }, ...cs: Constraint[]) => ({ coll, cs });

  const snapDoc = (path: string) => ({
    id: path.split('/').pop()!,
    ref: { path, id: path.split('/').pop()! },
    exists: () => db.docs.has(path),
    data: () => clone(db.docs.get(path)),
  });

  const runQuery = (q: { coll: { path: string }; cs: Constraint[] }) => {
    const depth = q.coll.path.split('/').length + 1;
    let rows = [...db.docs.keys()].filter((p) => p.startsWith(q.coll.path + '/') && p.split('/').length === depth);
    for (const c of q.cs) {
      if (c.kind === 'where') rows = rows.filter((p) => (db.docs.get(p) as Data)[c.a!] === c.c);
    }
    const order = q.cs.find((c) => c.kind === 'orderBy');
    if (order) rows.sort((x, y) => Number((db.docs.get(x) as Data)[order.a!]) - Number((db.docs.get(y) as Data)[order.a!]));
    const lim = q.cs.find((c) => c.kind === 'limit');
    if (lim) rows = rows.slice(0, lim.n);
    return { docs: rows.map(snapDoc) };
  };

  const checkRules = (op: 'create' | 'update' | 'delete', path: string, data: Data | undefined, existing: Data | undefined) => {
    const segs = path.split('/');
    if (auth.uid === null) throw Object.assign(new Error('permission-denied (not signed in)'), { code: 'permission-denied' });
    if (segs.length === 2) {
      if (op === 'create' && data!.ownerUid !== auth.uid) throw Object.assign(new Error('permission-denied (owner)'), { code: 'permission-denied' });
      if (op === 'update') {
        if (existing!.ownerUid !== auth.uid) throw Object.assign(new Error('permission-denied (not owner)'), { code: 'permission-denied' });
        if (!(Number(data!.version) > Number(existing!.version))) throw Object.assign(new Error('permission-denied (stale version)'), { code: 'permission-denied' });
        if (existing!.status !== 'active') throw Object.assign(new Error('permission-denied (finished)'), { code: 'permission-denied' });
      }
    } else if (segs.length === 4) {
      if (op === 'update') throw Object.assign(new Error('permission-denied (events are append-only)'), { code: 'permission-denied' });
    }
  };

  const writeBatch = (_db: unknown) => {
    const ops: Array<() => void> = [];
    const staged = new Map<string, Data | null>();
    const batch = {
      set(ref: Ref, data: Data) {
        assertNoUndefined(data);
        ops.push(() => {
          const exists = db.docs.has(ref.path);
          checkRules(exists ? 'update' : 'create', ref.path, data, db.docs.get(ref.path));
          staged.set(ref.path, clone(data));
        });
      },
      update(ref: Ref, data: Data) {
        assertNoUndefined(data);
        ops.push(() => {
          const existing = (staged.get(ref.path) ?? db.docs.get(ref.path)) as Data | undefined;
          if (!existing) throw new Error(`No document to update: ${ref.path}`);
          checkRules('update', ref.path, { ...existing, ...data }, db.docs.get(ref.path));
          staged.set(ref.path, { ...existing, ...clone(data) });
        });
      },
      delete(ref: Ref) {
        ops.push(() => {
          checkRules('delete', ref.path, undefined, db.docs.get(ref.path));
          staged.set(ref.path, null);
        });
      },
      async commit() {
        ops.forEach((op) => op()); // any failure throws BEFORE anything is applied: atomic
        for (const [p, v] of staged) {
          if (v === null) db.docs.delete(p);
          else db.docs.set(p, v);
        }
        db.notify();
      },
    };
    return batch;
  };

  const onSnapshot = (target: unknown, next: (s: unknown) => void, _err?: (e: Error) => void) => {
    const emit = () => {
      if ((target as Ref).path !== undefined && !('coll' in (target as object))) next(snapDoc((target as Ref).path));
      else next(runQuery(target as { coll: { path: string }; cs: Constraint[] }));
    };
    emit();
    db.listeners.add(emit);
    return () => db.listeners.delete(emit);
  };

  return {
    doc, collection, where, orderBy, limit, query, writeBatch, onSnapshot,
    getDoc: async (ref: Ref) => snapDoc(ref.path),
    getDocs: async (q: unknown) => runQuery('coll' in (q as object) ? (q as never) : ({ coll: q as { path: string }, cs: [] })),
    deleteDoc: async (ref: Ref) => { db.docs.delete(ref.path); db.notify(); },
  };
}
