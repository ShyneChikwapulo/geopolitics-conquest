export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop rules-backdrop" onClick={onClose}>
      <div className="rules-frame" role="dialog" aria-modal="true" aria-label="How to play" onClick={(e) => e.stopPropagation()}>
        <img src="/rules-board.png" alt="" className="rules-board-image" aria-hidden />
        <div className="rules-parchment">
          <button className="rules-close" onClick={onClose} aria-label="Close" title="Close" autoFocus>
            ×
          </button>
          <div className="rules-scroll">
            <p><strong>Goal.</strong> Conquer all 10 countries. Last nation standing wins.</p>
            <p><strong>Your army.</strong> Each country starts with 1 to 9 soldiers, set by its population. You play one country; nine random rivals play the rest.</p>
            <p><strong>Each turn.</strong> From round 2 you receive <strong>2 soldiers per country</strong> you own. Place them on any countries you control.</p>
            <p><strong>Opening protection.</strong> In round 1 nobody can be attacked until they have taken their first turn (their land is hatched on the map), so no one is knocked out before they get to play.</p>
            <p><strong>Attack.</strong> Pick a source country (at least 2 soldiers) and any target, wherever it is. Roll dice: each die is one soldier, matched pair by pair. The higher roll wins; ties kill nobody.</p>
            <p><strong>Dice count.</strong> Each side rolls <code>min(attacker − 1, defender)</code> dice: one soldier must stay home.</p>
            <p><strong>Conquest.</strong> When the defender hits 0 you take the country and gain <code>max(2, floor(its starting soldiers / 2))</code> soldiers there. You may then move extra soldiers in.</p>
            <p><strong>One attack per turn.</strong> It ends when you conquer, when you are down to 1 soldier, or when you stop (which ends your turn). You can move soldiers between your own countries, keeping at least 1 in the source.</p>
            <p><strong>Rivals.</strong> They weigh the odds before every attack and explain each move. Choose Easy, Medium or Hard when you start. Hard rivals are more careful defenders.</p>
            <p><strong>Speed.</strong> Use the speed control, or <em>To my turn</em>, to fast-forward the rivals. Every move is still shown.</p>
            <p className="rules-sign">Ten nations. One world. One victor.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
