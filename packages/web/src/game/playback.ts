import { useCallback, useEffect, useRef, useState } from 'react';
import { applyEvent, type BoardView, type GameEvent } from '@conquest/engine';

export const SPEEDS = [1, 2, 4, 8, 16] as const;
export type Speed = (typeof SPEEDS)[number];
export const DEFAULT_SPEED: Speed = 2;
/** The speed used by "fast-forward to my turn". Still plays every event: it just shortens each one. */
export const FAST_FORWARD_SPEED: Speed = 16;

/** Above this speed, AI commentary is skipped (the templated sentence is used) because it cannot keep up. */
export const MAX_LLM_SPEED: Speed = 2;

/** How long an event stays on screen, in milliseconds, at the given speed. Never zero: nothing is skipped. */
export function eventDurationMs(e: GameEvent, speed: number): number {
  let base: number;
  switch (e.type) {
    case 'gameStarted':
      base = 300;
      break;
    case 'turnStarted':
      base = 500;
      break;
    case 'turnEnded':
      base = 60;
      break;
    case 'reinforcementsGranted':
      base = 450;
      break;
    case 'reinforcementsAllocated':
    case 'transferred':
      base = 800;
      break;
    case 'npcDecision':
      base = 150; // the justification stays in the log; the action that follows carries the screen time
      break;
    case 'attackStarted':
      base = 900;
      break;
    case 'battleRound':
      base = 1100 + 90 * Math.min(e.pairs.length, 9);
      break;
    case 'territoryConquered':
      base = 1300;
      break;
    case 'captureCompleted':
      base = 500;
      break;
    case 'attackFailed':
      base = 900;
      break;
    case 'attackStopped':
      base = 700;
      break;
    case 'playerEliminated':
      base = 1500;
      break;
    case 'gameWon':
      base = 2500;
      break;
  }
  return Math.max(40, Math.round(base / speed));
}

export interface LogEntry {
  id: number;
  event: GameEvent;
}

const MAX_LOG = 800;

/**
 * Plays a queue of events back one by one. The board the player SEES (`view`) only changes when an event is
 * presented, so a whole NPC run can be computed (and saved) instantly and still unfold step by step.
 * `speed` only changes how long each step lasts: nothing is ever skipped.
 */
export function useEventPlayer(speed: number) {
  const [view, setView] = useState<BoardView | null>(null);
  const [current, setCurrent] = useState<{ id: number; event: GameEvent } | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  const queue = useRef<GameEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);
  const nextId = useRef(0);
  speedRef.current = speed;

  const pump = useCallback((): void => {
    if (timer.current !== null) return;
    const next = queue.current.shift();
    if (!next) {
      setBusy(false);
      return;
    }
    const id = nextId.current++;
    setBusy(true);
    setView((v) => (v ? applyEvent(v, next) : v));
    setCurrent({ id, event: next });
    setLog((l) => [...(l.length >= MAX_LOG ? l.slice(l.length - MAX_LOG + 1) : l), { id, event: next }]);
    timer.current = setTimeout(() => {
      timer.current = null;
      pump();
    }, eventDurationMs(next, speedRef.current));
  }, []);

  const enqueue = useCallback(
    (events: readonly GameEvent[]): void => {
      if (events.length === 0) return;
      queue.current.push(...events);
      pump();
    },
    [pump],
  );

  /** Replaces the board and clears everything; optionally seeds the log with past events (no animation). */
  const reset = useCallback((initial: BoardView | null, pastEvents: readonly GameEvent[] = []): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    queue.current = [];
    setView(initial);
    setCurrent(null);
    const past = pastEvents.slice(-MAX_LOG);
    const base = nextId.current;
    nextId.current += past.length;
    setLog(past.map((event, i) => ({ id: base + i, event })));
    setBusy(false);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  return { view, current, log, busy, enqueue, reset };
}
