import { useEffect, useState } from 'react';
import { getFirebase } from '../firebase';
import { createFirestoreStore } from './firestoreStore';
import { createLocalStore } from './localStore';
import type { GameStore } from './GameStore';
import type { AppConfig } from '../../config';
import { useAuth } from '../../auth/AuthProvider';

/** A read-only store for visitors who are not signed in (spectator links). Uses Firestore when configured. */
export async function openReadStore(config: AppConfig): Promise<GameStore> {
  if (config.firebase) {
    const svc = await getFirebase(config.firebase);
    return createFirestoreStore(svc.db, svc.fs, '');
  }
  return createLocalStore(localStorage, 'viewer');
}

/** The store for the signed-in user (null until it is ready). */
export function useStore(): GameStore | null {
  const { user, services, config } = useAuth();
  const [store, setStore] = useState<GameStore | null>(null);
  const uid = user?.uid ?? null;
  const guest = user?.isGuest ?? false;

  useEffect(() => {
    if (!uid) {
      setStore(null);
      return;
    }
    if (config.firebase && !guest) {
      if (services) setStore(createFirestoreStore(services.db, services.fs, uid));
      return;
    }
    setStore(createLocalStore(localStorage, uid));
  }, [uid, guest, services, config]);

  return store;
}
