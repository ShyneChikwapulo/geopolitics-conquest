import { useState } from 'react';
import { IconArrowRight } from './Icons';
import { Logo } from './Logo';
import { WorldEtching } from './WorldEtching';

/** Decorative unit markers on the etched world (positions are percentages of the art area). */
const MARKERS = [
  { code: 'ZA', soldiers: 9, left: '46%', top: '58%' },
  { code: 'BR', soldiers: 9, left: '29%', top: '58%' },
  { code: 'IN', soldiers: 9, left: '69%', top: '42%' },
  { code: 'US', soldiers: 9, left: '20%', top: '31%' },
];

export function Splash({ onContinue }: { onContinue: () => void }) {
  const [fading, setFading] = useState(false);

  const go = () => {
    if (fading) return;
    setFading(true);
    setTimeout(onContinue, 400);
  };

  return (
    <div className={`splash ${fading ? 'fading' : ''}`} onClick={go}>
      <div className="splash-grid" aria-hidden="true" />
      <div className="splash-glow" aria-hidden="true" />
      <div className="splash-inner">
        <header className="splash-top">
          <div className="splash-brand">
            {/* Your logo: replace public/brand/logo.svg (see public/brand/README.md). */}
            <Logo size={52} />
            <span>
              <span className="splash-brand-name">Geopolitics Conquest</span>
              <span className="splash-brand-sub">Global strategy game</span>
            </span>
          </div>
          <span className="splash-meta">Single player</span>
        </header>

        <div className="splash-stage">
          <div className="splash-copy">
            <p className="splash-kicker">A game of total influence</p>
            <h1 className="splash-title">
              Claim
              <br />
              <span className="splash-title-accent">the world.</span>
            </h1>
            <p className="splash-lede">
              Pick a country, outplay nine rivals and take every border on the map. Dice decide each battle, and every rival move is explained.
            </p>
            <div className="splash-actions">
              <button
                className="splash-enter"
                onClick={(e) => {
                  e.stopPropagation();
                  go();
                }}
              >
                Enter
                <IconArrowRight />
              </button>
              <span className="splash-aside">
                Ten nations
                <br />
                Live spectator links
              </span>
            </div>
          </div>

          <div className="splash-art" aria-hidden="true">
            <span className="splash-ring outer" />
            <span className="splash-ring inner" />
            <WorldEtching className="splash-etching" />
            {MARKERS.map((m) => (
              <span key={m.code} className="splash-marker" style={{ left: m.left, top: m.top }}>
                <span className="code">{m.code}</span>
                {m.soldiers}
              </span>
            ))}
            <div className="splash-note">
              <span>Strategic directive</span>
              <p>Pressure creates opportunity. Move before the board moves against you.</p>
            </div>
          </div>
        </div>

        <footer className="splash-foot">
          <span>Ten nations. One world. One victor.</span>
          <span>Select anywhere to continue</span>
        </footer>
      </div>
    </div>
  );
}
