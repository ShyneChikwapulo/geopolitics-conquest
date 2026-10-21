/** Balance report using the REAL country list (instead of the synthetic one in the engine). */
import { applyAction, BALANCED, createGame, decideNpc, npcPolicy, playGame, randomPolicy, soldiersForPopulation } from '@conquest/engine';
import type { Contestant } from '@conquest/engine';
import { COUNTRIES } from '../src';

const games = Number(process.argv[2] ?? 300);

const tiers = new Array(10).fill(0) as number[];
for (const c of COUNTRIES) tiers[soldiersForPopulation(c.population)]!++;
console.log('countries per soldier tier:', tiers.slice(1).map((n, i) => `${i + 1}:${n}`).join('  '));

const all = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, { label: 'balanced', policy: npcPolicy(BALANCED) }])) as Record<string, Contestant>;
const heroVsRandom = (seed: number) => (ids: string[], humanId: string) =>
  Object.fromEntries(
    ids.map((id, i) => [
      id,
      id === humanId
        ? { label: 'hero', policy: npcPolicy(BALANCED) }
        : { label: 'random', policy: randomPolicy(seed * 100 + i) },
    ]),
  ) as Record<string, Contestant>;

function report(title: string, assign: (seed: number) => (ids: string[], humanId: string) => Record<string, Contestant>) {
  const rounds: number[] = [];
  const wins = new Map<string, number>();
  const seats = new Array(10).fill(0) as number[];
  let unfinished = 0;
  for (let seed = 1; seed <= games; seed++) {
    const r = playGame({ seed, countries: COUNTRIES, assign: assign(seed), maxRounds: 300 });
    if (!r.finished) { unfinished++; continue; }
    rounds.push(r.rounds);
    wins.set(r.winnerLabel!, (wins.get(r.winnerLabel!) ?? 0) + 1);
    seats[r.winnerSeat!]!++;
  }
  rounds.sort((a, b) => a - b);
  const q = (p: number) => rounds[Math.min(rounds.length - 1, Math.floor(p * rounds.length))];
  console.log(`\n=== ${title} (${games} games) ===`);
  console.log(`unfinished: ${unfinished}  rounds median ${q(0.5)}  p90 ${q(0.9)}  max ${rounds[rounds.length - 1]}`);
  console.log('wins:', Object.fromEntries(wins));
  console.log('wins by seat (0 = first):', seats.join(' '));
}

report('Self-play, real countries', () => all);
report('1 balanced NPC vs 9 random, real countries', heroVsRandom);

// Opening wipe-out rate: eliminated during round 1 before getting a turn.
const wiped = new Array(10).fill(0) as number[];
for (let seed = 1; seed <= games; seed++) {
  let { state } = createGame({ id: 's', seed, allCountries: COUNTRIES, humanCode: COUNTRIES[seed % COUNTRIES.length]!.code });
  const order = state.players.map((p) => p.id);
  const acted = new Set<string>();
  while (state.phase !== 'finished' && state.round === 1) {
    acted.add(state.players[state.currentPlayerIndex]!.id);
    state = applyAction(state, decideNpc(state, BALANCED).action).state;
  }
  order.forEach((id, seat) => {
    if (!acted.has(id) && state.players.find((p) => p.id === id)!.eliminated) wiped[seat]!++;
  });
}
console.log('\n% eliminated before their first turn, by seat:', wiped.map((n) => `${Math.round((100 * n) / games)}%`).join(' '));