import { IconClose } from './Icons';

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop rules-backdrop" onClick={onClose}>
      <div className="rules-frame" role="dialog" aria-modal="true" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <div className="rules-card">
          <div className="rules-head">
            <h2>How to play</h2>
            <button className="rules-close" onClick={onClose} aria-label="Close" title="Close" autoFocus>
              <IconClose />
            </button>
          </div>
          <div className="rules-body">
            <div className="rules-row">
              <h3>Goal</h3>
              <p>Conquer all 10 countries. Last nation standing wins.</p>
            </div>
            <div className="rules-row">
              <h3>Your army</h3>
              <p>Each country starts with 1 to 9 soldiers, set by its population. You play one country; nine random rivals play the rest.</p>
            </div>
            <div className="rules-row">
              <h3>Each turn</h3>
              <p>From round 2 you receive <strong>2 soldiers per country</strong> you own. Place them on any countries you control.</p>
            </div>
            <div className="rules-row">
              <h3>Opening protection</h3>
              <p>In round 1 nobody can be attacked until they have taken their first turn (their land is hatched on the map), so no one is knocked out before they get to play.</p>
            </div>
            <div className="rules-row">
              <h3>Attack</h3>
              <p>Pick a source country (at least 2 soldiers) and any target, wherever it is. Roll dice: each die is one soldier, matched pair by pair. The higher roll wins; ties kill nobody.</p>
            </div>
            <div className="rules-row">
              <h3>Dice count</h3>
              <p>Each side rolls <code>min(attacker − 1, defender)</code> dice: one soldier must stay home.</p>
            </div>
            <div className="rules-row">
              <h3>Conquest</h3>
              <p>When the defender hits 0 you take the country and gain <code>max(2, floor(its starting soldiers / 2))</code> soldiers there. You may then move extra soldiers in.</p>
            </div>
            <div className="rules-row">
              <h3>One attack per turn</h3>
              <p>It ends when you conquer, when you are down to 1 soldier, or when you stop (which ends your turn). You can move soldiers between your own countries, keeping at least 1 in the source.</p>
            </div>
            <div className="rules-row">
              <h3>Rivals</h3>
              <p>They weigh the odds before every attack and explain each move. Choose Easy, Medium or Hard when you start. Hard rivals are more careful defenders.</p>
            </div>
            <div className="rules-row">
              <h3>Speed</h3>
              <p>Use the speed control, or <em>To my turn</em>, to fast-forward the rivals. Every move is still shown.</p>
            </div>
          </div>
          <div className="rules-foot">
            <p className="rules-sign">Ten nations. One world. One victor.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
