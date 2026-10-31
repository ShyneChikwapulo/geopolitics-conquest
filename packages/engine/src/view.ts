import type { CountryCode, GameEvent, GameState, PlayerId } from './types';

export interface TerritoryView {
  ownerId: PlayerId;
  soldiers: number;
}

/**
 * Everything the UI needs to DRAW the board, rebuilt purely from events.
 * The same reducer serves live play, spectators and replays, so all three always agree.
 */
export interface BoardView {
  territories: Record<CountryCode, TerritoryView>;
  eliminated: PlayerId[];
  /** Players who have completed their first turn (opening protection is over for them). */
  firstTurnTaken: PlayerId[];
  currentPlayerId: PlayerId;
  round: number;
  reinforcementsPending: number;
  attack: { from: CountryCode; to: CountryCode; rounds: number } | null;
  winnerId: PlayerId | null;
}

export function boardFromState(state: GameState): BoardView {
  return {
    territories: Object.fromEntries(
      Object.values(state.territories).map((t) => [t.code, { ownerId: t.ownerId, soldiers: t.soldiers }]),
    ),
    eliminated: state.players.filter((p) => p.eliminated).map((p) => p.id),
    firstTurnTaken: state.players.filter((p) => p.hasTakenFirstTurn).map((p) => p.id),
    currentPlayerId: state.players[state.currentPlayerIndex]!.id,
    round: state.round,
    reinforcementsPending: state.reinforcementsPending,
    attack: state.attack ? { ...state.attack } : null,
    winnerId: state.winnerId,
  };
}

/** Pure reducer: returns a new view and never mutates the old one. */
export function applyEvent(view: BoardView, e: GameEvent): BoardView {
  const v: BoardView = {
    ...view,
    territories: { ...view.territories },
    eliminated: [...view.eliminated],
    firstTurnTaken: [...view.firstTurnTaken],
  };
  const set = (code: CountryCode, patch: Partial<TerritoryView>): void => {
    v.territories[code] = { ...(v.territories[code] as TerritoryView), ...patch };
  };

  switch (e.type) {
    case 'turnStarted':
      v.currentPlayerId = e.playerId;
      v.round = e.round;
      v.attack = null;
      v.reinforcementsPending = 0;
      break;
    case 'reinforcementsGranted':
      v.reinforcementsPending = e.amount;
      break;
    case 'reinforcementsAllocated':
      for (const [code, n] of Object.entries(e.allocations)) {
        set(code, { soldiers: (v.territories[code] as TerritoryView).soldiers + n });
      }
      v.reinforcementsPending = 0;
      break;
    case 'transferred':
      set(e.from, { soldiers: e.fromSoldiersAfter });
      set(e.to, { soldiers: e.toSoldiersAfter });
      break;
    case 'attackStarted':
      v.attack = { from: e.from, to: e.to, rounds: 0 };
      break;
    case 'battleRound':
      set(e.from, { soldiers: e.attackerSoldiersAfter });
      set(e.to, { soldiers: e.defenderSoldiersAfter });
      v.attack = { from: e.from, to: e.to, rounds: e.round };
      break;
    case 'territoryConquered':
      set(e.to, { ownerId: e.playerId, soldiers: e.soldiersOnTerritory });
      v.attack = null;
      break;
    case 'captureCompleted':
      set(e.from, { soldiers: e.fromSoldiersAfter });
      set(e.to, { soldiers: e.toSoldiersAfter });
      break;
    case 'attackFailed':
    case 'attackStopped':
      v.attack = null;
      break;
    case 'turnEnded':
      v.attack = null;
      if (!v.firstTurnTaken.includes(e.playerId)) v.firstTurnTaken.push(e.playerId);
      break;
    case 'playerEliminated':
      if (!v.eliminated.includes(e.playerId)) v.eliminated.push(e.playerId);
      break;
    case 'gameWon':
      v.winnerId = e.playerId;
      break;
    case 'gameStarted':
    case 'npcDecision':
      break;
  }
  return v;
}

/** Folds a list of events into a view (used to jump to any point of a replay). */
export function foldEvents(initial: BoardView, events: readonly GameEvent[]): BoardView {
  let v = initial;
  for (const e of events) v = applyEvent(v, e);
  return v;
}
