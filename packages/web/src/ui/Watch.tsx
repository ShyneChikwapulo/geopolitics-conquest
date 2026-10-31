import { getCountry } from '@conquest/data';
import { DIFFICULTIES } from '@conquest/engine';
import { useAuth } from '../auth/AuthProvider';
import { colorFor } from '../game/colors';
import { useBattleCommentary } from '../game/useBattleCommentary';
import { useSpectator } from '../game/useSpectator';
import { BattleLog } from './BattleLog';
import { BoardStage } from './BoardStage';
import { CommentaryPanel } from './CommentaryPanel';
import { DecisionFeed } from './DecisionFeed';
import { Logo } from './Logo';
import { PlayerList } from './PlayerList';
import { SpeedControls } from './SpeedControls';

interface Props {
  gameId: string;
  /** Go to the app (sign in / menu). */
  onLeave: () => void;
  onReplay: (id: string) => void;
}

/** Read-only, real-time view of someone's game. Anyone with the link can open it; nobody can play from here. */
export function Watch({ gameId, onLeave, onReplay }: Props) {
  const s = useSpectator(gameId);
  const { status } = useAuth();
  const record = s.record;

  const nameOf = (code: string): string => getCountry(code)?.name ?? code;
  const colors = new Map((record?.initial.players ?? []).map((p) => [p.id, colorFor(p.colorIndex)]));
  const colorOf = (id: string): string => colors.get(id) ?? '#8a7c66';
  const commentary = useBattleCommentary(s.current, {
    llm: null, // spectators never spend the owner's AI quota: they get the factual match report
    speed: s.speed,
    nameOf,
    ownerOf: (code) => s.view?.territories[code]?.ownerId ?? code,
  });

  if (s.error && !record) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo"><Logo size={48} /><h1>Game not found</h1></div>
          <p className="form-error" role="alert">{s.error}</p>
          <button onClick={onLeave}>Go to Geopolitics Conquest</button>
        </div>
      </div>
    );
  }
  if (!record || !s.view) {
    return (
      <div className="auth-screen" role="status">
        <div className="auth-card"><div className="auth-logo"><Logo size={48} /><h1><span className="spinner" /> Tuning in…</h1></div></div>
      </div>
    );
  }

  const humanId = record.initial.players.find((p) => p.isHuman)!.id;
  const finished = record.status === 'finished' && !s.busy;
  const winner = s.view.winnerId;

  return (
    <div className="game-view with-banner">
      <header className="game-header">
        <div className="game-header-brand">
          <Logo size={30} />
          <h1>Geopolitics Conquest</h1>
        </div>
        <span className="chip">Round <strong>{s.view.round}</strong></span>
        <span className="chip">{nameOf(humanId)} · {DIFFICULTIES[record.difficulty].label}</span>
        <span className="header-spacer" />
        <SpeedControls speed={s.speed} setSpeed={s.setSpeed} fastToMe={false} setFastToMe={() => {}} showFastForward={false} />
        <div className="header-actions">
          <button onClick={() => onReplay(gameId)}>⟲ <span className="txt">Replay from start</span></button>
          <button className="primary" onClick={onLeave}>{status === 'signedIn' ? 'Menu' : 'Play your own game'}</button>
        </div>
      </header>
      <div className="watch-banner" role="status">
        {record.status === 'active' ? (
          <><span className="live-dot" /> <strong>LIVE</strong> You are watching {nameOf(humanId)}'s game. You cannot play from here, but the board updates as it happens.</>
        ) : (
          <>This game is finished. {winner ? `${nameOf(winner)} conquered the world.` : ''}</>
        )}
      </div>
      <div className="game-main">
        <section className="game-stage" aria-label="Game board">
          <BoardStage players={record.initial.players} view={s.view} current={s.current} nameOf={nameOf} colorOf={colorOf} humanId={humanId} speed={s.speed} commentary={commentary}>
            {finished && winner && (
              <div className="end-banner victory" role="dialog" aria-label="Game over">
                <div className="end-card">
                  <h2>{nameOf(winner)} conquered the world</h2>
                  <p>{winner === humanId ? 'The human player won this one.' : 'The rivals won this one.'}</p>
                  <div className="end-actions">
                    <button className="gold" onClick={() => onReplay(gameId)}>Watch the replay</button>
                    <button onClick={onLeave}>{status === 'signedIn' ? 'Menu' : 'Play your own game'}</button>
                  </div>
                </div>
              </div>
            )}
          </BoardStage>
        </section>
        <aside className="game-side" aria-label="Game information">
          <PlayerList players={record.initial.players} view={s.view} colorOf={colorOf} nameOf={nameOf} humanId={humanId} strategistId={record.strategistId} />
          <CommentaryPanel items={commentary} aiEnabled={false} />
          <DecisionFeed log={s.log} nameOf={nameOf} colorOf={colorOf} round={s.view.round} />
          <BattleLog log={s.log} nameOf={nameOf} />
        </aside>
      </div>
    </div>
  );
}
