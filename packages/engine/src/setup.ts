import { Rng } from './rng';
import { soldiersForPopulation } from './soldiers';
import type { CountryCode, CountryDef, GameEvent, GameState, Player, Territory } from './types';

export const PLAYER_COUNT = 10;

export interface CreateGameOptions {
  id: string;
  seed: number;
  allCountries: readonly CountryDef[];
  humanCode: CountryCode;
}

export function createGame(options: CreateGameOptions): { state: GameState; events: GameEvent[] } {
  const { id, allCountries, humanCode } = options;
  const seed = options.seed >>> 0;

  const human = allCountries.find((c) => c.code === humanCode);
  if (!human) throw new Error(`Unknown country code: ${humanCode}`);

  const seen = new Set<string>([human.code]);
  const pool: CountryDef[] = [];
  for (const c of allCountries) {
    if (!seen.has(c.code)) {
      seen.add(c.code);
      pool.push(c);
    }
  }
  if (pool.length < PLAYER_COUNT - 1) {
    throw new Error(`Need at least ${PLAYER_COUNT} distinct countries to start a game.`);
  }

  const rng = new Rng(seed);
  const chosen = [human, ...rng.shuffle(pool).slice(0, PLAYER_COUNT - 1)];
  // Colour 0 is always the human; the turn order is then shuffled (random first player).
  const ordered = rng.shuffle(chosen.map((country, colorIndex) => ({ country, colorIndex })));

  const players: Player[] = ordered.map(({ country, colorIndex }) => ({
    id: country.code,
    name: country.name,
    homeCountry: country.code,
    isHuman: country.code === human.code,
    colorIndex,
    eliminated: false,
  }));

  const territories: Record<CountryCode, Territory> = {};
  for (const { country } of ordered) {
    const base = soldiersForPopulation(country.population);
    territories[country.code] = {
      code: country.code,
      name: country.name,
      ownerId: country.code,
      soldiers: base,
      baseValue: base,
    };
  }

  const state: GameState = {
    id,
    seed,
    rngState: rng.state,
    players,
    territories,
    currentPlayerIndex: 0,
    round: 1,
    phase: 'action', // no reinforcements in round 1
    reinforcementsPending: 0,
    attackUsed: false,
    attack: null,
    capture: null,
    winnerId: null,
    version: 0,
  };

  const first = players[0] as Player;
  const events: GameEvent[] = [
    { type: 'gameStarted', gameId: id, humanPlayerId: human.code, turnOrder: players.map((p) => p.id) },
    { type: 'turnStarted', playerId: first.id, round: 1 },
  ];
  return { state, events };
}