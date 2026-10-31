import { describe, expect, it } from 'vitest';
import { SPEEDS, eventDurationMs } from '../src/game/playback';
import { readConfig } from '../src/config';
import { friendlyAuthError, validateCredentials } from '../src/auth/errors';
import type { GameEvent } from '@conquest/engine';

const battle = (n: number): GameEvent => ({
  type: 'battleRound', playerId: 'A', from: 'A', to: 'B', round: 1,
  pairs: Array.from({ length: n }, () => ({ attacker: 1, defender: 1, result: 'tie' as const })),
  attackerLosses: 0, defenderLosses: 0, attackerSoldiersAfter: 5, defenderSoldiersAfter: 5,
});

describe('eventDurationMs', () => {
  it('never reaches zero (nothing is skipped), even at the highest speed', () => {
    const events: GameEvent[] = [
      { type: 'turnEnded', playerId: 'A' },
      { type: 'npcDecision', playerId: 'A', kind: 'endTurn', reason: 'x' },
      battle(1),
    ];
    for (const e of events) for (const s of SPEEDS) expect(eventDurationMs(e, s)).toBeGreaterThanOrEqual(40);
  });
  it('gets shorter as speed goes up, and longer for bigger battles', () => {
    const times = SPEEDS.map((s) => eventDurationMs(battle(4), s));
    for (let i = 1; i < times.length; i++) expect(times[i]!).toBeLessThan(times[i - 1]!);
    expect(eventDurationMs(battle(9), 1)).toBeGreaterThan(eventDurationMs(battle(1), 1));
  });
});

describe('readConfig', () => {
  it('has no Firebase and no LLM by default; a dev build offers a guest, a production build does not', () => {
    expect(readConfig({ DEV: true })).toEqual({ firebase: null, llm: null, devGuest: true });
    expect(readConfig({ DEV: false }).devGuest).toBe(false);
  });
  it('needs all four Firebase settings, and turns the guest off once Firebase is configured', () => {
    const partial = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p', DEV: true };
    expect(readConfig(partial).firebase).toBeNull();
    const full = { ...partial, VITE_FIREBASE_AUTH_DOMAIN: 'd', VITE_FIREBASE_APP_ID: 'a' };
    expect(readConfig(full).firebase).toEqual({ apiKey: 'k', authDomain: 'd', projectId: 'p', appId: 'a' });
    expect(readConfig(full).devGuest).toBe(false);
  });
  it('prefers a proxy (no key in the browser) over a direct OpenRouter key', () => {
    const both = readConfig({ VITE_LLM_PROXY_URL: 'https://p.example/chat', VITE_OPENROUTER_KEY: 'sk-x' });
    expect(both.llm).toMatchObject({ endpoint: 'https://p.example/chat', apiKey: null, viaProxy: true });
    expect(readConfig({ VITE_OPENROUTER_KEY: 'sk-x' }).llm).toMatchObject({ apiKey: 'sk-x', viaProxy: false });
  });
  it('contains no built-in credentials', () => {
    expect(JSON.stringify(readConfig({}))).not.toMatch(/student|inf4001n/i);
  });
});

describe('auth messages', () => {
  it('maps Firebase codes to plain language', () => {
    expect(friendlyAuthError({ code: 'auth/invalid-credential' })).toMatch(/do not match/);
    expect(friendlyAuthError({ code: 'auth/email-already-in-use' })).toMatch(/already exists/);
    expect(friendlyAuthError({ code: 'auth/weak-password' })).toMatch(/stronger/);
    expect(friendlyAuthError(new Error('boom'))).toBe('boom');
    expect(friendlyAuthError(undefined)).toMatch(/went wrong/);
  });
  it('validates credentials before calling the network', () => {
    expect(validateCredentials('nope', 'x', 'signIn')).toMatch(/valid email/);
    expect(validateCredentials('a@b.co', '', 'signIn')).toMatch(/password/);
    expect(validateCredentials('a@b.co', '123', 'signUp')).toMatch(/6 characters/);
    expect(validateCredentials('a@b.co', '123456', 'signUp')).toBeNull();
  });
});
