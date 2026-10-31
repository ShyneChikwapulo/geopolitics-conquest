/**
 * Measures how hard each difficulty level really is.
 *
 * Yardstick: a competent player (the balanced heuristic standing in for you) plays against nine rivals at the
 * given level. Chance is 10%; a good difficulty setting makes the win rate FALL as the level goes up.
 *
 *   npm run report:difficulty -w @conquest/data -- 600
 */
import { BALANCED, DIFFICULTIES, applyAction, createGame, currentPlayer, decideNpc, makeDecider } from '@conquest/engine';
import type { Difficulty } from '@conquest/engine';
import { COUNTRIES } from '../src';

const games = Number(process.argv[2] ?? 300);
const levels: Difficulty[] = ['easy', 'medium', 'hard'];

console.log(`A balanced-heuristic "player" vs nine rivals at each level (${games} games each, chance = 10%)\n`);
for (const level of levels) {
  const decide = makeDecider(level);
  let wins = 0;
  let rounds = 0;
  for (let seed = 1; seed <= games; seed++) {
    const humanCode = COUNTRIES[seed % COUNTRIES.length]!.code;
    let { state } = createGame({ id: 'r', seed, allCountries: COUNTRIES, humanCode });
    while (state.phase !== 'finished' && state.round <= 300) {
      const me = currentPlayer(state);
      const d = me.isHuman ? decideNpc(state, BALANCED) : decide(state, DIFFICULTIES[level].profile);
      state = applyAction(state, d.action).state;
    }
    if (state.winnerId === humanCode) wins++;
    rounds += state.round;
  }
  const rate = (100 * wins) / games;
  const se = Math.sqrt((rate * (100 - rate)) / games);
  console.log(`${DIFFICULTIES[level].label.padEnd(7)} player wins ${rate.toFixed(1).padStart(5)}% ± ${se.toFixed(1)}   average game ${(rounds / games).toFixed(0)} rounds`);
}
