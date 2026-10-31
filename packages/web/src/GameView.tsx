import { useCallback, useEffect, useState } from 'react';
import { getCountry } from '@conquest/data';
import { DIFFICULTIES } from '@conquest/engine';
import type { GameEvent } from '@conquest/engine';
import { explainDecision } from './ai/advisor';
import { FAST_FORWARD_SPEED } from './game/playback';
import { shareUrl } from './game/share';
import { useBattleCommentary } from './game/useBattleCommentary';
import { useGame } from './game/useGame';
import { ActionDock } from './ui/ActionDock';
import { BattleLog } from './ui/BattleLog';
import { BoardStage } from './ui/BoardStage';
import { CommentaryPanel } from './ui/CommentaryPanel';
import { DecisionFeed } from './ui/DecisionFeed';
import { EndBanner, type EndKind } from './ui/EndBanner';
import { Flag } from './ui/Flag';
import { HowToPlay } from './ui/HowToPlay';
import { IconGames, IconMenu, IconRules, IconShare } from './ui/Icons';
import { Logo } from './ui/Logo';
import { PlayerList } from './ui/PlayerList';
import { SpeedControls } from './ui/SpeedControls';
import { StatusBar } from './ui/StatusBar';

export interface GameViewProps {
  /** Leave the game (it is saved and can be resumed from "My games"). */
  onExit: () => void;
  onHistory: () => void;
  onNewGame: () => void;
  onReplay: (gameId: string) => void;
}

export function GameView({ onExit, onHistory, onNewGame, onReplay }: GameViewProps) {
  const g = useGame();
  const { state, view, current, humanId } = g;
  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // A fresh start for the target pickers every time the game moves on.
  useEffect(() => {
    setSelectedFrom(null);
    setSelectedTo(null);
  }, [state.version]);

  const effectiveSpeed = g.fastToMe ? FAST_FORWARD_SPEED : g.speed;
  const commentary = useBattleCommentary(current, {
    llm: g.llm,
    speed: effectiveSpeed,
    nameOf: g.nameOf,
    ownerOf: (code) => view.territories[code]?.ownerId ?? code,
  });

  const onSelect = useCallback(
    (code: string): void => {
      if (!g.canAct || state.phase !== 'action' || state.attackUsed) return;
      const t = state.territories[code];
      if (!t) return;
      if (t.ownerId === humanId) {
        setSelectedFrom(t.soldiers >= 2 ? (selectedFrom === code ? null : code) : null);
        setSelectedTo(null);
      } else if (selectedFrom) {
        const owner = state.players.find((p) => p.id === t.ownerId);
        if (owner?.hasTakenFirstTurn) setSelectedTo(code);
        else flash(`${g.nameOf(t.ownerId)} is protected until their first turn.`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g.canAct, state, humanId, selectedFrom],
  );

  const flash = (msg: string): void => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 2600);
  };

  const share = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(shareUrl(g.record.id));
      flash('Spectator link copied. Anyone with it can watch live.');
    } catch {
      flash(shareUrl(g.record.id));
    }
  };

  const explain = g.llm
    ? async (d: Extract<GameEvent, { type: 'npcDecision' }>, round: number): Promise<string | null> =>
        explainDecision(g.llm!, { player: g.nameOf(d.playerId), kind: d.kind, heuristicReason: d.reason, metrics: d.metrics, round })
    : undefined;

  const human = state.players.find((p) => p.isHuman)!;
  const humanOut = view.eliminated.includes(humanId);
  const endKind: EndKind | null = view.winnerId ? (view.winnerId === humanId ? 'victory' : 'defeat') : humanOut && !bannerDismissed ? 'eliminated' : null;
  const countriesHeld = Object.values(view.territories).filter((t) => t.ownerId === humanId).length;

  const turnPlayer = view.currentPlayerId;
  const iso = getCountry(turnPlayer)?.iso2 ?? 'un';

  return (
    <div className="game-view">
      <header className="game-header">
        <div className="game-header-brand">
          <Logo size={30} />
          <h1>Geopolitics Conquest</h1>
        </div>
        <span className="chip">
          Round <strong>{view.round}</strong>
        </span>
        <span className="turn-chip" aria-live="polite">
          <span className="swatch" style={{ background: g.colorOf(turnPlayer) }} />
          <Flag iso2={iso} size={14} />
          {view.winnerId ? 'Game over' : turnPlayer === humanId ? 'Your turn' : `${g.nameOf(turnPlayer)}'s turn`}
        </span>
        <span className="chip" title={DIFFICULTIES[g.difficulty].blurb}>
          {DIFFICULTIES[g.difficulty].label}
        </span>
        {notice && <span className="notice" role="status">{notice}</span>}
        <span className="header-spacer" />
        <SpeedControls
          speed={g.speed}
          setSpeed={g.setSpeed}
          fastToMe={g.fastToMe}
          setFastToMe={g.setFastToMe}
          disableFastForward={g.canAct || !!view.winnerId}
        />
        <div className="header-actions">
          <button onClick={() => void share()} title="Copy a link that lets anyone watch this game live">
            <IconShare /> <span className="txt">Share</span>
          </button>
          <button onClick={() => setRules(true)} title="How to play">
            <IconRules /> <span className="txt">Rules</span>
          </button>
          <button onClick={onHistory} title="Your saved games">
            <IconGames /> <span className="txt">My games</span>
          </button>
          <button onClick={onExit} title="Leave. The game is saved and can be resumed.">
            <IconMenu /> <span className="txt">Menu</span>
          </button>
        </div>
      </header>

      <div className="game-main">
        <section className="game-stage" aria-label="Game board">
          <BoardStage
            players={g.players}
            view={view}
            current={current}
            nameOf={g.nameOf}
            colorOf={g.colorOf}
            humanId={humanId}
            speed={effectiveSpeed}
            commentary={commentary}
            selectedFrom={selectedFrom}
            selectedTo={selectedTo}
            onSelect={onSelect}
          >
            {endKind && (
              <EndBanner
                kind={endKind}
                winnerName={view.winnerId ? g.nameOf(view.winnerId) : null}
                rounds={view.round}
                countriesHeld={countriesHeld}
                battles={g.record.stats.battles}
                conquests={g.record.stats.conquests}
                onNewGame={onNewGame}
                onHistory={onHistory}
                onReplay={() => onReplay(g.record.id)}
                onShare={() => void share()}
                onKeepWatching={() => {
                  setBannerDismissed(true);
                  g.setFastToMe(true);
                }}
              />
            )}
          </BoardStage>
          <StatusBar />
          <ActionDock selectedFrom={selectedFrom} selectedTo={selectedTo} setSelectedFrom={setSelectedFrom} setSelectedTo={setSelectedTo} />
        </section>

        <aside className="game-side" aria-label="Game information">
          <PlayerList players={g.players} view={view} colorOf={g.colorOf} nameOf={g.nameOf} humanId={human.id} strategistId={g.strategistId} />
          <CommentaryPanel items={commentary} aiEnabled={g.llm !== null && effectiveSpeed <= 2} />
          <DecisionFeed log={g.log} nameOf={g.nameOf} colorOf={g.colorOf} explain={explain} round={view.round} />
          <BattleLog log={g.log} nameOf={g.nameOf} />
        </aside>
      </div>

      {rules && <HowToPlay onClose={() => setRules(false)} />}
    </div>
  );
}
