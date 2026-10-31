import { useCallback, useEffect, useState } from 'react';
import { getCachedGeo, loadGeo, type GeoIndex } from './geo';

export function useGeo(): { geo: GeoIndex | null; error: string | null; retry: () => void } {
  const [geo, setGeo] = useState<GeoIndex | null>(getCachedGeo());
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadGeo()
      .then((g) => !cancelled && setGeo(g))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'The map could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { geo, error, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}
