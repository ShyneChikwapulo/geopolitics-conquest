import { AGGRESSIVE, BALANCED, DEFENSIVE, type NpcProfile } from '../src/npc';
import { npcPolicy, playGame, randomPolicy, syntheticCountries, type Contestant, type GameResult } from '../src/sim';

const games = Number(process.argv[2] ?? 300);
const countries = syntheticCountries(7);

function run(title: string, build: (seed: number) => (ids: string[], humanId: string) => Record<string, Contestant>) {
  const t0 = Date.now();
  const results: GameResult[] = [];
  for (let seed = 1; seed <= games; seed++) {
    results.push(playGame({ seed, countries, assign: build(seed), maxRounds: 300 }));
  }
  const finished = results.filter((r) => r.finished);
  const rounds = finished.map((r) => r.rounds).sort((a, b) => a - b);
  const q = (p: number) => rounds[Math.min(rounds.length - 1, Math.floor(p * rounds.length))] ?? NaN;
  const wins = new Map<string, number>();
  const seats = new Array(10).fill(0) as number[];
  for (const r of finished) {
    wins.set(r.winnerLabel as string, (wins.get(r.winnerLabel as string) ?? 0) + 1);
    seats[r.winnerSeat as number]!++;
  }
  console.log(`\n=== ${title} (${games} games, ${((Date.now() - t0) / 1000).toFixed(1)}s) ===`);
  console.log(`finished: ${finished.length}/${games}  rounds median ${q(0.5)}  p90 ${q(0.9)}  max ${rounds[rounds.length - 1]}`);
  console.log(`avg attacks/game ${(results.reduce((a, r) => a + r.attacks, 0) / games).toFixed(0)}  avg decisions ${(results.reduce((a, r) => a + r.decisions, 0) / games).toFixed(0)}`);
  console.log('wins by label:', Object.fromEntries([...wins.entries()].sort()));
  console.log('wins by turn-order seat (0 = first):', seats.join(' '));
}

const everyone = (profile: NpcProfile) => (seed: number) => (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { label: profile.name, policy: npcPolicy(profile) }])) as Record<string, Contestant>;

const heroVs = (hero: NpcProfile | 'random', field: NpcProfile | 'random') => (seed: number) => (ids: string[], humanId: string) =>
  Object.fromEntries(
    ids.map((id, i) => {
      const p = id === humanId ? hero : field;
      const label = id === humanId ? `HERO:${p === 'random' ? 'random' : p.name}` : `field:${p === 'random' ? 'random' : p.name}`;
      return [id, { label, policy: p === 'random' ? randomPolicy(seed * 100 + i) : npcPolicy(p) }];
    }),
  ) as Record<string, Contestant>;

run('Self-play: all balanced', everyone(BALANCED));
run('Hero balanced vs 9 random', heroVs(BALANCED, 'random'));
run('Hero balanced vs 9 balanced (control, expect ~10%)', heroVs(BALANCED, BALANCED));
run('Hero aggressive vs 9 balanced', heroVs(AGGRESSIVE, BALANCED));
run('Hero defensive vs 9 balanced', heroVs(DEFENSIVE, BALANCED));