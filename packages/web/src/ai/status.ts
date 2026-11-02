/**
 * Tracks whether the AI service (the proxy) is answering, which provider answered last, and backs off after
 * repeated failures so the game does not wait on a service that is down. Only used when requests go through the
 * proxy; direct development calls never back off.
 */

export type AiProvider = 'openrouter' | 'workers-ai' | 'gemini';

export interface AiStatus {
  /** The provider that answered the last request (reported by the proxy), or null if unknown. */
  provider: AiProvider | null;
  /** True while the service is failing repeatedly and calls are being skipped. */
  degraded: boolean;
  /** Consecutive failures since the last success. */
  failures: number;
  /** Epoch ms before which no new request is attempted. */
  retryAt: number;
}

const LABELS: Record<AiProvider, string> = {
  openrouter: 'OpenRouter',
  'workers-ai': 'Workers AI',
  gemini: 'Gemini',
};

export function providerLabel(provider: string | null): string | null {
  return provider && provider in LABELS ? LABELS[provider as AiProvider] : null;
}

/** Wait before the next attempt, by number of consecutive failures. The first failure retries immediately. */
export const BACKOFF_MS: readonly number[] = [0, 0, 30_000, 60_000, 120_000];
export const backoffAfter = (failures: number): number => BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)] ?? 0;

const INITIAL: AiStatus = { provider: null, degraded: false, failures: 0, retryAt: 0 };
let status: AiStatus = INITIAL;
const listeners = new Set<() => void>();

function set(next: AiStatus): void {
  if (next.provider === status.provider && next.degraded === status.degraded && next.failures === status.failures && next.retryAt === status.retryAt) return;
  status = next; // a new object each time, so useSyncExternalStore sees a stable snapshot between changes
  for (const fn of listeners) fn();
}

export const getAiStatus = (): AiStatus => status;

export function subscribeAiStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** False while backing off. */
export const canUseAi = (now: number = Date.now()): boolean => now >= status.retryAt;

export function recordAiSuccess(provider: string | null = null): void {
  set({ provider: providerLabel(provider) ? (provider as AiProvider) : status.provider, degraded: false, failures: 0, retryAt: 0 });
}

export function recordAiFailure(now: number = Date.now()): void {
  const failures = status.failures + 1;
  set({ provider: status.provider, degraded: failures >= 2, failures, retryAt: now + backoffAfter(failures) });
}

/** For tests and for signing out. */
export function resetAiStatus(): void {
  set(INITIAL);
}
