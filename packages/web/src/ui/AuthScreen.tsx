import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { validateCredentials } from '../auth/errors';
import { Logo } from './Logo';

type Mode = 'signIn' | 'signUp' | 'reset';

export function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') {
    return (
      <div className="auth-screen" role="status">
        <div className="auth-card">
          <div className="auth-logo"><Logo size={48} /><h1><span className="spinner" /> Connecting…</h1></div>
        </div>
      </div>
    );
  }

  if (auth.status === 'unavailable') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo"><Logo size={48} /><h1>Sign-in is unavailable</h1></div>
          <p className="form-error" role="alert">{auth.unavailableReason}</p>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            You can still watch any game from its shared link. Playing needs an account.
          </p>
          <button onClick={() => location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'reset') {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter the email address of your account.');
    } else {
      const problem = validateCredentials(email, password, mode);
      if (problem) return setError(problem);
    }
    setBusy(true);
    try {
      if (mode === 'signIn') await auth.signIn(email, password);
      else if (mode === 'signUp') await auth.signUp(email, password);
      else {
        await auth.resetPassword(email);
        setInfo('If an account exists for that email, a reset link is on its way.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={(e) => void submit(e)} noValidate>
        <div className="auth-logo">
          <Logo size={52} />
          <h1>Geopolitics Conquest</h1>
          <span className="muted" style={{ fontSize: 13 }}>Sign in to play. Anyone can watch a shared game without an account.</span>
        </div>

        {mode !== 'reset' && (
          <div className="auth-tabs" role="group" aria-label="Sign in or create an account">
            <button type="button" aria-pressed={mode === 'signIn'} onClick={() => { setMode('signIn'); setError(null); }}>Sign in</button>
            <button type="button" aria-pressed={mode === 'signUp'} onClick={() => { setMode('signUp'); setError(null); }}>Create account</button>
          </div>
        )}

        <div className="auth-form">
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </label>
          {mode !== 'reset' && (
            <label>
              Password
              <input type="password" autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === 'signUp' ? 6 : undefined} />
            </label>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {info && <p className="form-ok" role="status">{info}</p>}
          <button className="gold" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : mode === 'signUp' ? 'Create account' : 'Send reset link'}
          </button>
          {mode === 'signIn' && (
            <button type="button" className="ghost" onClick={() => { setMode('reset'); setError(null); }}>Forgot your password?</button>
          )}
          {mode === 'reset' && (
            <button type="button" className="ghost" onClick={() => { setMode('signIn'); setError(null); setInfo(null); }}>← Back to sign in</button>
          )}
        </div>

        {auth.config.devGuest && (
          <div className="dev-note">
            <strong>Development mode.</strong> Firebase is not configured, so accounts are unavailable.{' '}
            <button type="button" onClick={auth.continueAsGuest}>Continue as a local guest</button>
            <div style={{ marginTop: 4 }}>Games are saved in this browser only.</div>
          </div>
        )}
      </form>
    </div>
  );
}
