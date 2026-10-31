import type { Action, GameState } from '@conquest/engine';

const KEY_GAMES = 'cq:games';
const KEY_ACTIONS = 'cq:actions';

function readJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T; }
  catch { return fallback; }
}

export function saveLocalGame(s: GameState): void {
  const games = readJson<Record<string, GameState>>(KEY_GAMES, {});
  games[s.id] = s;
  const entries = Object.entries(games).slice(-50);
  localStorage.setItem(KEY_GAMES, JSON.stringify(Object.fromEntries(entries)));
}

export function recordLocalAction(gameId: string, a: Action): void {
  const all = readJson<Record<string, Action[]>>(KEY_ACTIONS, {});
  (all[gameId] ??= []).push(a);
  localStorage.setItem(KEY_ACTIONS, JSON.stringify(all));
}

export function loadAllGames(): GameState[] {
  return Object.values(readJson<Record<string, GameState>>(KEY_GAMES, {}));
}

export function loadActions(gameId: string): Action[] {
  return readJson<Record<string, Action[]>>(KEY_ACTIONS, {})[gameId] ?? [];
}