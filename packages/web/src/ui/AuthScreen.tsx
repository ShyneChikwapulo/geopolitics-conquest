import { useState } from 'react';
import { Logo } from './Logo';

interface AuthScreenProps {
  onAuthed: () => void;
}

type Mode = 'login' | 'signup';

export function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const firebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (!firebaseConfigured) {
        // Local fallback: hardcoded creds from .env.local
        const USER = import.meta.env.VITE_APP_USER ?? 'student';
        const PASS = import.meta.env.VITE_APP_PASS ?? 'inf4001n';
        if (email === USER && password === PASS) { onAuthed(); return; }
        throw new Error('Incorrect username or password (local mode).');
      }
      const { initFirebaseAuth } = await import('../game/firebaseClient');
      const auth = await initFirebaseAuth();
      if (mode === 'signup') await auth.signUp(email, password);
      else await auth.signIn(email, password);
      onAuthed();
    } catch (err: any) {
      setError(humanizeFirebaseError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">
          <Logo size={56} variant="gold" />
          <h1>Geopolitics Conquest</h1>
        </div>
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'primary' : ''}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'primary' : ''}
            onClick={() => { setMode('signup'); setError(''); }}
          >
            Sign up
          </button>
        </div>
        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          <label>
            Password {mode === 'signup' && <span className="muted">(at least 6 characters)</span>}
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? 6 : undefined}
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
        {!firebaseConfigured && (
          <p className="login-hint muted">
            Local mode — default login <code>student</code> / <code>inf4001n</code>
          </p>
        )}
      </div>
    </div>
  );
}

function humanizeFirebaseError(err: any): string {
  const code = err?.code ?? '';
  if (code.includes('email-already-in-use')) return 'That email is already registered. Try logging in.';
  if (code.includes('invalid-email')) return 'Please enter a valid email address.';
  if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (code.includes('user-not-found')) return 'No account with that email. Try signing up.';
  if (code.includes('wrong-password')) return 'Incorrect password.';
  if (code.includes('invalid-credential')) return 'Incorrect email or password.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Try again in a minute.';
  return err?.message ?? 'Something went wrong. Try again.';
}