# Rule interpretations

| Ambiguity in the brief | Decision |
|---|---|
| "Up to 5 million" etc. | Upper bounds are inclusive (5,000,000 → 1 soldier). |
| "Conquered country's soldier value" | The country's starting value from the population table (so India = 9 → gain 4), not its current count (0 at conquest). |
| Where gained soldiers go | Placed on the conquered country automatically (always ≥ 2). The player may move extra soldiers from the attacking country, keeping at least 1 behind. |
| Which country attacks | The player chooses both source (≥ 2 soldiers) and target. |
| Dice pairing | Matched in roll order (not sorted), as in the brief's example. |
| Dice per round | `min(attacker soldiers - 1, defender soldiers)` for each side. |
| Attacker fails | Reduced to 1 soldier: attack ends, no ownership change. Player may still transfer, then end turn. |
| Stopping an attack | Ends the turn immediately. |
| Attacker at 1 AND defender at 0 in same round | Conquest wins. |
| After conquering | One attack per turn: complete the capture, may transfer, then end turn. |
| Transfers | Unlimited per turn, only in action phase, source keeps ≥ 1 soldier. |
| Turn order and rounds | Random turn order, fixed for the game. Round completes when play returns to the first player; eliminated players skipped. Reinforcements start in round 2. |
| Dice source | Seeded PRNG stored in the state — every roll reproducible and replayable. |

## Opening protection (deviation from the brief)

A player cannot be attacked until after they have completed their first turn. Applies equally to the human and every NPC, and lifts the moment that player's first turn ends — whether they attacked, transferred, or skipped.

**Why.** On the real Worldometers dataset, 300 simulated games with no protection showed ~13% of non-first seats were eliminated before ever acting, and seat 0 won ~20% of games vs ~2% for seat 9. The protection flattens that curve without changing any other rule.

**Where it lives.** `Player.hasTakenFirstTurn` in `types.ts`; set `false` in `setup.ts`; set `true` in `advanceTurn` (`engine.ts`) the moment the player's first turn ends; enforced in `validateAction` for `startAttack`; honoured by the NPC brain (`npc/brain.ts`) and the random baseline (`sim/policies.ts`). Covered by 4 tests in `opening-protection.test.ts`.

## Presentation terms (added in the review)

* **Battle round** means one volley of dice inside an attack (round 1, 2, 3...). **Round** (header) means one lap of
  turns. The commentary and the battle drawer always say "battle round".
* **Difficulty** changes how the nine rivals behave, never the rules. See `difficulty.md`.
