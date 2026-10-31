import { currentPlayer, territoriesOf } from '../engine';
import { captureGain } from '../soldiers';
import type { Action, GameState, NpcDecisionKind, NpcMetrics, PlayerId, Territory } from '../types';
import { expectedAttackerLosses, winProbability } from './odds';
import type { NpcProfile } from './profiles';

export interface Decision {
  kind: NpcDecisionKind;
  action: Action;
  reason: string;
  metrics?: NpcMetrics;
}

export interface AttackPlan {
  from: Territory;
  to: Territory;
  pool: number;
  force: number;
  winProbability: number;
  expectedLosses: number;
  value: number;
  utility: number;
}

interface PlanOptions {
  bonus?: Record<string, number>;
  onlySource?: string;
  ignoreThresholds?: boolean;
}

const POOL_PENALTY = 0.02;

const pct = (p: number): string => `${Math.round(p * 100)}%`;
const one = (n: number): string => (Math.round(n * 10) / 10).toString();

function soldierCost(total: number, profile: NpcProfile): number {
  return profile.riskAversion / (1 + total / 25);
}

function totalSoldiers(state: GameState, playerId: PlayerId): number {
  let n = 0;
  for (const t of Object.values(state.territories)) if (t.ownerId === playerId) n += t.soldiers;
  return n;
}

export function isTargetable(state: GameState, t: Territory): boolean {
  const owner = state.players.find((p) => p.id === t.ownerId);
  return owner ? owner.hasTakenFirstTurn : false;
}

export function garrisonTarget(state: GameState, me: PlayerId, profile: NpcProfile): number {
  const mine = territoriesOf(state, me);
  if (mine.length === 0) return profile.garrison;
  const army = mine.reduce((n, t) => n + t.soldiers, 0);
  let strike = 0;
  for (const p of state.players) {
    if (p.id === me || p.eliminated) continue;
    if (!p.hasTakenFirstTurn) continue;
    const owned = territoriesOf(state, p.id);
    if (owned.length === 0) continue;
    const total = owned.reduce((n, t) => n + t.soldiers, 0);
    strike = Math.max(strike, total + owned.length + 1);
  }
  const cap = Math.max(profile.garrison, Math.floor((profile.defenceShare * army) / mine.length));
  let g = profile.garrison;
  while (g < cap && winProbability(strike, g) > profile.safety) g++;
  return g;
}

export function pickVictim(state: GameState, me: PlayerId): PlayerId | null {
  let victim: PlayerId | null = null;
  let bestStrength = Infinity;
  let bestCount = Infinity;
  for (const p of state.players) {
    if (p.id === me || p.eliminated) continue;
    if (!p.hasTakenFirstTurn) continue;
    const owned = territoriesOf(state, p.id);
    if (owned.length === 0) continue;
    const strength = owned.reduce((n, t) => n + t.soldiers, 0);
    if (strength < bestStrength || (strength === bestStrength && owned.length < bestCount)) {
      victim = p.id;
      bestStrength = strength;
      bestCount = owned.length;
    }
  }
  return victim;
}

function captureValue(state: GameState, target: Territory, profile: NpcProfile, victim: PlayerId | null): number {
  const ownerCount = territoriesOf(state, target.ownerId).length;
  const income = 2 * profile.horizon;
  const gain = captureGain(target.baseValue);
  const elimination = ownerCount === 1 ? profile.eliminationBonus : 0;
  const impatience = 1 + Math.max(0, state.round - profile.impatienceStart) / profile.impatienceScale;
  const focus = target.ownerId === victim ? 1 + profile.focus : 1;
  const ownerArmy = territoriesOf(state, target.ownerId).reduce((n, t) => n + t.soldiers, 0);
  const share = ownerArmy > 0 ? target.soldiers / ownerArmy : 0;
  const decapitation = 1 + profile.decapitation * share;
  return (income + gain + elimination) * impatience * focus * decapitation;
}

export function bestAttackPlan(
  state: GameState,
  playerId: PlayerId,
  profile: NpcProfile,
  options: PlanOptions = {},
): AttackPlan | null {
  const bonus = options.bonus ?? {};
  const mine = territoriesOf(state, playerId).map((t) => ({ t, soldiers: t.soldiers + (bonus[t.code] ?? 0) }));
  const enemies = Object.values(state.territories).filter(
    (t) => t.ownerId !== playerId && isTargetable(state, t),
  );
  const lambda = soldierCost(
    state.phase === 'finished' ? 0 : mine.reduce((n, m) => n + m.soldiers, 0),
    profile,
  );

  const victim = pickVictim(state, playerId);
  const g = garrisonTarget(state, playerId, profile);
  let best: (AttackPlan & { score: number }) | null = null;

  for (const src of mine) {
    if (options.onlySource && src.t.code !== options.onlySource) continue;
    let surplus = 0;
    for (const other of mine) {
      if (other !== src) surplus += Math.max(0, other.soldiers - g);
    }

    for (const enemy of enemies) {
      const value = captureValue(state, enemy, profile, victim);
      let pick: { k: number; p: number; l: number; util: number; score: number } | null = null;

      for (let k = 0; k <= surplus; k++) {
        const force = src.soldiers + k;
        if (force < 2) continue;
        const p = winProbability(force, enemy.soldiers);
        const l = expectedAttackerLosses(force, enemy.soldiers);
        const util = p * value - lambda * l;
        const score = util - POOL_PENALTY * k;
        if (!pick || score > pick.score) pick = { k, p, l, util, score };
      }
      if (!pick) continue;
      if (!options.ignoreThresholds && (pick.p < profile.minWinProbability || pick.util < profile.minUtility)) continue;

      if (!best || pick.score > best.score) {
        best = {
          from: src.t,
          to: enemy,
          pool: pick.k,
          force: src.soldiers + pick.k,
          winProbability: pick.p,
          expectedLosses: pick.l,
          value,
          utility: pick.util,
          score: pick.score,
        };
      }
    }
  }
  if (!best) return null;
  const { score: _score, ...plan } = best;
  return plan;
}

function decideAllocate(state: GameState, me: PlayerId, profile: NpcProfile): Decision {
  const mine = territoriesOf(state, me);
  const alloc: Record<string, number> = {};
  const held = new Map(mine.map((t) => [t.code, t.soldiers]));
  const g = garrisonTarget(state, me, profile);
  let left = state.reinforcementsPending;
  let gapSoldiers = 0;
  const gapNames: string[] = [];

  while (left > 0) {
    let worst: Territory | null = null;
    let worstGap = 0;
    for (const t of mine) {
      const gap = g - (held.get(t.code) as number);
      if (gap > worstGap) {
        worstGap = gap;
        worst = t;
      }
    }
    if (!worst) break;
    alloc[worst.code] = (alloc[worst.code] ?? 0) + 1;
    held.set(worst.code, (held.get(worst.code) as number) + 1);
    left--;
    gapSoldiers++;
    if (!gapNames.includes(worst.name)) gapNames.push(worst.name);
  }

  const parts: string[] = [];
  if (gapSoldiers > 0) parts.push(`${gapSoldiers} to shore up thin defences (${gapNames.join(', ')})`);

  if (left > 0) {
    let sink: Territory | null = null;
    let sinkPlan: AttackPlan | null = null;
    for (const t of mine) {
      const hypothetical = { ...alloc, [t.code]: (alloc[t.code] ?? 0) + left };
      const plan = bestAttackPlan(state, me, profile, { bonus: hypothetical, onlySource: t.code });
      if (plan && (!sinkPlan || plan.utility > sinkPlan.utility)) {
        sink = t;
        sinkPlan = plan;
      }
    }
    if (!sink) {
      sink = mine.reduce((a, b) => ((held.get(b.code) as number) > (held.get(a.code) as number) ? b : a));
      parts.push(`${left} massed on ${sink.name}, my strongest country (no attack looks worthwhile yet)`);
    } else if (sinkPlan) {
      parts.push(
        `${left} massed on ${sink.name} to prepare an attack on ${sinkPlan.to.name} (${pct(sinkPlan.winProbability)} win chance)`,
      );
    }
    alloc[sink.code] = (alloc[sink.code] ?? 0) + left;
  }

  return {
    kind: 'allocate',
    action: { type: 'allocate', playerId: me, allocations: alloc },
    reason: `Reinforcements: ${parts.join('; ')}.`,
  };
}

function rebalance(state: GameState, me: PlayerId, profile: NpcProfile): Decision | null {
  const mine = territoriesOf(state, me);
  const g = garrisonTarget(state, me, profile);
  const needy = mine
    .filter((t) => t.soldiers < g)
    .sort((a, b) => a.soldiers - b.soldiers || a.code.localeCompare(b.code));
  const donors = mine
    .filter((t) => t.soldiers > g)
    .sort((a, b) => b.soldiers - a.soldiers || a.code.localeCompare(b.code));
  const to = needy[0];
  const from = donors[0];
  if (!to || !from) return null;
  const count = Math.min(g - to.soldiers, from.soldiers - g);
  if (count < 1) return null;
  return {
    kind: 'transfer',
    action: { type: 'transfer', playerId: me, from: from.code, to: to.code, count },
    reason: `Moving ${count} from ${from.name} to ${to.name}, which is dangerously thin.`,
  };
}

function decideAction(state: GameState, me: PlayerId, profile: NpcProfile): Decision {
  const mine = territoriesOf(state, me);
  const g = garrisonTarget(state, me, profile);

  if (!state.attackUsed) {
    const plan = bestAttackPlan(state, me, profile);
    if (plan) {
      const metrics: NpcMetrics = {
        winProbability: plan.winProbability,
        expectedLosses: plan.expectedLosses,
        utility: plan.utility,
      };
      if (plan.pool > 0) {
        const donor = mine
          .filter((t) => t.code !== plan.from.code && t.soldiers > g)
          .sort((a, b) => b.soldiers - a.soldiers || a.code.localeCompare(b.code))[0] as Territory;
        const count = Math.min(plan.pool, donor.soldiers - g);
        return {
          kind: 'transfer',
          action: { type: 'transfer', playerId: me, from: donor.code, to: plan.from.code, count },
          reason: `Massing ${count} soldiers from ${donor.name} onto ${plan.from.name} to attack ${plan.to.name}.`,
          metrics,
        };
      }
      return {
        kind: 'attack',
        action: { type: 'startAttack', playerId: me, from: plan.from.code, to: plan.to.code },
        reason:
          `Attacking ${plan.to.name} from ${plan.from.name} (${plan.from.soldiers} vs ${plan.to.soldiers}): ` +
          `${pct(plan.winProbability)} to win, expect to lose ~${one(plan.expectedLosses)} soldiers, ` +
          `capturing is worth ~${one(plan.value)} soldiers.`,
        metrics,
      };
    }
  }

  const fix = rebalance(state, me, profile);
  if (fix) return fix;

  let reason: string;
  if (state.attackUsed) {
    reason = 'Attack for this turn is finished and my defences are in order, so I end my turn.';
  } else {
    const best = bestAttackPlan(state, me, profile, { ignoreThresholds: true });
    reason = best
      ? `No attack clears my bar (best was ${best.to.name}: ${pct(best.winProbability)} win chance, ` +
        `~${one(best.expectedLosses)} expected losses). Holding position and building strength.`
      : 'Nothing to attack. Ending my turn.';
  }
  return { kind: 'endTurn', action: { type: 'endTurn', playerId: me }, reason };
}

function decideContinue(state: GameState, me: PlayerId, profile: NpcProfile): Decision {
  const atk = state.attack as NonNullable<GameState['attack']>;
  const from = state.territories[atk.from] as Territory;
  const to = state.territories[atk.to] as Territory;
  const p = winProbability(from.soldiers, to.soldiers);
  const l = expectedAttackerLosses(from.soldiers, to.soldiers);
  const value = captureValue(state, to, profile, pickVictim(state, me));
  const lambda = soldierCost(totalSoldiers(state, me), profile);
  const utility = p * value - lambda * l;
  const metrics: NpcMetrics = { winProbability: p, expectedLosses: l, utility };

  if (utility > profile.stopMargin) {
    return {
      kind: 'continue',
      action: { type: 'roll', playerId: me },
      reason:
        atk.rounds === 0
          ? `Opening the assault on ${to.name}: ${from.soldiers} vs ${to.soldiers}, ${pct(p)} to win.`
          : `Pressing on against ${to.name} (${from.soldiers} vs ${to.soldiers}): ${pct(p)} to win, ` +
            `~${one(l)} more losses expected.`,
      metrics,
    };
  }
  return {
    kind: 'stop',
    action: { type: 'stopAttack', playerId: me },
    reason:
      `Breaking off the attack on ${to.name}: only ${pct(p)} to win from ${from.soldiers} vs ${to.soldiers}, ` +
      `~${one(l)} more losses not worth it. Preserving my forces.`,
    metrics,
  };
}

function decideCapture(state: GameState, me: PlayerId, profile: NpcProfile): Decision {
  const cap = state.capture as NonNullable<GameState['capture']>;
  const from = state.territories[cap.from] as Territory;
  const to = state.territories[cap.to] as Territory;
  const move = Math.max(0, Math.min(from.soldiers - 1, garrisonTarget(state, me, profile) - to.soldiers));
  return {
    kind: 'capture',
    action: { type: 'completeCapture', playerId: me, move },
    reason:
      move > 0
        ? `${to.name} is mine. Moving ${move} more from ${from.name} so it is not an easy target.`
        : `${to.name} is mine and already has ${to.soldiers} soldiers; keeping the rest on ${from.name}.`,
  };
}

export function decideNpc(state: GameState, profile: NpcProfile): Decision {
  if (state.phase === 'finished') throw new Error('The game is over.');
  const me = currentPlayer(state).id;
  switch (state.phase) {
    case 'reinforce':
      return decideAllocate(state, me, profile);
    case 'action':
      return decideAction(state, me, profile);
    case 'attacking':
      return decideContinue(state, me, profile);
    case 'capture':
      return decideCapture(state, me, profile);
  }
}