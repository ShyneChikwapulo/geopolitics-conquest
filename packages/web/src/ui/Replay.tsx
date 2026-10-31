import { useEffect, useMemo, useState } from 'react';
import { getCountry } from '@conquest/data';
import { boardFromState, DIFFICULTIES, foldEvents, type BoardView, type GameEvent } from '@conquest/engine';
import { config } from '../config';
import { colorFor } from '../game/colors';
import { eventDurationMs, SPEEDS, DEFAULT_SPEED, type LogEntry, type Speed } from '../game/playback';
import { openReadStore } from '../game/store/useStore';
import type { GameRecord } from '../game/types';
import { useBattleCommentary } from '../game/useBattleCommentary';
import { BattleLog } from './BattleLog';
import { BoardStage } from './BoardStage';
import { CommentaryPanel } from './CommentaryPanel';
import { DecisionFeed } from './DecisionFeed';
import { IconDice, IconFastForward, IconPause, IconPlay, IconReplay, IconRewind, IconSkipStart, IconStepBack, IconStepForward } from './Icons';
import { Logo } from './Logo';
import { PlayerList } from './PlayerList';

const CHECKPOINT = 100;

interface Loaded {
  record: GameRecord;
  events: GameEvent[];
  checkpoints: BoardView[];
}

/** A step-by-step replay of a finished (or running) game, including every dice roll. */
export function Replay({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(DEFAULT_SPEED);
  const [seek, setSeek] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = await openReadStore(config);
        const record = await store.loadGame(gameId);
        if (!record) throw new Error('This game could not be found.');
        const events = (await store.loadBatches(gameId)).flatMap((b) => b.events);
        // Pre-compute a board every CHECKPOINT events so jumping anywhere is instant.
        const checkpoints: BoardView[] = [boardFromState(record.initial)];
        let v = checkpoints[0]!;
        events.forEach((e, i) => {
          v = foldEvents(v, [e]);
          if ((i + 1) % CHECKPOINT === 0) checkpoints.push(v);
        });
        if (!cancelled) {
          setData({ record, events, checkpoints });
          setIndex(0);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The replay could not be loaded.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const total = data?.events.length ?? 0;

  // Auto-advance while playing: each event stays up for as long as it would have live.
  useEffect(() => {
    if (!playing || !data) return;
    if (index >= total) {
      setPlaying(false);
      return;
    }
    const dwell = index === 0 ? 300 : eventDurationMs(data.events[index - 1]!, speed);
    const t = setTimeout(() => setIndex((i) => Math.min(total, i + 1)), dwell);
    return () => clearTimeout(t);
  }, [playing, index, speed, total, data]);

  const view = useMemo(() => {
    if (!data) return null;
    const k = Math.floor(index / CHECKPOINT);
    return foldEvents(data.checkpoints[Math.min(k, data.checkpoints.length - 1)]!, data.events.slice(k * CHECKPOINT, index));
  }, [data, index]);

  const log = useMemo<LogEntry[]>(() => (data ? data.events.slice(Math.max(0, index - 600), index).map((event, i) => ({ id: Math.max(0, index - 600) + i, event })) : []), [data, index]);
  const current = data && index > 0 ? { id: index, event: data.events[index - 1]! } : null;

  const nameOf = (code: string): string => getCountry(code)?.name ?? code;
  const colors = new Map((data?.record.initial.players ?? []).map((p) => [p.id, colorFor(p.colorIndex)]));
  const colorOf = (id: string): string => colors.get(id) ?? '#8a7c66';
  const commentary = useBattleCommentary(current, { llm: null, speed, nameOf, ownerOf: (c) => view?.territories[c]?.ownerId ?? c });

  const jump = (i: number): void => {
    setPlaying(false);
    setSeek((s) => s + 1);
    setIndex(Math.max(0, Math.min(total, i)));
  };
  const nextMatching = (pred: (e: GameEvent) => boolean, from: number, dir: 1 | -1): number => {
    const ev = data!.events;
    for (let i = from; i >= 0 && i < ev.length; i += dir) if (pred(ev[i]!)) return i;
    return dir === 1 ? total : 0;
  };

  if (error) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo"><Logo size={48} /><h1>Replay unavailable</h1></div>
          <p className="form-error" role="alert">{error}</p>
          <button onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }
  if (!data || !view) {
    return (
      <div className="auth-screen" role="status">
        <div className="auth-card"><div className="auth-logo"><Logo size={48} /><h1><span className="spinner" /> Loading replay…</h1></div></div>
      </div>
    );
  }

  const humanId = data.record.initial.players.find((p) => p.isHuman)!.id;
  const isBattle = (e: GameEvent): boolean => e.type === 'battleRound';
  const isTurn = (e: GameEvent): boolean => e.type === 'turnStarted';

  return (
    <div className="game-view">
      <header className="game-header">
        <div className="game-header-brand">
          <Logo size={30} />
          <h1>Replay</h1>
        </div>
        <span className="chip">{nameOf(humanId)} · {DIFFICULTIES[data.record.difficulty].label}</span>
        <span className="chip">Round <strong>{view.round}</strong></span>
        <span className="header-spacer" />
        <div className="header-actions">
          <button onClick={onBack}>← Back</button>
        </div>
      </header>
      <div className="game-main">
        <section className="game-stage" aria-label="Replay board">
          <ReplayStage {...{ data, view, current, nameOf, colorOf, humanId, speed, commentary, seek }} />
          <div className="replay-controls" role="group" aria-label="Replay controls">
            <input
              type="range"
              min={0}
              max={total}
              value={index}
              onChange={(e) => jump(Number(e.target.value))}
              aria-label="Position in the game"
              aria-valuetext={`Event ${index} of ${total}`}
            />
            <div className="replay-row">
              <button onClick={() => jump(0)} aria-label="Back to the start"><IconSkipStart /></button>
              <button onClick={() => jump(nextMatching(isTurn, Math.max(0, index - 2), -1))} aria-label="Previous turn"><IconRewind /> Turn</button>
              <button onClick={() => jump(index - 1)} aria-label="Step back one event" disabled={index === 0}><IconStepBack /></button>
              <button className="gold" onClick={() => { if (index >= total) jump(0); setPlaying((p) => !p); }} style={{ minWidth: 96 }}>
                {playing ? <><IconPause /> Pause</> : index >= total ? <><IconReplay /> Restart</> : <><IconPlay /> Play</>}
              </button>
              <button onClick={() => { setPlaying(false); setIndex((i) => Math.min(total, i + 1)); }} aria-label="Step forward one event" disabled={index >= total}><IconStepForward /></button>
              <button onClick={() => jump(nextMatching(isTurn, index, 1) + 1)} aria-label="Next turn">Turn <IconFastForward /></button>
              <button onClick={() => jump(nextMatching(isBattle, index, 1) + 1)} aria-label="Next battle round"><IconDice /> Next battle</button>
              <span className="header-spacer" />
              <span className="pos">event {index} / {total}</span>
              <span className="speed-controls" role="group" aria-label="Replay speed">
                {SPEEDS.map((s) => (
                  <button key={s} aria-pressed={s === speed} onClick={() => setSpeed(s)}>{s}×</button>
                ))}
              </span>
            </div>
          </div>
        </section>
        <aside className="game-side" aria-label="Replay information">
          <PlayerList players={data.record.initial.players} view={view} colorOf={colorOf} nameOf={nameOf} humanId={humanId} strategistId={data.record.strategistId} />
          <CommentaryPanel items={commentary} aiEnabled={false} />
          <DecisionFeed log={log} nameOf={nameOf} colorOf={colorOf} round={view.round} />
          <BattleLog log={log} nameOf={nameOf} />
        </aside>
      </div>
    </div>
  );
}

function ReplayStage(p: {
  data: Loaded;
  view: BoardView;
  current: { id: number; event: GameEvent } | null;
  nameOf: (c: string) => string;
  colorOf: (id: string) => string;
  humanId: string;
  speed: number;
  commentary: ReturnType<typeof useBattleCommentary>;
  seek: number;
}) {
  // `key` on seek so a jump never leaves a stale battle drawer from somewhere else in the game.
  return (
    <BoardStage
      key={p.seek}
      players={p.data.record.initial.players}
      view={p.view}
      current={p.current}
      nameOf={p.nameOf}
      colorOf={p.colorOf}
      humanId={p.humanId}
      speed={p.speed}
      commentary={p.commentary}
    />
  );
}
