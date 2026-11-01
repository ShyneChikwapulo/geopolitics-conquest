import { useEffect, useState } from 'react';
import { getCountry } from '@conquest/data';
import { DIFFICULTIES } from '@conquest/engine';
import { countByFilter, filterGames, GAME_FILTERS, type GameFilter } from '../game/historyFilter';
import { shareUrl } from '../game/share';
import type { GameStore } from '../game/store/GameStore';
import type { GameRow } from '../game/types';
import { Flag } from './Flag';
import { IconTrash } from './Icons';

interface Props {
  store: GameStore | null;
  onBack: () => void;
  onResume: (id: string) => void;
  onReplay: (id: string) => void;
}

export function History({ store, onBack, onResume, onReplay }: Props) {
  const [rows, setRows] = useState<GameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<GameFilter>('all');

  const load = (): void => {
    if (!store) return;
    setError(null);
    store.listMine().then(setRows).catch(() => setError('Your games could not be loaded.'));
  };
  useEffect(load, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async (id: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl(id));
      setNotice('Spectator link copied.');
    } catch {
      setNotice(shareUrl(id));
    }
  };
  const remove = async (id: string): Promise<void> => {
    try {
      await store!.deleteGame(id);
      setConfirm(null);
      load();
    } catch {
      setError('That game could not be deleted.');
    }
  };

  const visible = rows ? filterGames(rows, filter) : [];
  const counts = countByFilter(rows ?? []);

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-top start">
          <button onClick={onBack}>← Back</button>
          <h1 style={{ fontSize: 24 }}>My games</h1>
          <span className="grow" />
          {notice && <span className="notice">{notice}</span>}
        </div>
        <section className="card">
          {error && <p className="form-error" role="alert">{error}</p>}
          {rows === null && !error && <p className="empty"><span className="spinner" /> Loading…</p>}
          {rows !== null && rows.length > 0 && (
            <div className="filter-tabs" role="group" aria-label="Filter games">
              {GAME_FILTERS.map((f) => (
                <button key={f.id} className="filter-tab" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                  {f.label} <span className="filter-count">{counts[f.id]}</span>
                </button>
              ))}
            </div>
          )}
          {rows?.length === 0 && <p className="empty">You have not played any games yet.</p>}
          {rows !== null && rows.length > 0 && visible.length === 0 && <p className="empty">No games match this filter.</p>}
          <div className="game-rows">
            {visible.map((r) => {
              const c = getCountry(r.humanCode);
              const result = r.status === 'active' ? { cls: 'active', text: 'In progress' } : r.summary?.humanWon ? { cls: 'won', text: 'Won' } : { cls: 'lost', text: 'Lost' };
              return (
                <div className="game-row" key={r.id}>
                  <Flag iso2={c?.iso2 ?? 'un'} size={20} />
                  <div className="main">
                    <strong>
                      {c?.name ?? r.humanCode} <span className={`result-pill ${result.cls}`}>{result.text}</span>
                    </strong>
                    <span>
                      {DIFFICULTIES[r.difficulty].label} · round {r.round} · {r.stats.battles} battle rounds · {new Date(r.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="acts">
                    {r.status === 'active' && <button className="primary" onClick={() => onResume(r.id)}>Resume</button>}
                    <button onClick={() => onReplay(r.id)}>Replay</button>
                    <button onClick={() => void copy(r.id)} title="Copy a link that lets anyone watch">Share</button>
                    {confirm === r.id ? (
                      <>
                        <button className="danger" onClick={() => void remove(r.id)}>Delete for good</button>
                        <button className="ghost" onClick={() => setConfirm(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="ghost" onClick={() => setConfirm(r.id)} aria-label="Delete this game"><IconTrash /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
