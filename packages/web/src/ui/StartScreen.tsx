import { useEffect, useMemo, useState } from 'react';
import { COUNTRIES, getCountry } from '@conquest/data';
import { DIFFICULTIES, soldiersForPopulation, type Difficulty } from '@conquest/engine';
import { useAuth } from '../auth/AuthProvider';
import type { GameStore } from '../game/store/GameStore';
import type { GameRow } from '../game/types';
import { Flag } from './Flag';
import { HowToPlay } from './HowToPlay';
import { IconChart, IconGames, IconRules, IconSpark } from './Icons';
import { Logo } from './Logo';

interface Props {
  store: GameStore | null;
  onStart: (humanCode: string, difficulty: Difficulty) => void;
  onResume: (gameId: string) => void;
  onHistory: () => void;
  onAnalytics: () => void;
}

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

export function StartScreen({ store, onStart, onResume, onHistory, onAnalytics }: Props) {
  const { user, signOut, config } = useAuth();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('ZAF');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [rules, setRules] = useState(false);
  const [active, setActive] = useState<GameRow[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    store
      .listMine()
      .then((rows) => !cancelled && setActive(rows.filter((r) => r.status === 'active').slice(0, 5)))
      .catch(() => !cancelled && setListError('Your saved games could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [store]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q)).slice(0, 60);
  }, [query]);
  const chosen = getCountry(selected)!;
  const soldiers = soldiersForPopulation(chosen.population);

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-top">
          <div className="hero">
            <Logo size={52} />
            <div>
              <h1>Geopolitics Conquest</h1>
              <p>Pick a country. Nine random rivals take the rest. Conquer the world.</p>
            </div>
          </div>
          <div className="page-actions">
            <button onClick={() => setRules(true)}><IconRules /> Rules</button>
            <button onClick={onAnalytics}><IconChart /> Analytics</button>
            <button onClick={onHistory}><IconGames /> My games</button>
            <span className="chip" title={user?.email ?? ''}>{user?.isGuest ? 'dev guest' : user?.email}</span>
            <button className="ghost" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>

        <div className="cols">
          <section className="card" aria-label="New game">
            <h2>1 · Choose your country <small>{COUNTRIES.length} to pick from · number = starting soldiers</small></h2>
            <input className="picker-search" placeholder="Search countries…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search countries" />
            <div className="picker-list" role="listbox" aria-label="Countries">
              {matches.map((c) => (
                <button key={c.code} role="option" aria-selected={c.code === selected} className="picker-item" onClick={() => setSelected(c.code)}>
                  <Flag iso2={c.iso2} size={14} />
                  <span className="nm">{c.name}</span>
                  <span className="sol">{soldiersForPopulation(c.population)}</span>
                </button>
              ))}
              {matches.length === 0 && <p className="empty">No country matches “{query}”.</p>}
            </div>
            <div className="picked">
              <Flag iso2={chosen.iso2} size={28} />
              <div>
                <div className="nm">{chosen.name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {chosen.population.toLocaleString()} people → starts with <strong style={{ color: 'var(--text)' }}>{soldiers}</strong> {soldiers === 1 ? 'soldier' : 'soldiers'}
                </div>
              </div>
            </div>

            <h2>2 · Choose the rivals <small>how the nine computer players behave</small></h2>
            <div className="diff-grid">
              {LEVELS.map((d) => (
                <button key={d} className="diff-card" aria-pressed={difficulty === d} onClick={() => setDifficulty(d)}>
                  <strong>{DIFFICULTIES[d].label}</strong>
                  <span>{DIFFICULTIES[d].blurb}</span>
                </button>
              ))}
            </div>
            <button className="gold" style={{ padding: '12px 18px', fontSize: 16 }} disabled={!store} onClick={() => onStart(selected, difficulty)}>
              {store ? `Start as ${chosen.name}` : 'Connecting…'}
            </button>
            {config.llm && <p className="muted" style={{ margin: 0, fontSize: 12 }}><IconSpark /> AI commentary is on, and one rival per game has its attack choices made by an AI advisor.</p>}
          </section>

          <section className="card" aria-label="Continue a game">
            <h2>Continue a game</h2>
            {listError && <p className="form-error">{listError}</p>}
            {active === null && !listError && <p className="empty"><span className="spinner" /> Loading your games…</p>}
            {active?.length === 0 && <p className="empty">No games in progress. Pick a country and start one.</p>}
            <div className="game-rows">
              {active?.map((r) => (
                <div className="game-row" key={r.id}>
                  <Flag iso2={getCountry(r.humanCode)?.iso2 ?? 'un'} size={18} />
                  <div className="main">
                    <strong>{getCountry(r.humanCode)?.name ?? r.humanCode}</strong>
                    <span>
                      Round {r.round} · {DIFFICULTIES[r.difficulty].label} · {new Date(r.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="acts">
                    <button className="primary" onClick={() => onResume(r.id)}>Resume</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      {rules && <HowToPlay onClose={() => setRules(false)} />}
    </div>
  );
}
