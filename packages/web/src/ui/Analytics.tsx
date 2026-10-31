import { useEffect, useState } from 'react';
import { getCountry } from '@conquest/data';
import { DIFFICULTIES } from '@conquest/engine';
import { LEVELS, num1, pct, personalStats, platformStats } from '../game/analytics';
import type { GameStore } from '../game/store/GameStore';
import type { GameRow } from '../game/types';

export function Analytics({ store, onBack }: { store: GameStore | null; onBack: () => void }) {
  const [mine, setMine] = useState<GameRow[] | null>(null);
  const [all, setAll] = useState<GameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    store.listMine().then(setMine).catch(() => setError('Your games could not be loaded.'));
    store.listFinished(300).then(setAll).catch(() => setAll([]));
  }, [store]);

  const me = mine ? personalStats(mine) : null;
  const plat = all ? platformStats(all) : null;
  const maxSeat = plat ? Math.max(1, ...plat.winsBySeat) : 1;

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-top start">
          <button onClick={onBack}>← Back</button>
          <h1 style={{ fontSize: 24 }}>Analytics</h1>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        <section className="card" aria-label="Your statistics">
          <h2>You</h2>
          {!me && <p className="empty"><span className="spinner" /> Loading…</p>}
          {me && me.games === 0 && <p className="empty">Play a game and your statistics will appear here.</p>}
          {me && me.games > 0 && (
            <>
              <div className="kpis">
                <div className="kpi"><strong>{me.games}</strong><span>games ({me.active} in progress)</span></div>
                <div className="kpi"><strong>{pct(me.winRate)}</strong><span>win rate ({me.wins}/{me.finished})</span></div>
                <div className="kpi"><strong>{num1(me.avgRounds)}</strong><span>avg rounds</span></div>
                <div className="kpi"><strong>{me.fastestWin ?? '–'}</strong><span>fastest win (rounds)</span></div>
                <div className="kpi"><strong>{me.conquests}</strong><span>conquests in your games</span></div>
                <div className="kpi"><strong>{me.battles}</strong><span>battle rounds in your games</span></div>
              </div>
              <table className="table">
                <thead><tr><th>Rivals</th><th>Finished</th><th>Won</th><th>Win rate</th></tr></thead>
                <tbody>
                  {LEVELS.map((d) => (
                    <tr key={d}>
                      <td>{DIFFICULTIES[d].label}</td>
                      <td>{me.byDifficulty[d].games}</td>
                      <td>{me.byDifficulty[d].wins}</td>
                      <td>{pct(me.byDifficulty[d].games ? me.byDifficulty[d].wins / me.byDifficulty[d].games : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {me.favourite && <p className="muted" style={{ margin: 0 }}>Your most-played country: <strong style={{ color: 'var(--text)' }}>{getCountry(me.favourite.code)?.name}</strong> ({me.favourite.games} games)</p>}
            </>
          )}
        </section>

        <section className="card" aria-label="Platform statistics">
          <h2>Everyone <small>the most recent finished games across the whole platform</small></h2>
          {!plat && <p className="empty"><span className="spinner" /> Loading…</p>}
          {plat && plat.games === 0 && <p className="empty">No finished games on the platform yet.</p>}
          {plat && plat.games > 0 && (
            <>
              <div className="kpis">
                <div className="kpi"><strong>{plat.games}</strong><span>finished games</span></div>
                <div className="kpi"><strong>{pct(plat.humanWinRate)}</strong><span>won by the human</span></div>
                <div className="kpi"><strong>{pct(plat.humanEliminatedRate)}</strong><span>human eliminated</span></div>
                <div className="kpi"><strong>{num1(plat.avgRounds)}</strong><span>avg rounds</span></div>
                <div className="kpi"><strong>{plat.battles}</strong><span>battle rounds</span></div>
              </div>
              <table className="table">
                <thead><tr><th>Rivals</th><th>Games</th><th>Human wins</th><th>Human win rate</th></tr></thead>
                <tbody>
                  {LEVELS.map((d) => (
                    <tr key={d}>
                      <td>{DIFFICULTIES[d].label}</td>
                      <td>{plat.byDifficulty[d].games}</td>
                      <td>{plat.byDifficulty[d].wins}</td>
                      <td>{pct(plat.byDifficulty[d].games ? plat.byDifficulty[d].wins / plat.byDifficulty[d].games : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h2 style={{ fontSize: 13 }}>Who wins, by turn-order seat <small>(seat 1 went first)</small></h2>
              <div className="bars" role="img" aria-label="Wins by turn-order seat">
                {plat.winsBySeat.map((n, i) => (
                  <div className="bar-col" key={i}>
                    <b>{n}</b>
                    <i style={{ height: `${(n / maxSeat) * 100}%` }} />
                    <span>{i + 1}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
