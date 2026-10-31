import { useEffect, useRef, useState } from 'react';
import { applyEvent, boardFromState, foldEvents, type BoardView, type GameEvent } from '@conquest/engine';
import { config } from '../config';
import { DEFAULT_SPEED, useEventPlayer, type Speed } from './playback';
import { openReadStore } from './store/useStore';
import type { Batch, GameRecord } from './types';

/**
 * Follows a game in real time without being signed in.
 * The first batch delivery is the history so far: it is folded in silently (a late joiner should not have to sit
 * through the whole game). Every batch after that is queued and played back with the normal animations.
 */
export function useSpectator(gameId: string) {
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  const player = useEventPlayer(speed);
  const { reset, enqueue } = player;

  const recRef = useRef<GameRecord | null>(null);
  const history = useRef<GameEvent[] | null>(null);
  const live = useRef(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    recRef.current = null;
    history.current = null;
    live.current = false;

    const tryStart = (): void => {
      if (live.current || !recRef.current || history.current === null) return;
      live.current = true;
      const initial = boardFromState(recRef.current.initial);
      reset(foldEvents(initial, history.current), history.current);
    };

    openReadStore(config)
      .then((store) => {
        if (cancelled) return;
        unsubscribe = store.watch(gameId, {
          onGame: (r) => {
            recRef.current = r;
            setRecord(r);
            tryStart();
          },
          onBatches: (batches: Batch[]) => {
            const events = batches.flatMap((b) => b.events);
            if (!live.current && history.current === null) {
              history.current = events;
              tryStart();
            } else if (live.current) {
              enqueue(events);
            } else {
              history.current = [...(history.current ?? []), ...events];
            }
          },
          onError: () => setError('This game could not be loaded. The link may be wrong, or the game may have been deleted.'),
        });
      })
      .catch(() => !cancelled && setError('Could not connect to the game service.'));

    // If nothing arrives, say so instead of spinning forever.
    const timeout = setTimeout(() => {
      if (!recRef.current) setError('This game could not be found. The link may be wrong, or the game may have been deleted.');
    }, 12_000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [gameId, reset, enqueue]);

  return { record, error, speed, setSpeed, ...player };
}

export { applyEvent };
