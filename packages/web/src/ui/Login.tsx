import { useState } from 'react';

const USER = import.meta.env.VITE_APP_USER ?? 'student';
const PASS = import.meta.env.VITE_APP_PASS ?? 'inf4001n';

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === USER && pass === PASS) {
      onSuccess();
    } else {
      setError('Incorrect username or password.');
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Geopolitics Conquest</h1>
        <p className="muted">Sign in to play.</p>
        <label>
          Username
          <input
            type="text"
            value={user}
            onChange={(e) => { setUser(e.target.value); setError(''); }}
            autoFocus
            autoComplete="username"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={pass}
            onChange={(e) => { setPass(e.target.value); setError(''); }}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="primary">Sign in</button>
        <p className="login-hint muted">
          Default: <code>student</code> / <code>inf4001n</code>
        </p>
      </form>
    </div>
  );
}