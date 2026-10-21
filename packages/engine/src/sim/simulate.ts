import { applyAction, currentPlayer } from '../engine';
import { Rng } from '../rng';
import { createGame } from '../setup';
import type { CountryDef, PlayerId } from '../types';
import type { Policy } from './policies';

/**
 * Synthetic world used until the real Worldometers dataset is wired in. Tier weights roughly
 * mirror the real distribution (lots of tiny countries, a handful of giants).
 */
const TIER_WEIGHTS = [42, 12, 15, 9, 6, 4, 4, 3, 5]; // soldiers 1..9, percent
const TIER_RANGE: Array<[number, number]> = [
  [10_000, 5_000_000],
  [5_000_001, 10_000_000],
  [10_000_001, 25_000_000],
  [25_000_001, 50_000_000],
  [50_000_001, 75_000_000],
  [75_000_001, 100_000_000],
  [100_000_001, 125_000_000],
  [125_000_001, 150_000_000],
  [150_000_001, 1_400_000_000],
];

export function syntheticCountries(seed = 1, count = 235): CountryDef[] {
  const rng = new Rng(seed);
  const total = TIER_WEIGHTS.reduce((a, b) => a + b, 0);
  const out: CountryDef[] = [];
  for (let i = 0; i < count; i++) {
    let r = rng.next() * total;
    let tier = 0;
    while (tier < TIER_WEIGHTS.length - 1 && r >= (TIER_WEIGHTS[tier] as number)) {
      r -= TIER_WEIGHTS[tier] as number;
      tier++;
    }
    const [lo, hi] = TIER_RANGE[tier] as [number, number];
    out.push({ code: `C${String(i).padStart(3, '0')}`, name: `Country ${i}`, population: rng.int(lo, hi) });
  }
  return out;
}

export interface Contestant {
  label: string;
  policy: Policy;
}

export interface GameResult {
  finished: boolean;
  rounds: number;
  winnerId: PlayerId | null;
  winnerLabel: string | null;
  /** Position of the winner in the turn order (0 = went first). */
  winnerSeat: number | null;
  decisions: number;
  attacks: number;
  conquests: number;
}

export interface PlayGameOptions {
  seed: number;
  countries: readonly CountryDef[];
  /** Called once per game with the ten player ids in turn order; return one contestant per player. */
  assign: (playerIds: PlayerId[], humanId: PlayerId) => Record<PlayerId, Contestant>;
  maxRounds?: number;
}

export function playGame(options: PlayGameOptions): GameResult {
  const maxRounds = options.maxRounds ?? 300;
  const humanCode = (options.countries[Number(options.seed) % options.countries.length] as CountryDef).code;
  let { state } = createGame({ id: `sim-${options.seed}`, seed: options.seed, allCountries: options.countries, humanCode });
  const order = state.players.map((p) => p.id);
  const contestants = options.assign(order, humanCode);

  let decisions = 0;
  let attacks = 0;
  let conquests = 0;

  while (state.phase !== 'finished' && state.round <= maxRounds) {
    const who = currentPlayer(state).id;
    const d = (contestants[who] as Contestant).policy(state);
    const r = applyAction(state, d.action);
    state = r.state;
    decisions++;
    if (d.action.type === 'startAttack') attacks++;
    for (const e of r.events) if (e.type === 'territoryConquered') conquests++;
  }

  const finished = state.phase === 'finished';
  const winnerId = state.winnerId;
  return {
    finished,
    rounds: state.round,
    winnerId,
    winnerLabel: winnerId ? (contestants[winnerId] as Contestant).label : null,
    winnerSeat: winnerId ? order.indexOf(winnerId) : null,
    decisions,
    attacks,
    conquests,
  };
}