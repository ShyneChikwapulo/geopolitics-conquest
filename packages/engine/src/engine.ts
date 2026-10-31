import { rollRound } from './combat';
import { Rng, type DiceRoller } from './rng';
import { captureGain } from './soldiers';
import type {
  Action,
  AttackInProgress,
  GameEvent,
  GameState,
  Player,
  PlayerId,
  Territory,
} from './types';

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export interface ApplyOptions {
  roller?: DiceRoller;
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}

export function currentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex] as Player;
}

export function territoriesOf(state: GameState, playerId: PlayerId): Territory[] {
  return Object.values(state.territories).filter((t) => t.ownerId === playerId);
}

export function validateAction(state: GameState, action: Action): string | null {
  if (state.phase === 'finished') return 'The game is over.';
  const player = currentPlayer(state);
  if (action.playerId !== player.id) return 'It is not your turn.';

  switch (action.type) {
    case 'allocate': {
      if (state.phase !== 'reinforce') return 'There are no reinforcements to allocate right now.';
      let total = 0;
      for (const [code, n] of Object.entries(action.allocations)) {
        if (!Number.isInteger(n) || n < 0) return 'Allocations must be whole, non-negative numbers.';
        if (n === 0) continue;
        const t = state.territories[code];
        if (!t || t.ownerId !== player.id) return `You do not control ${code}.`;
        total += n;
      }
      if (total !== state.reinforcementsPending) {
        return `You must allocate exactly ${state.reinforcementsPending} soldiers (got ${total}).`;
      }
      return null;
    }

    case 'transfer': {
      if (state.phase === 'attacking') return 'You cannot transfer soldiers while an attack is in progress.';
      if (state.phase !== 'action') return 'You cannot transfer soldiers right now.';
      if (action.from === action.to) return 'Choose two different countries.';
      const from = state.territories[action.from];
      const to = state.territories[action.to];
      if (!from || from.ownerId !== player.id) return `You do not control ${action.from}.`;
      if (!to || to.ownerId !== player.id) return `You do not control ${action.to}.`;
      if (!Number.isInteger(action.count) || action.count < 1) return 'Transfer at least 1 soldier.';
      if (from.soldiers - action.count < 1) return `${from.name} must keep at least 1 soldier.`;
      return null;
    }

    case 'startAttack': {
      if (state.phase !== 'action') return 'You cannot start an attack right now.';
      if (state.attackUsed) return 'You have already attacked this turn.';
      if (action.from === action.to) return 'Choose two different countries.';
      const from = state.territories[action.from];
      const to = state.territories[action.to];
      if (!from || from.ownerId !== player.id) return `You do not control ${action.from}.`;
      if (!to) return `Unknown target ${action.to}.`;
      if (to.ownerId === player.id) return 'You cannot attack your own country.';
      if (from.soldiers < 2) return `${from.name} needs at least 2 soldiers to attack.`;
      const defender = state.players.find((p) => p.id === to.ownerId);
      if (defender && !defender.hasTakenFirstTurn) {
        return `${defender.name} is protected until they have taken their first turn.`;
      }
      return null;
    }

    case 'roll':
    case 'stopAttack': {
      if (state.phase !== 'attacking' || !state.attack) return 'There is no attack in progress.';
      return null;
    }

    case 'completeCapture': {
      if (state.phase !== 'capture' || !state.capture) return 'There is no captured country to reinforce.';
      const from = state.territories[state.capture.from] as Territory;
      if (!Number.isInteger(action.move) || action.move < 0) return 'Move a whole number of soldiers.';
      if (action.move > from.soldiers - 1) return `${from.name} must keep at least 1 soldier.`;
      return null;
    }

    case 'endTurn': {
      if (state.phase === 'reinforce') return 'Allocate your reinforcements first.';
      if (state.phase === 'attacking') return 'Finish or stop your attack first.';
      if (state.phase === 'capture') return 'Finish the capture first.';
      return null;
    }
  }
}

export function applyAction(state: GameState, action: Action, options: ApplyOptions = {}): ApplyResult {
  const error = validateAction(state, action);
  if (error) throw new IllegalActionError(error);

  const s = structuredClone(state);
  const internalRng = new Rng(s.rngState);
  const roller = options.roller ?? internalRng;
  const events: GameEvent[] = [];
  const playerId = action.playerId;

  switch (action.type) {
    case 'allocate': {
      const applied: Record<string, number> = {};
      for (const [code, n] of Object.entries(action.allocations)) {
        if (n > 0) {
          (s.territories[code] as Territory).soldiers += n;
          applied[code] = n;
        }
      }
      s.reinforcementsPending = 0;
      s.phase = 'action';
      events.push({ type: 'reinforcementsAllocated', playerId, allocations: applied });
      break;
    }

    case 'transfer': {
      const from = s.territories[action.from] as Territory;
      const to = s.territories[action.to] as Territory;
      from.soldiers -= action.count;
      to.soldiers += action.count;
      events.push({
        type: 'transferred',
        playerId,
        from: from.code,
        to: to.code,
        count: action.count,
        fromSoldiersAfter: from.soldiers,
        toSoldiersAfter: to.soldiers,
      });
      break;
    }

    case 'startAttack': {
      const from = s.territories[action.from] as Territory;
      const to = s.territories[action.to] as Territory;
      s.phase = 'attacking';
      s.attack = { from: from.code, to: to.code, rounds: 0 };
      events.push({
        type: 'attackStarted',
        playerId,
        defenderId: to.ownerId,
        from: from.code,
        to: to.code,
        attackerSoldiers: from.soldiers,
        defenderSoldiers: to.soldiers,
      });
      break;
    }

    case 'roll': {
      const atk = s.attack as AttackInProgress;
      const from = s.territories[atk.from] as Territory;
      const to = s.territories[atk.to] as Territory;

      const res = rollRound(roller, from.soldiers, to.soldiers);
      from.soldiers -= res.attackerLosses;
      to.soldiers -= res.defenderLosses;
      atk.rounds += 1;

      events.push({
        type: 'battleRound',
        playerId,
        from: from.code,
        to: to.code,
        round: atk.rounds,
        pairs: res.pairs,
        attackerLosses: res.attackerLosses,
        defenderLosses: res.defenderLosses,
        attackerSoldiersAfter: from.soldiers,
        defenderSoldiersAfter: to.soldiers,
      });

      if (to.soldiers === 0) {
        const previousOwnerId = to.ownerId;
        const gained = captureGain(to.baseValue);
        to.ownerId = playerId;
        to.soldiers = gained;
        s.attack = null;
        s.attackUsed = true;
        events.push({
          type: 'territoryConquered',
          playerId,
          previousOwnerId,
          from: from.code,
          to: to.code,
          gained,
          soldiersOnTerritory: to.soldiers,
        });

        if (!Object.values(s.territories).some((t) => t.ownerId === previousOwnerId)) {
          (s.players.find((p) => p.id === previousOwnerId) as Player).eliminated = true;
          events.push({ type: 'playerEliminated', playerId: previousOwnerId, byPlayerId: playerId });
        }

        if (Object.values(s.territories).every((t) => t.ownerId === playerId)) {
          s.phase = 'finished';
          s.winnerId = playerId;
          s.capture = null;
          events.push({ type: 'gameWon', playerId });
        } else {
          s.phase = 'capture';
          s.capture = { from: from.code, to: to.code };
        }
      } else if (from.soldiers < 2) {
        s.attack = null;
        s.attackUsed = true;
        s.phase = 'action';
        events.push({ type: 'attackFailed', playerId, from: from.code, to: to.code });
      }
      break;
    }

    case 'stopAttack': {
      const atk = s.attack as AttackInProgress;
      events.push({ type: 'attackStopped', playerId, from: atk.from, to: atk.to });
      s.attack = null;
      s.attackUsed = true;
      advanceTurn(s, events);
      break;
    }

    case 'completeCapture': {
      const cap = s.capture as { from: string; to: string };
      const from = s.territories[cap.from] as Territory;
      const to = s.territories[cap.to] as Territory;
      from.soldiers -= action.move;
      to.soldiers += action.move;
      events.push({
        type: 'captureCompleted',
        playerId,
        from: from.code,
        to: to.code,
        moved: action.move,
        fromSoldiersAfter: from.soldiers,
        toSoldiersAfter: to.soldiers,
      });
      s.capture = null;
      s.phase = 'action';
      break;
    }

    case 'endTurn': {
      advanceTurn(s, events);
      break;
    }
  }

  s.rngState = internalRng.state;
  s.version += 1;
  return { state: s, events };
}

function advanceTurn(s: GameState, events: GameEvent[]): void {
  (s.players[s.currentPlayerIndex] as Player).hasTakenFirstTurn = true;
  events.push({ type: 'turnEnded', playerId: currentPlayer(s).id });

  const count = s.players.length;
  let idx = s.currentPlayerIndex;
  for (let step = 0; step < count; step++) {
    idx += 1;
    if (idx >= count) {
      idx = 0;
      s.round += 1;
    }
    if (!(s.players[idx] as Player).eliminated) break;
  }
  s.currentPlayerIndex = idx;

  const p = currentPlayer(s);
  s.attackUsed = false;
  s.attack = null;
  s.capture = null;
  events.push({ type: 'turnStarted', playerId: p.id, round: s.round });

  if (s.round >= 2) {
    const held = Object.values(s.territories).filter((t) => t.ownerId === p.id).length;
    s.reinforcementsPending = held * 2;
    s.phase = 'reinforce';
    events.push({ type: 'reinforcementsGranted', playerId: p.id, amount: held * 2, territoriesHeld: held });
  } else {
    s.reinforcementsPending = 0;
    s.phase = 'action';
  }
}