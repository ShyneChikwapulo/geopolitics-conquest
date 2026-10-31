# Difficulty

Yardstick: a competent player (the balanced heuristic) plays nine rivals at each level. Chance is 10%. A sound setting
makes that win rate **fall** as the level rises.

| Level | Rivals | A competent player wins |
|---|---|---|
| Easy | balanced heuristic, but 30% of decisions are made "on instinct" (legal, without weighing odds) | about 40% (38–46%) |
| Medium | balanced heuristic | about 11% |
| Hard | defensive heuristic (bigger garrisons, attacks only on strong odds) | about 7% |

Pooled over 900 fresh games: Medium 11.1%, defensive 7.1%. Hard's step over Medium is real but modest (about 4 points,
roughly 3 standard errors), so a 150-game run can blur it. Re-run with more games:
`npm run report:difficulty -w @conquest/data -- 600`.

**Why this changed from version 2:** version 2 mapped Easy to the *defensive* profile and Hard to *aggressive*. The
measurements showed aggressive is no harder than balanced, and defensive is the hardest, so "Easy" was actually the
hardest field. A parameter search found no profile much stronger than defensive, so Hard stays defensive.

The "instinct" decisions are labelled in the Rival decisions panel ("Acting on instinct: ...") so Easy never looks
like a bug.
