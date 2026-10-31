import { useState, useEffect } from 'react';
import { COUNTRIES } from '@conquest/data';
import { GameProvider, type Difficulty } from './game/GameProvider';
import { GameView } from './GameView';
import { StartScreen } from './ui/StartScreen';
import { Replay } from './ui/Replay';
import { AuthScreen } from './ui/AuthScreen';
import { Splash } from './ui/Splash';
import { Watch } from './ui/Watch';

const SPLASH_KEY = 'cq:splash-seen';
const SESSION_KEY = 'cq:authed';

export function App() {
  const [splashed, setSplashed] = useState(() => sessionStorage.getItem(SPLASH_KEY) === '1');
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === '1');
  const [session, setSession] = useState<{ human: string; seed: number; difficulty: Difficulty } | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const watch = params.get('watch');
    if (watch) setWatchId(watch);
  }, []);

  if (watchId) {
    return <Watch gameId={watchId} onClose={() => {
      setWatchId(null);
      const url = new URL(window.location.href);
      url.searchParams.delete('watch');
      window.history.replaceState({}, '', url.toString());
    }} />;
  }

  if (!splashed) {
    return <Splash onContinue={() => { sessionStorage.setItem(SPLASH_KEY, '1'); setSplashed(true); }} />;
  }

  if (!authed) {
    return <AuthScreen onAuthed={() => { sessionStorage.setItem(SESSION_KEY, '1'); setAuthed(true); }} />;
  }

  if (!session) {
    return (
      <>
        <StartScreen
          countries={COUNTRIES}
          onStart={(human, seed, difficulty) => setSession({ human, seed, difficulty })}
          onReplay={(id) => setReplayId(id)}
        />
        {replayId && <Replay gameId={replayId} onClose={() => setReplayId(null)} />}
      </>
    );
  }

  return (
    <GameProvider humanCode={session.human} seed={session.seed} difficulty={session.difficulty}>
      <GameView onQuit={() => setSession(null)} />
    </GameProvider>
  );
}