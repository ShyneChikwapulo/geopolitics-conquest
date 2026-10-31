import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceNpcs,
  applyAction,
  createGame,
  currentPlayer,
  IllegalActionError,
  BALANCED,
  AGGRESSIVE,
  DEFENSIVE,
  type Action,
  type GameEvent,
  type GameState,
  type NpcProfile,
} from '@conquest/engine';
import { COUNTRIES } from '@conquest/data';
import { recordAction, saveGame } from './persistence';

export type Speed = '1x' | '4x' | '16x' | 'instant';
export const SPEED_MS: Record<Speed, number> = { '1x': 1200, '4x': 400, '16x': 120, instant: 0 };
export const ROLL_MS: Record<Speed, number> = { '1x': 900, '4x': 420, '16x': 180, instant: 0 };

export type Difficulty = 'easy' | 'medium' | 'hard';
const DIFFICULTY_PROFILE: Record<Difficulty, NpcProfile> = {
  easy: DEFENSIVE,
  medium: BALANCED,
  hard: AGGRESSIVE,
};

export interface BattleRoundSnapshot {
  id: number;
  from: string;
  to: string;
  round: number;
  pairs: { attacker: number; defender: number; result: 'attacker' | 'defender' | 'tie' }[];
  attackerLosses: number;
  defenderLosses: number;
  attackerSoldiersBefore: number;
  defenderSoldiersBefore: number;
  attackerSoldiersAfter: number;
  defenderSoldiersAfter: number;
  attackerPlayerId: string;
  defenderPlayerId: string;
}

export interface LogEntry {
  id: number;
  kind: GameEvent['type'];
  text: string;
  playerId?: string;
  ts: number;
}

export interface GameContextValue {
  state: GameState;
  log: LogEntry[];
  dispatch: (action: Action) => void;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  isHumanTurn: boolean;
  lastBattle: BattleRoundSnapshot | null;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  npcProfileLabel: (playerId: string) => string;
  revealedSteps: number;
  setRevealedSteps: (n: number) => void;
}

export const GameCtx = createContext<GameContextValue | null>(null);

function describeEvent(ev: GameEvent, s: GameState): string {
  const nameOf = (id: string) => s.players.find((p) => p.id === id)?.name ?? id;
  switch (ev.type) {
    case 'gameStarted':
      return `Game started. ${nameOf(ev.humanPlayerId)} is you.`;
    case 'turnStarted':
      return `--- Round ${ev.round}: ${nameOf(ev.playerId)}'s turn ---`;
    case 'reinforcementsGranted':
      return `${nameOf(ev.playerId)} gained ${ev.amount} soldiers across ${ev.territoriesHeld} territories.`;
    case 'reinforcementsAllocated':
      return `${nameOf(ev.playerId)} placed ${Object.values(ev.allocations).reduce((a, b) => a + b, 0)} soldiers.`;
    case 'transferred':
      return `${nameOf(ev.playerId)} moved ${ev.count} soldiers ${ev.from} → ${ev.to}.`;
    case 'attackStarted':
      return `${nameOf(ev.playerId)} attacks ${ev.to} from ${ev.from} (${ev.attackerSoldiers} vs ${ev.defenderSoldiers}).`;
    case 'battleRound': {
      const pairs = ev.pairs
        .map((p) => `${p.attacker}v${p.defender}${p.result === 'tie' ? '=' : p.result === 'attacker' ? '✓' : '✗'}`)
        .join(' ');
      return `Round ${ev.round}: ${pairs} → attacker -${ev.attackerLosses}, defender -${ev.defenderLosses}.`;
    }
    case 'territoryConquered':
      return `⚑ ${nameOf(ev.playerId)} conquered ${ev.to} from ${nameOf(ev.previousOwnerId)} (+${ev.gained} soldiers)!`;
    case 'captureCompleted':
      return `${nameOf(ev.playerId)} moved ${ev.moved} soldiers into ${ev.to}.`;
    case 'attackFailed':
      return `✗ ${nameOf(ev.playerId)}'s attack on ${ev.to} failed.`;
    case 'attackStopped':
      return `${nameOf(ev.playerId)} stopped the attack on ${ev.to}.`;
    case 'playerEliminated':
      return `☠ ${nameOf(ev.playerId)} has been eliminated by ${nameOf(ev.byPlayerId)}!`;
    case 'turnEnded':
      return `${nameOf(ev.playerId)}'s turn ends.`;
    case 'gameWon':
      return `👑 ${nameOf(ev.playerId)} has conquered the world!`;
    case 'npcDecision':
      return `[${ev.kind}] ${ev.reason}`;
  }
}

export function GameProvider({ humanCode, seed, difficulty: initialDifficulty = 'medium', children }: {
  humanCode: string;
  seed: number;
  difficulty?: Difficulty;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<GameState>(
    () => createGame({ id: `g-${seed}-${Date.now()}`, seed, allCountries: COUNTRIES, humanCode }).state,
  );
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastBattle, setLastBattle] = useState<BattleRoundSnapshot | null>(null);
  const [speed, setSpeed] = useState<Speed>('4x');
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [revealedSteps, setRevealedSteps] = useState(0);
  const logId = useRef(0);
  const speedRef = useRef(speed);
  const difficultyRef = useRef(difficulty);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { difficultyRef.current = difficulty; }, [difficulty]);
  const npcRunningRef = useRef(false);

  const appendEvents = useCallback((events: GameEvent[], s: GameState) => {
    setLog((prev) => {
      const next = [...prev];
      for (const ev of events) {
        const id = ++logId.current;
        next.push({
          id,
          kind: ev.type,
          text: describeEvent(ev, s),
          playerId: 'playerId' in ev ? (ev as any).playerId : undefined,
          ts: Date.now(),
        });
        if (ev.type === 'battleRound') {
          const defenderId = s.territories[ev.to]?.ownerId ?? ev.to;
          setLastBattle({
            id,
            from: ev.from,
            to: ev.to,
            round: ev.round,
            pairs: ev.pairs,
            attackerLosses: ev.attackerLosses,
            defenderLosses: ev.defenderLosses,
            attackerSoldiersBefore: ev.attackerSoldiersAfter + ev.attackerLosses,
            defenderSoldiersBefore: ev.defenderSoldiersAfter + ev.defenderLosses,
            attackerSoldiersAfter: ev.attackerSoldiersAfter,
            defenderSoldiersAfter: ev.defenderSoldiersAfter,
            attackerPlayerId: ev.playerId,
            defenderPlayerId: defenderId,
          });
        }
      }
      return next.slice(-300);
    });
  }, []);

  const dispatch = useCallback((action: Action) => {
    setState((prev) => {
      try {
        const result = applyAction(prev, action);
        appendEvents(result.events, result.state);
        void saveGame(result.state).catch(() => {});
        void recordAction(result.state.id, action).catch(() => {});
        return result.state;
      } catch (e) {
        if (e instanceof IllegalActionError) { console.warn('Illegal action:', e.message); return prev; }
        throw e;
      }
    });
  }, [appendEvents]);

  const profileFor = useCallback(
    (_id: string) => DIFFICULTY_PROFILE[difficultyRef.current],
    [],
  );

  const npcProfileLabel = useCallback((id: string) => {
    if (id === humanCode) return 'human';
    return difficultyRef.current === 'easy' ? 'defensive'
      : difficultyRef.current === 'hard' ? 'aggressive'
      : 'balanced';
  }, [humanCode]);

  useEffect(() => {
    if (npcRunningRef.current) return;
    const cur = currentPlayer(state);
    if (state.phase === 'finished' || cur.isHuman) return;
    npcRunningRef.current = true;
    let cancelled = false;
    (async () => {
      let s = state;
      let guard = 0;
      while (!cancelled && s.phase !== 'finished' && !currentPlayer(s).isHuman && guard++ < 20_000) {
        const r = advanceNpcs(s, { profileFor });
        appendEvents(r.events, r.state);
        if (speedRef.current !== 'instant') {
          await new Promise((res) => setTimeout(res, SPEED_MS[speedRef.current]));
        }
        s = r.state;
        setState(s);
        if (r.events.length === 0) break;
      }
      npcRunningRef.current = false;
    })();
    return () => { cancelled = true; npcRunningRef.current = false; };
  }, [state.phase, state.currentPlayerIndex, state.round, appendEvents, profileFor]);

  const isHumanTurn = currentPlayer(state).isHuman && state.phase !== 'finished';
  const value = useMemo<GameContextValue>(
    () => ({
      state, log, dispatch, speed, setSpeed, isHumanTurn, lastBattle,
      difficulty, setDifficulty, npcProfileLabel,
      revealedSteps, setRevealedSteps,
    }),
    [state, log, dispatch, speed, isHumanTurn, lastBattle, difficulty,
     npcProfileLabel, revealedSteps],
  );
  return <GameCtx.Provider value={value}>{children}</GameCtx.Provider>;
}