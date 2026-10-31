import { useCallback, useEffect, useState } from 'react';
import type { Difficulty } from '@conquest/engine';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { GameProvider, type GameIntent } from './game/GameProvider';
import { useStore } from './game/store/useStore';
import { GameView } from './GameView';
import { Analytics } from './ui/Analytics';
import { AuthScreen } from './ui/AuthScreen';
import { History } from './ui/History';
import { Logo } from './ui/Logo';
import { Replay } from './ui/Replay';
import { Splash } from './ui/Splash';
import { StartScreen } from './ui/StartScreen';
import { Watch } from './ui/Watch';

type Route = { name: 'home' } | { name: 'watch'; id: string } | { name: 'replay'; id: string };

function readRoute(): Route {
  const q = new URLSearchParams(location.search);
  const watch = q.get('watch');
  const replay = q.get('replay');
  if (replay) return { name: 'replay', id: replay };
  if (watch) return { name: 'watch', id: watch };
  return { name: 'home' };
}

function useRoute(): [Route, (search: string) => void] {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const onPop = (): void => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((search: string) => {
    history.pushState({}, '', `${location.pathname}${search}`);
    setRoute(readRoute());
  }, []);
  return [route, navigate];
}

type Screen = 'menu' | 'history' | 'analytics' | 'game';

function Home({ navigate }: { navigate: (search: string) => void }) {
  const store = useStore();
  const [screen, setScreen] = useState<Screen>('menu');
  const [intent, setIntent] = useState<GameIntent | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const start = (humanCode: string, difficulty: Difficulty): void => {
    setIntent({ kind: 'new', humanCode, difficulty });
    setGameKey((k) => k + 1);
    setScreen('game');
  };
  const resume = (gameId: string): void => {
    setIntent({ kind: 'resume', gameId });
    setGameKey((k) => k + 1);
    setScreen('game');
  };

  if (!store) return <Connecting />;

  if (screen === 'game' && intent) {
    return (
      <GameProvider
        key={gameKey}
        store={store}
        intent={intent}
        loading={<Connecting label={intent.kind === 'new' ? 'Drawing the borders…' : 'Loading your game…'} />}
        failed={(message) => (
          <div className="auth-screen">
            <div className="auth-card">
              <div className="auth-logo"><Logo size={48} /><h1>Could not open the game</h1></div>
              <p className="form-error" role="alert">{message}</p>
              <button onClick={() => setScreen('menu')}>Back to the menu</button>
            </div>
          </div>
        )}
      >
        <GameView onExit={() => setScreen('menu')} onHistory={() => setScreen('history')} onNewGame={() => setScreen('menu')} onReplay={(id) => navigate(`?replay=${id}`)} />
      </GameProvider>
    );
  }
  if (screen === 'history') return <History store={store} onBack={() => setScreen('menu')} onResume={resume} onReplay={(id) => navigate(`?replay=${id}`)} />;
  if (screen === 'analytics') return <Analytics store={store} onBack={() => setScreen('menu')} />;
  return <StartScreen store={store} onStart={start} onResume={resume} onHistory={() => setScreen('history')} onAnalytics={() => setScreen('analytics')} />;
}

function Connecting({ label = 'Connecting…' }: { label?: string }) {
  return (
    <div className="auth-screen" role="status">
      <div className="auth-card">
        <div className="auth-logo"><Logo size={48} /><h1><span className="spinner" /> {label}</h1></div>
      </div>
    </div>
  );
}

function Gate({ navigate }: { navigate: (search: string) => void }) {
  const { status } = useAuth();
  if (status === 'signedIn') return <Home navigate={navigate} />;
  return <AuthScreen />;
}

export default function App() {
  const [route, navigate] = useRoute();
  const [splashDone, setSplashDone] = useState(() => route.name !== 'home' || sessionStorage.getItem('cq:splash') === '1');

  const finishSplash = (): void => {
    sessionStorage.setItem('cq:splash', '1');
    setSplashDone(true);
  };
  const goHome = (): void => navigate('');

  return (
    <AuthProvider>
      {!splashDone ? (
        <Splash onContinue={finishSplash} />
      ) : route.name === 'watch' ? (
        <Watch gameId={route.id} onLeave={goHome} onReplay={(id) => navigate(`?replay=${id}`)} />
      ) : route.name === 'replay' ? (
        <Replay gameId={route.id} onBack={() => (history.length > 1 ? history.back() : goHome())} />
      ) : (
        <Gate navigate={navigate} />
      )}
    </AuthProvider>
  );
}
