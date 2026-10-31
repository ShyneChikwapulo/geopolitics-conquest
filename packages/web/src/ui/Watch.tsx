import { useEffect, useState } from 'react';
import type { GameState } from '@conquest/engine';
import { GameProvider } from '../game/GameProvider';
import { GameView } from '../GameView';
import { loadAllGames } from '../game/localStore';

import { COUNTRIES } from '@conquest/data';
import { MAP_FEATURES, MAP_HEIGHT, MAP_WIDTH, projectCentroid } from '../map/useMapProjection';
import { PLAYER_COLORS } from '../map/WorldMap';
import { SoldierBadge } from '../map/SoldierBadge';

export function Watch({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'firestore' | 'local' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Prefer Firestore if configured.
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      if (projectId) {
        try {
          const { initFirebase } = await import('../game/firebaseClient');
          const { watchGame } = await initFirebase();
          const unsub = watchGame(gameId, (s) => {
            if (cancelled) return;
            setState(s);
            setSource('firestore');
          });
          return () => unsub();
        } catch (e: any) {
          if (!cancelled) setError(e?.message ?? 'Firestore error');
        }
      }
      // Fallback: local games with this id.
      const local = loadAllGames().find((g) => g.id === gameId) ?? null;
      if (!cancelled) {
        if (local) { setState(local); setSource('local'); }
        else setError('Game not found.');
      }
    })();
    return () => { cancelled = true; };
  }, [gameId]);

  if (error) {
    return (
      <div className="battle-overlay">
        <div className="battle-card">
          <h3>Watch</h3>
          <p className="muted">{error}</p>
          <button className="primary" onClick={onClose}>Back</button>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="battle-overlay">
        <div className="battle-card">
          <h3>Loading game…</h3>
        </div>
      </div>
    );
  }

  // We reuse GameProvider with a fake humanCode and lock the dispatch. The map and player
  // list render read-only; the action panel still shows but any dispatch is blocked because
  // we never pass a humanCode that matches a player.
  const firstPlayer = state.players[0]!.id;

  return (
    <div className="game-view">
      <header className="game-header">
        <h1>👁 Watching a game {source ? `(${source})` : ''}</h1>
        <span className="game-meta">Round {state.round}</span>
        <button onClick={onClose}>Leave</button>
      </header>
      <main className="game-main">
        <section className="game-map">
          <WatchMap game={state} />
        </section>
        <aside className="game-sidebar">
          <WatchLog game={state} />
        </aside>
      </main>
    </div>
  );
}

// Simple read-only map: reuse the same colour palette and country shapes.
function WatchMap({ game }: { game: GameState }) {
  const { COUNTRIES } = require('@conquest/data') as typeof import('@conquest/data');
  const { MAP_FEATURES, MAP_HEIGHT, MAP_WIDTH, projectCentroid } = require('../map/useMapProjection') as typeof import('../map/useMapProjection');
  const { PLAYER_COLORS } = require('../map/WorldMap') as typeof import('../map/WorldMap');
  const { SoldierBadge } = require('../map/SoldierBadge') as typeof import('../map/SoldierBadge');
  const numericToCountry = new Map(COUNTRIES.map((c) => [c.numeric, c]));

  return (
    <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="world-map" preserveAspectRatio="xMidYMid slice">
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#2a2318" />
      <image href="/paper.jpg" x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="xMidYMid slice" />
      {MAP_FEATURES.map((f) => {
        const country = numericToCountry.get(f.id);
        if (!f.d || !country) return null;
        const territory = game.territories[country.code];
        const player = game.players.find((p) => p.id === territory?.ownerId);
        const fill = player ? PLAYER_COLORS[player.colorIndex] : '#5c5140';
        return (
          <path key={country.code} d={f.d} fill={fill} stroke="#3a2f1f" strokeWidth={0.4}
            className={`country-shape ${territory ? 'in-play' : 'not-in-play'}`} />
        );
      })}
      {COUNTRIES.map((c) => {
        const t = game.territories[c.code];
        if (!t) return null;
        const [x, y] = projectCentroid(c.lng, c.lat);
        const player = game.players.find((p) => p.id === t.ownerId);
        return <SoldierBadge key={c.code} x={x} y={y} soldiers={t.soldiers}
          color={player ? PLAYER_COLORS[player.colorIndex] : '#8a7c66'} />;
      })}
    </svg>
  );
}

function WatchLog({ game }: { game: GameState }) {
  return (
    <div className="player-list">
      <h3>Players</h3>
      <ul>
        {game.players.map((p) => {
          const owned = Object.values(game.territories).filter((t) => t.ownerId === p.id);
          return (
            <li key={p.id} className={p.eliminated ? 'eliminated' : ''}>
              <span className="name">{p.name}</span>
              <span className="stats">{owned.length} · {owned.reduce((a, t) => a + t.soldiers, 0)} s</span>
            </li>
          );
        })}
      </ul>
      <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
        Round {game.round} · last updated v{game.version}
      </p>
    </div>
  );
}