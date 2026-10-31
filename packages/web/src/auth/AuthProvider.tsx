import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { config as defaultConfig, type AppConfig } from '../config';
import { getFirebase, type FirebaseServices } from '../game/firebase';
import { friendlyAuthError } from './errors';

export interface AppUser {
  uid: string;
  email: string | null;
  /** True only for the local-development guest (never exists in a production build). */
  isGuest: boolean;
}

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'unavailable';

export interface AuthApi {
  status: AuthStatus;
  user: AppUser | null;
  /** Why sign-in is impossible (e.g. Firebase not configured in a production build). */
  unavailableReason: string | null;
  /** The Firebase services, once loaded (used to build the Firestore store). */
  services: FirebaseServices | null;
  config: AppConfig;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  /** Development only, when Firebase is not configured. */
  continueAsGuest(): void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

const GUEST: AppUser = { uid: 'dev-guest', email: null, isGuest: true };

export function AuthProvider({ children, config = defaultConfig }: { children: ReactNode; config?: AppConfig }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [services, setServices] = useState<FirebaseServices | null>(null);

  useEffect(() => {
    if (!config.firebase) {
      // No Firebase: production builds cannot sign anyone in. Development may offer a labelled guest.
      setStatus(config.devGuest ? 'signedOut' : 'unavailable');
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    getFirebase(config.firebase)
      .then((svc) => {
        if (cancelled) return;
        setServices(svc);
        unsubscribe = svc.authApi.onAuthStateChanged(
          svc.auth,
          (u) => {
            if (cancelled) return;
            setUser(u ? { uid: u.uid, email: u.email, isGuest: false } : null);
            setStatus(u ? 'signedIn' : 'signedOut');
          },
          () => !cancelled && setStatus('unavailable'),
        );
      })
      .catch(() => !cancelled && setStatus('unavailable'));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [config]);

  const need = (): FirebaseServices => {
    if (!services) throw new Error('Sign-in is not available right now.');
    return services;
  };

  const signIn = useCallback(
    async (email: string, password: string) => {
      const s = need();
      try {
        await s.authApi.signInWithEmailAndPassword(s.auth, email.trim(), password);
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services],
  );
  const signUp = useCallback(
    async (email: string, password: string) => {
      const s = need();
      try {
        await s.authApi.createUserWithEmailAndPassword(s.auth, email.trim(), password);
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services],
  );
  const resetPassword = useCallback(
    async (email: string) => {
      const s = need();
      try {
        await s.authApi.sendPasswordResetEmail(s.auth, email.trim());
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [services],
  );
  const signOut = useCallback(async () => {
    if (services) await services.authApi.signOut(services.auth);
    else {
      setUser(null);
      setStatus('signedOut');
    }
  }, [services]);
  const continueAsGuest = useCallback(() => {
    if (!config.devGuest) return;
    setUser(GUEST);
    setStatus('signedIn');
  }, [config.devGuest]);

  const value = useMemo<AuthApi>(
    () => ({
      status,
      user,
      unavailableReason: status === 'unavailable' ? (config.firebase ? 'Could not connect to the sign-in service.' : 'This deployment is not configured with Firebase.') : null,
      services,
      config,
      signIn,
      signUp,
      signOut,
      resetPassword,
      continueAsGuest,
    }),
    [status, user, services, config, signIn, signUp, signOut, resetPassword, continueAsGuest],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
