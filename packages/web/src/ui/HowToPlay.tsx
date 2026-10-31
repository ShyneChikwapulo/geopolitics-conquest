export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop rules-backdrop" onClick={onClose}>
      <div className="rules-frame" onClick={(e) => e.stopPropagation()}>
        <img src="/rules-board.png" alt="" className="rules-board-image" aria-hidden />
        <div className="rules-parchment">
          <button
            className="rules-close"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
          <div className="rules-scroll">
            <p><strong>Goal.</strong> Conquer all 10 countries. Last nation standing wins.</p>
            <p><strong>Each turn.</strong> From round 2 you receive <strong>2 soldiers per country</strong> you own. Place them on any countries you control.</p>
            <p><strong>Attack.</strong> Pick a source country (≥ 2 soldiers) and a target. Roll dice: each die is one soldier. Higher roll kills the loser. Ties kill nobody.</p>
            <p><strong>Dice count.</strong> Each side rolls <code>min(attacker − 1, defender)</code> dice — one must stay home in the source.</p>
            <p><strong>Conquest.</strong> When the defender hits 0, you gain <code>max(2, floor(their starting soldiers / 2))</code> on the new country. You can then move extra soldiers in.</p>
            <p><strong>Transfers.</strong> Between attacks you can move soldiers between your own countries, keeping at least 1 in the source.</p>
            <p><strong>Attack ends.</strong> When you conquer, when you're reduced to 1 soldier, or when you choose to stop (which ends your turn).</p>
            <p><strong>Fast-forward.</strong> Speed up NPC turns with the speed control — the game still plays every step.</p>
            <p className="rules-sign">— Read the full brief rules in <code>docs/rules.md</code>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}