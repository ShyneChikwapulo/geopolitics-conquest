import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, type Auth } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, updateDoc, onSnapshot,
  arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import type { Action, GameState } from '@conquest/engine';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let cached: {
  saveGame: (s: GameState) => Promise<void>;
  recordAction: (gameId: string, a: Action) => Promise<void>;
  watchGame: (gameId: string, cb: (s: GameState) => void) => () => void;
} | null = null;

function getApp(): FirebaseApp {
  if (app) return app;
  app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  return app;
}

export async function initFirebaseAuth() {
  if (!auth) auth = getAuth(getApp());
  const a = auth;
  return {
    signUp: async (email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(a, email, password);
      return cred.user;
    },
    signIn: async (email: string, password: string) => {
      const cred = await signInWithEmailAndPassword(a, email, password);
      return cred.user;
    },
    signOut: () => signOut(a),
    onChange: (cb: (uid: string | null) => void) => onAuthStateChanged(a, (u) => cb(u?.uid ?? null)),
    currentUid: () => a.currentUser?.uid ?? null,
  };
}

export async function initFirebase() {
  if (cached) return cached;
  const db = getFirestore(getApp());

  async function saveGame(s: GameState): Promise<void> {
    const uid = auth?.currentUser?.uid ?? null;
    await setDoc(doc(db, 'games', s.id), {
      ...s,
      ownerUid: uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async function recordAction(gameId: string, a: Action): Promise<void> {
    await updateDoc(doc(db, 'games', gameId), {
      actions: arrayUnion(a),
      updatedAt: serverTimestamp(),
    }).catch(async () => {
      await setDoc(doc(db, 'games', gameId), {
        actions: [a],
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  }

  function watchGame(gameId: string, cb: (s: GameState) => void): () => void {
    const ref = doc(db, 'games', gameId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      cb(snap.data() as unknown as GameState);
    });
  }

  cached = { saveGame, recordAction, watchGame };
  return cached;
}