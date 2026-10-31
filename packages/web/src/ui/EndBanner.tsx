import { useMemo } from 'react';

export type EndKind = 'victory' | 'defeat' | 'eliminated';

interface Props {
  kind: EndKind;
  winnerName: string | null;
  rounds: number;
  countriesHeld: number;
  battles: number;
  conquests: number;
  onNewGame: () => void;
  onHistory: () => void;
  onReplay?: () => void;
  onShare?: () => void;
  /** Only for "eliminated": keep watching the rivals instead of leaving. */
  onKeepWatching?: () => void;
}

const CONFETTI = ['#ff5c35', '#6a8ca9', '#a6aa64', '#c87c42', '#efe8da', '#8f7bb3'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: (i * 97) % 100,
        delay: ((i * 37) % 30) / 10,
        dur: 3 + ((i * 13) % 30) / 10,
        color: CONFETTI[i % CONFETTI.length]!,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
}

function Crown() {
  return (
    <svg className="crown" viewBox="0 0 96 96" aria-hidden>
      <path d="M12 70 L8 30 L30 48 L48 18 L66 48 L88 30 L84 70 Z" fill="#ff5c35" stroke="#5d2417" strokeWidth="3" strokeLinejoin="round" />
      <rect x="12" y="70" width="72" height="10" rx="3" fill="#c84a28" stroke="#5d2417" strokeWidth="3" />
      <circle cx="8" cy="30" r="5" fill="#f2ede2" stroke="#5d2417" strokeWidth="2" />
      <circle cx="48" cy="16" r="5.5" fill="#f2ede2" stroke="#5d2417" strokeWidth="2" />
      <circle cx="88" cy="30" r="5" fill="#f2ede2" stroke="#5d2417" strokeWidth="2" />
      <circle cx="30" cy="62" r="3.5" fill="#c87c42" />
      <circle cx="48" cy="62" r="3.5" fill="#6a8ca9" />
      <circle cx="66" cy="62" r="3.5" fill="#a6aa64" />
    </svg>
  );
}

function CrackedMap() {
  return (
    <svg className="cracked" viewBox="0 0 120 90" aria-hidden>
      <path d="M8 22 C20 8 44 6 60 12 C78 6 100 10 112 24 C118 40 112 62 100 74 C84 84 60 82 44 84 C26 80 10 66 6 48 C4 38 4 30 8 22 Z" fill="#26231f" stroke="#69706b" strokeWidth="2" />
      <path d="M60 12 L54 30 L68 44 L56 58 L66 84" fill="none" stroke="#ff7958" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M54 30 L36 38 M68 44 L90 40 M56 58 L40 68" fill="none" stroke="#ff7958" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function EndBanner(p: Props) {
  const title = p.kind === 'victory' ? 'You conquered the world!' : p.kind === 'defeat' ? 'Defeated' : 'You have been eliminated';
  const sub =
    p.kind === 'victory'
      ? 'Every nation now flies your flag.'
      : p.kind === 'defeat'
        ? `${p.winnerName ?? 'A rival'} has conquered the world.`
        : 'Your last country has fallen, but the war is not over.';
  return (
    <div className={`end-banner ${p.kind === 'victory' ? 'victory' : 'defeat'}`} role="dialog" aria-modal="false" aria-label={title}>
      {p.kind === 'victory' && <Confetti />}
      <div className="end-card">
        {p.kind === 'victory' ? <Crown /> : <CrackedMap />}
        <h2>{title}</h2>
        <p>{sub}</p>
        <div className="stats">
          <div><strong>{p.rounds}</strong><span>rounds</span></div>
          <div><strong>{p.kind === 'victory' ? 10 : p.countriesHeld}</strong><span>countries held</span></div>
          <div><strong>{p.battles}</strong><span>battle rounds, all players</span></div>
          <div><strong>{p.conquests}</strong><span>conquests, all players</span></div>
        </div>
        <div className="end-actions">
          {p.kind === 'eliminated' && p.onKeepWatching && <button className="primary" onClick={p.onKeepWatching}>Keep watching</button>}
          <button className={p.kind === 'eliminated' ? '' : 'gold'} onClick={p.onNewGame}>Play again</button>
          {p.onReplay && p.kind !== 'eliminated' && <button onClick={p.onReplay}>Watch the replay</button>}
          {p.onShare && <button onClick={p.onShare}>Share</button>}
          <button className="ghost" onClick={p.onHistory}>My games</button>
        </div>
      </div>
    </div>
  );
}
