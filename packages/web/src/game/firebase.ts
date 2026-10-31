import type { FirebaseApp } from 'firebase/app';
import type * as AuthModule from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import type * as FirestoreModule from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseSettings } from '../config';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  authApi: typeof AuthModule;
  fs: typeof FirestoreModule;
}

let cache: Promise<FirebaseServices> | null = null;

/** Loads Firebase lazily (keeps it out of the first page load) and initialises it once. */
export function getFirebase(settings: FirebaseSettings): Promise<FirebaseServices> {
  cache ??= (async () => {
    const [{ initializeApp }, authApi, fs] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
    ]);
    const app = initializeApp(settings);
    const auth = authApi.getAuth(app);
    // Firestore rejects `undefined` field values; ignoring them keeps optional event fields from failing a save.
    const db = fs.initializeFirestore(app, { ignoreUndefinedProperties: true });
    return { app, auth, db, authApi, fs };
  })().catch((e) => {
    cache = null; // allow a retry after a transient failure
    throw e;
  });
  return cache;
}
