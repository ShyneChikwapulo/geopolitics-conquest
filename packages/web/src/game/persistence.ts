import type { Action, GameState } from '@conquest/engine';
import { saveLocalGame, recordLocalAction } from './localStore';

const firebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);

let firebaseSave: ((s: GameState) => Promise<void>) | null = null;
let firebaseAction: ((gameId: string, a: Action) => Promise<void>) | null = null;

async function ensureFirebase() {
  if (!firebaseConfigured || firebaseSave) return;
  const { initFirebase } = await import('./firebaseClient');
  const fb = await initFirebase();
  firebaseSave = fb.saveGame;
  firebaseAction = fb.recordAction;
}

export async function saveGame(s: GameState): Promise<void> {
  await ensureFirebase();
  if (firebaseSave) await firebaseSave(s);
  else saveLocalGame(s);
}

export async function recordAction(gameId: string, a: Action): Promise<void> {
  await ensureFirebase();
  if (firebaseAction) await firebaseAction(gameId, a);
  else recordLocalAction(gameId, a);
}