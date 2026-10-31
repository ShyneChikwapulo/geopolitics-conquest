import { useState } from 'react';
import type { CountryRecord } from '@conquest/data';
import { soldiersForPopulation } from '@conquest/engine';
import { History } from './History';
import { Analytics } from './Analytics';
import { Logo } from './Logo';
import { HowToPlay } from './HowToPlay';
import type { Difficulty } from '../game/GameProvider';

export function StartScreen({ countries, onStart, onReplay }: {
  countries: readonly CountryRecord[];
  onStart: (human: string, seed: number, difficulty: Difficulty) => void;
  onReplay: (id: string) => void;
}) {
  const [code, setCode] = useState(countries[0]!.code);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [helpOpen, setHelpOpen] = useState(false);
  const sorted = [...countries].sort((a, b) => a.rank - b.rank);
  const soldiers = soldiersForPopulation(countries.find((c) => c.code === code)!.population);

  return (
    <div className="start-screen">
      <div className="start-hero">
        <Logo size={64} variant="gold" />
        <h1>Geopolitics Conquest</h1>
        <p>Pick your country. Conquer the other 9. Win the world.</p>
      </div>

      <div className="start-form">
        <label>
          Your country
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            {sorted.map((c) => (
              <option key={c.code} value={c.code}>
                #{c.rank} {c.name} ({soldiersForPopulation(c.population)} soldiers)
              </option>
            ))}
          </select>
        </label>

        <label>
          Difficulty
          <div className="difficulty-row">
            {(['easy', 'medium', 'hard'] as const).map((d) => (
              <button
                key={d}
                type="button"
                className={difficulty === d ? 'primary' : ''}
                onClick={() => setDifficulty(d)}
              >
                {d === 'easy' ? 'Easy' : d === 'medium' ? 'Medium' : 'Hard'}
              </button>
            ))}
          </div>
        </label>

        <label>
          Seed
          <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} />
        </label>

        <button className="primary" onClick={() => onStart(code, seed, difficulty)}>
          Start with {soldiers} soldiers
        </button>

        <button type="button" onClick={() => setHelpOpen(true)}>How to play</button>
      </div>

      <History onReplay={onReplay} />
      <Analytics />
      {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}
    </div>
  );
}