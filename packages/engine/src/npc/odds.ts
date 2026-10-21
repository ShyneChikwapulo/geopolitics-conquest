/**
 * Exact battle odds for this game's combat rules.
 *
 * Key insight: dice are paired 1:1 and NOT sorted, so every pair is an independent contest
 * where P(attacker wins) = P(defender wins) = 15/36 and P(tie) = 6/36. Ties change nothing,
 * so the battle is equivalent to repeatedly flipping a FAIR coin: heads = the defender loses
 * a soldier, tails = the attacker loses one.
 *
 * With A = attackerSoldiers - 1 (one must stay behind) and D = defenderSoldiers, the attack
 * ends when D heads or A tails have occurred, whichever comes first:
 *   P(conquer)   = P(Binomial(A + D - 1, 1/2) >= D)
 *   E[tau]       = expected number of decisive flips
 *   E[attacker losses] = E[defender losses] = E[tau] / 2   (heads - tails is a martingale)
 *
 * Both satisfy the same simple recurrence, so we tabulate them once.
 */

const MAX = 200; // table covers up to 200 attacking dice vs 200 defenders
const W = MAX + 1;

let winTable: Float64Array | null = null;
let flipTable: Float64Array | null = null;

function build(): void {
  const win = new Float64Array(W * W);
  const flips = new Float64Array(W * W);
  for (let a = 0; a <= MAX; a++) {
    for (let d = 0; d <= MAX; d++) {
      const i = a * W + d;
      if (d === 0) {
        win[i] = 1;
        flips[i] = 0;
      } else if (a === 0) {
        win[i] = 0;
        flips[i] = 0;
      } else {
        win[i] = 0.5 * (win[(a - 1) * W + d] as number) + 0.5 * (win[a * W + d - 1] as number);
        flips[i] = 1 + 0.5 * (flips[(a - 1) * W + d] as number) + 0.5 * (flips[a * W + d - 1] as number);
      }
    }
  }
  winTable = win;
  flipTable = flips;
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp((-x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Probability that an attacker with `attackerSoldiers` conquers a defender with `defenderSoldiers`. */
export function winProbability(attackerSoldiers: number, defenderSoldiers: number): number {
  const a = Math.max(0, attackerSoldiers - 1);
  const d = Math.max(0, defenderSoldiers);
  if (d === 0) return 1;
  if (a === 0) return 0;
  if (a <= MAX && d <= MAX) {
    if (!winTable) build();
    return (winTable as Float64Array)[a * W + d] as number;
  }
  // Very large armies: normal approximation of Binomial(a + d - 1, 1/2) >= d.
  const n = a + d - 1;
  const z = (d - 0.5 - n / 2) / (Math.sqrt(n) / 2);
  return 1 - normalCdf(z);
}

/** Expected number of soldiers the attacker will still lose before the attack resolves. */
export function expectedAttackerLosses(attackerSoldiers: number, defenderSoldiers: number): number {
  const a = Math.max(0, attackerSoldiers - 1);
  const d = Math.max(0, defenderSoldiers);
  if (a === 0 || d === 0) return 0;
  if (a <= MAX && d <= MAX) {
    if (!flipTable) build();
    return ((flipTable as Float64Array)[a * W + d] as number) / 2;
  }
  return Math.min(a, d); // rough upper-ish estimate for very large armies
}