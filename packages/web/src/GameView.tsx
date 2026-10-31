import { useEffect, useRef, useState } from 'react';
import { WorldMap } from './map/WorldMap';
import { ActionPanel } from './ui/ActionPanel';
import { PlayerList } from './ui/PlayerList';
import { BattleLog } from './ui/BattleLog';
import { GameOver } from './ui/GameOver';
import { SpeedControls } from './ui/SpeedControls';
import { Commentary } from './ui/Commentary';
import { BattleOverlay } from './battle/BattleOverlay';
import { useGame } from './game/useGame';
import { TargetingProvider } from './game/targeting';
import { Logo } from './ui/Logo';
import { HowToPlay } from './ui/HowToPlay';

export function GameView({ onQuit }: { onQuit: () => void }) {
  const { state, lastBattle, log } = useGame();
  const current = state.players[state.currentPlayerIndex];
  const [overlayId, setOverlayId] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const lastOverlayRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastBattle && lastBattle.id !== overlayId) setOverlayId(lastBattle.id);
  }, [lastBattle?.id]);

  useEffect(() => {
    if (overlayId != null || lastOverlayRef.current == null) return;
    const lastOverlayId = lastOverlayRef.current;
    const after = log.filter((e) => e.id > lastOverlayId);
    const outcome = after.find(
      (e) => e.kind === 'territoryConquered' || e.kind === 'attackFailed' || e.kind === 'attackStopped',
    );
    if (outcome) {
      setSummary(outcome.text);
      setTimeout(() => setSummary(null), 3200);
    }
    lastOverlayRef.current = null;
  }, [overlayId, log]);

  useEffect(() => {
    if (overlayId != null) lastOverlayRef.current = overlayId;
  }, [overlayId]);

  return (
    <TargetingProvider>
      <div className="game-view">
        <header className="game-header">
          <div className="game-header-brand">
            <Logo size={28} variant="gold" />
            <h1>Geopolitics Conquest</h1>
          </div>
          <span className="game-meta">Round {state.round} · Turn {current?.name}</span>
          <SpeedControls />
          <button onClick={() => setHelpOpen(true)}>How to play</button>
          <button onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('watch', state.id);
            navigator.clipboard.writeText(url.toString());
            alert('Watch link copied to clipboard:\n' + url.toString());
          }}>Share</button>
          <button onClick={onQuit}>New game</button>
        </header>
        <main className="game-main">
          <section className="game-map">
            <WorldMap />
            {summary && (
              <div className="battle-summary" onClick={() => setSummary(null)}>{summary}</div>
            )}
          </section>
          <aside className="game-sidebar">
            <PlayerList />
            <Commentary />
            <BattleLog />
            <ActionPanel />
          </aside>
        </main>
        {overlayId != null && <BattleOverlay onClose={() => setOverlayId(null)} />}
        {state.phase === 'finished' && <GameOver />}
        {helpOpen && <HowToPlay onClose={() => setHelpOpen(false)} />}
      </div>
    </TargetingProvider>
  );
}