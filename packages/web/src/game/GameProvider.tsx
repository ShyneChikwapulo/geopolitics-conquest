import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { COUNTRIES, getCountry } from '@conquest/data';
import {
  advanceNpcsAsync,
  applyAction,
  boardFromState,
  createGame,
  currentPlayer,
  DIFFICULTIES,
  makeDecider,
  RunAbortedError,
  validateAction,
  type Action,
  type BoardView,
  type Difficulty,
  type GameEvent,
  type GameState,
  type Player,
} from '@conquest/engine';
import { createLlmAdvisor } from '../ai/advisor';
import { config } from '../config';
import type { LlmSettings } from '../config';
import { colorFor } from './colors';
import { DEFAULT_SPEED, FAST_FORWARD_SPEED, useEventPlayer, type LogEntry, type Speed } from './playback';
import type { GameStore } from './store/GameStore';
import type { GameRecord, GameSetup } from './types';

export type GameIntent =
  | { kind: 'new'; humanCode: string; difficulty: Difficulty }
  | { kind: 'resume'; gameId: string };

export interface GameContextValue {
  record: GameRecord;
  /** The authoritative engine state (always saved before it is shown). */
  state: GameState;
  /** The board as currently presented: it trails `state` while events are being played back. */
  view: BoardView;
  players: Player[];
  humanId: string;
  difficulty: Difficulty;
  /** The event being presented right now (drives the dice, the arrows and the commentary). */
  current: { id: number; event: GameEvent } | null;
  log: LogEntry[];
  /** True while events are being played back. */
  busy: boolean;
  saving: boolean;
  /** Set when saving a computed NPC run failed; `retry` tries again. */
  saveError: string | null;
  retry: () => void;
  /** The strategist NPC currently consulting its advisor, if any. */
  thinking: string | null;
  canAct: boolean;
  speed: Speed;
  setSpeed: (s: Speed) => void;
  fastToMe: boolean;
  setFastToMe: (v: boolean) => void;
  /** Applies a human action. Resolves with an error message, or null on success. */
  dispatch: (action: Action) => Promise<string | null>;
  nameOf: (code: string) => string;
  colorOf: (playerId: string) => string;
  llm: LlmSettings | null;
  strategistId: string | null;
}

export const GameContext = createContext<GameContextValue | null>(null);

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

/**
 * The one NPC (if the LLM is available) whose attack choices come from the advisor.
 * It is the strongest NPC at the start (most soldiers; ties broken by the seed): the strongest rival is the least
 * likely to be knocked out in the first rounds, so the advisor actually gets to make decisions.
 */
export function pickStrategist(state: GameState, seed: number, llmAvailable: boolean): string | null {
  if (!llmAvailable) return null;
  const npcs = state.players.filter((p) => !p.isHuman);
  if (npcs.length === 0) return null;
  const army = (id: string): number =>
    Object.values(state.territories)
      .filter((t) => t.ownerId === id)
      .reduce((n, t) => n + t.soldiers, 0);
  const best = Math.max(...npcs.map((p) => army(p.id)));
  const strongest = npcs.filter((p) => army(p.id) === best);
  return strongest[seed % strongest.length]!.id;
}

function friendlySaveError(e: unknown): string {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  if (code === 'permission-denied') return 'Could not save: permission denied. Sign in again, or this game may be open in another tab.';
  if (code === 'unavailable' || code === 'failed-precondition') return 'Could not reach the database. Check your connection and try again.';
  return e instanceof Error ? e.message : 'Could not save your move. Please try again.';
}

interface ProviderProps {
  store: GameStore;
  intent: GameIntent;
  llm?: LlmSettings | null;
  /** Shown while the game is being created or loaded. */
  loading?: ReactNode;
  /** Shown if it cannot be created or loaded. */
  failed?: (message: string) => ReactNode;
  children: ReactNode;
}

export function GameProvider({ store, intent, llm = config.llm, loading = null, failed, children }: ProviderProps) {
  const [record, setRecord] = useState<GameRecord | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  const [fastToMe, setFastToMe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);

  const player = useEventPlayer(fastToMe ? FAST_FORWARD_SPEED : speed);
  const { enqueue, reset } = player;

  // Refs always hold the latest values so async code never reads a stale closure.
  const recordRef = useRef<GameRecord | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const mounted = useRef(true);
  const initStarted = useRef(false);
  const npcRunning = useRef(false);
  const dispatching = useRef(false);

  // `mounted` is restored on re-mount, which keeps React StrictMode's simulated unmount from cancelling work.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // ---- create or load the game (exactly once per provider, even under StrictMode) -----------------------
  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    (async () => {
      try {
        if (intent.kind === 'new') {
          const seed = randomSeed();
          const created = createGame({ id: crypto.randomUUID(), seed, allCountries: COUNTRIES, humanCode: intent.humanCode });
          const setup: GameSetup = {
            humanCode: intent.humanCode,
            difficulty: intent.difficulty,
            seed,
            strategistId: pickStrategist(created.state, seed, llm !== null),
          };
          const rec = await store.createGame(setup, created.state, created.events);
          if (!mounted.current) return;
          recordRef.current = rec;
          stateRef.current = created.state;
          setRecord(rec);
          setState(created.state);
          reset(boardFromState(created.state));
          enqueue(created.events);
        } else {
          const rec = await store.loadGame(intent.gameId);
          if (!rec) throw new Error('That game could not be found.');
          const batches = await store.loadBatches(intent.gameId);
          if (!mounted.current) return;
          recordRef.current = rec;
          stateRef.current = rec.state;
          setRecord(rec);
          setState(rec.state);
          reset(boardFromState(rec.state), batches.flatMap((b) => b.events));
        }
      } catch (e) {
        if (mounted.current) setInitError(e instanceof Error ? e.message : 'The game could not be started.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves first, then reveals: the result of a move is never shown before it is safely stored. */
  const commit = useCallback(
    async (next: GameState, events: GameEvent[]): Promise<void> => {
      const rec = recordRef.current!;
      setSaving(true);
      try {
        const updated = await store.commit(rec, next, events);
        if (!mounted.current) return;
        recordRef.current = updated;
        stateRef.current = next;
        setRecord(updated);
        setState(next);
        setSaveError(null);
        enqueue(events);
      } finally {
        if (mounted.current) setSaving(false);
      }
    },
    [store, enqueue],
  );

  const difficulty: Difficulty = record?.difficulty ?? (intent.kind === 'new' ? intent.difficulty : 'medium');
  const advisor = useMemo(() => (llm ? createLlmAdvisor(llm) : undefined), [llm]);

  // ---- NPC driver: computes a whole run of NPC turns at once, saves it, then lets playback show it -------
  useEffect(() => {
    if (!state || !record || player.busy || saving || npcRunning.current || saveError) return;
    if (state.phase === 'finished') return;
    const me = currentPlayer(state);
    if (me.isHuman && !me.eliminated) return;

    npcRunning.current = true;
    const cfg = DIFFICULTIES[record.difficulty];
    (async () => {
      try {
        const run = await advanceNpcsAsync(state, {
          profileFor: () => cfg.profile,
          decide: makeDecider(record.difficulty),
          advisor,
          advisorFor: (id) => id === record.strategistId,
          advisorTimeoutMs: 7000,
          onThinking: (id) => mounted.current && setThinking(id),
          shouldAbort: () => !mounted.current,
        });
        if (!mounted.current) return;
        await commit(run.state, run.events);
      } catch (e) {
        if (e instanceof RunAbortedError || !mounted.current) return;
        setSaveError(friendlySaveError(e));
      } finally {
        npcRunning.current = false;
        if (mounted.current) setThinking(null);
      }
    })();
  }, [state, record, player.busy, saving, saveError, advisor, commit]);

  const dispatch = useCallback(
    async (action: Action): Promise<string | null> => {
      const s = stateRef.current;
      if (!s || dispatching.current) return 'Please wait a moment.';
      dispatching.current = true;
      try {
        const err = validateAction(s, action);
        if (err) return err;
        const r = applyAction(s, action);
        try {
          await commit(r.state, r.events);
        } catch (e) {
          return friendlySaveError(e);
        }
        return null;
      } finally {
        dispatching.current = false;
      }
    },
    [commit],
  );

  // "Fast-forward to my turn" switches itself off when the human's turn arrives.
  useEffect(() => {
    if (!fastToMe || !state || player.busy || saving) return;
    const me = currentPlayer(state);
    if ((me.isHuman && !me.eliminated) || state.phase === 'finished') setFastToMe(false);
  }, [fastToMe, state, player.busy, saving]);

  // Do not let the tab close while a move is being written.
  useEffect(() => {
    if (!saving) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saving]);

  const retry = useCallback(() => setSaveError(null), []);

  const value = useMemo<GameContextValue | null>(() => {
    if (!record || !state || !player.view) return null;
    const human = state.players.find((p) => p.isHuman)!;
    const colorByPlayer = new Map(state.players.map((p) => [p.id, colorFor(p.colorIndex)]));
    const humanTurn = state.phase !== 'finished' && currentPlayer(state).isHuman && !currentPlayer(state).eliminated;
    return {
      record,
      state,
      view: player.view,
      players: state.players,
      humanId: human.id,
      difficulty,
      current: player.current,
      log: player.log,
      busy: player.busy,
      saving,
      saveError,
      retry,
      thinking,
      canAct: humanTurn && !player.busy && !saving && !thinking,
      speed,
      setSpeed,
      fastToMe,
      setFastToMe,
      dispatch,
      nameOf: (code) => getCountry(code)?.name ?? state.territories[code]?.name ?? code,
      colorOf: (id) => colorByPlayer.get(id) ?? '#8a7c66',
      llm,
      strategistId: record.strategistId,
    };
  }, [record, state, player.view, player.current, player.log, player.busy, saving, saveError, retry, thinking, speed, fastToMe, dispatch, difficulty, llm]);

  if (initError) return <>{failed ? failed(initError) : <p role="alert">{initError}</p>}</>;
  if (!value) return <>{loading}</>;
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
