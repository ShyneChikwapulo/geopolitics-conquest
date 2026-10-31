import { useEffect, useState } from 'react';
import { loadAllGames } from '../game/localStore';
import type { GameState } from '@conquest/engine';

interface PlayerStat {
  name: string;
  games: number;
  wins: number;
  countriesHeldAtEnd: number;
  soldiersHeldAtEnd: number;
}

interface CountryStat {
  name: string;
  gamesAsHome: number;
  winsAsHome: number;
}

export function Analytics() {
  const [stats, setStats] = useState<{
    games: number;
    avgRounds: number;
    perPlayer: PlayerStat[];
    perCountry: CountryStat[];
    seatWins: number[];
  } | null>(null);

  useEffect(() => {
    const games = loadAllGames() as GameState[];
    const perPlayer = new Map<string, PlayerStat>();
    const perCountry = new Map<string, CountryStat>();
    const seatWins = new Array(10).fill(0) as number[];
    let totalRounds = 0;

    for (const g of games) {
      totalRounds += g.round;
      const winner = g.players.find((p) => p.id === g.winnerId);
      if (winner) seatWins[g.players.indexOf(winner)]!++;

      for (const p of g.players) {
        const cur = perPlayer.get(p.name) ?? {
          name: p.name, games: 0, wins: 0, countriesHeldAtEnd: 0, soldiersHeldAtEnd: 0,
        };
        cur.games++;
        if (p.id === g.winnerId) cur.wins++;
        const owned = Object.values(g.territories).filter((t) => t.ownerId === p.id);
        cur.countriesHeldAtEnd += owned.length;
        cur.soldiersHeldAtEnd += owned.reduce((a, t) => a + t.soldiers, 0);
        perPlayer.set(p.name, cur);

        const homeCode = p.homeCountry;
        const homeName = g.territories[homeCode]?.name ?? homeCode;
        const c = perCountry.get(homeName) ?? { name: homeName, gamesAsHome: 0, winsAsHome: 0 };
        c.gamesAsHome++;
        if (p.id === g.winnerId) c.winsAsHome++;
        perCountry.set(homeName, c);
      }
    }

    setStats({
      games: games.length,
      avgRounds: games.length ? Math.round(totalRounds / games.length) : 0,
      perPlayer: [...perPlayer.values()].sort((a, b) => b.wins - a.wins || b.games - a.games).slice(0, 10),
      perCountry: [...perCountry.values()]
        .sort((a, b) => b.winsAsHome - a.winsAsHome || b.gamesAsHome - a.gamesAsHome)
        .slice(0, 10),
      seatWins,
    });
  }, []);

  if (!stats || stats.games === 0) {
    return (
      <div className="analytics">
        <h3>Analytics</h3>
        <p className="muted">Play a game to see your stats.</p>
      </div>
    );
  }

  const maxSeat = Math.max(...stats.seatWins, 1);

  return (
    <div className="analytics">
      <h3>Analytics</h3>
      <p>
        <strong>{stats.games}</strong> {stats.games === 1 ? 'game' : 'games'} played · avg <strong>{stats.avgRounds}</strong> rounds
      </p>

      <h4>Win rate by seat</h4>
      <div className="seat-bars">
        {stats.seatWins.map((w, i) => (
          <div key={i} className="seat-bar" title={`Seat ${i + 1}: ${w} wins`}>
            <div className="seat-bar-fill" style={{ height: `${(w / maxSeat) * 100}%` }} />
            <span className="seat-bar-label">{i + 1}</span>
          </div>
        ))}
      </div>

      <h4>Players</h4>
      <table className="analytics-table">
        <thead>
          <tr><th>Player</th><th>Games</th><th>Wins</th><th>Avg countries</th><th>Avg soldiers</th></tr>
        </thead>
        <tbody>
          {stats.perPlayer.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              <td>{p.games}</td>
              <td>{p.wins}</td>
              <td>{(p.countriesHeldAtEnd / p.games).toFixed(1)}</td>
              <td>{(p.soldiersHeldAtEnd / p.games).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Countries (as home)</h4>
      <table className="analytics-table">
        <thead>
          <tr><th>Country</th><th>Games</th><th>Wins</th><th>Win rate</th></tr>
        </thead>
        <tbody>
          {stats.perCountry.map((c) => (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td>{c.gamesAsHome}</td>
              <td>{c.winsAsHome}</td>
              <td>{c.gamesAsHome > 0 ? Math.round((100 * c.winsAsHome) / c.gamesAsHome) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}