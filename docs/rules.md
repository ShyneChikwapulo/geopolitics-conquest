# Rule interpretations

| Ambiguity in the brief | Decision |
|---|---|
| "Up to 5 million" etc. | Upper bounds are inclusive (5,000,000 -> 1 soldier). |
| "Conquered country's soldier value" | The country's starting value from the population table (so India = 9 -> gain 4), not its current count (which is 0 at the moment of conquest). |
| Where gained soldiers go | They are placed on the conquered country automatically (always >= 2). The player may then move extra soldiers from the attacking country, keeping at least 1 behind. |
| Which country attacks | The player chooses both the source (>= 2 soldiers) and the target. |
| Dice pairing | Dice are matched in roll order (not sorted), as in the brief's example. |
| Dice rolled per round | min(attacker soldiers - 1, defender soldiers) for each side. |
| Attacker fails | Attacker reduced to 1 soldier: attack ends, nobody changes owner. The player may still transfer, then end the turn. |
| Stopping an attack | Ends the turn immediately. |
| Attacker at 1 soldier AND defender at 0 in the same round | Conquest wins. |
| After conquering | One attack per turn: the player completes the capture, may transfer soldiers, then ends the turn. |
| Transfers | Unlimited per turn, only in the action phase (never mid-attack), the source must keep at least 1 soldier. |
| Turn order and rounds | Random turn order, fixed for the game. A round completes when play wraps back to the first player; eliminated players are skipped. Reinforcements start in round 2. |
| Dice source | Seeded PRNG whose state is stored in the game, so every roll is reproducible and replayable. |