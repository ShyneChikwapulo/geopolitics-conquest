import { useState } from 'react';
import { Logo } from './Logo';

export function Splash({ onContinue }: { onContinue: () => void }) {
  const [fading, setFading] = useState(false);

  const go = () => {
    if (fading) return;
    setFading(true);
    setTimeout(onContinue, 400);
  };

  return (
    <div className={`splash ${fading ? 'fading' : ''}`} onClick={go}>
      <div className="splash-art">
        <img src="/splash.png" alt="Geopolitics Conquest" className="splash-image" />
      </div>
      <div className="splash-footer">
        <Logo size={28} variant="gold" />
        <span>Ten nations. One world. One victor.</span>
      </div>
      <button className="splash-enter" onClick={(e) => { e.stopPropagation(); go(); }}>
        Enter
      </button>
    </div>
  );
}