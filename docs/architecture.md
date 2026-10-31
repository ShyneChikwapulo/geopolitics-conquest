# Architecture

## One idea: the game is a stream of events

The engine is a pure function: `applyAction(state, action) → { state, events }`. Everything the UI shows is derived
from those events.

```
human clicks ─▶ validateAction ─▶ applyAction ─▶ (state', events) ─▶ SAVE ─▶ reveal
NPC run      ─▶ advanceNpcsAsync ────────────────▶ (state', events) ─▶ SAVE ─▶ reveal
                                                                              │
                              playback queue ◀── events ◀─────────────────────┘
                              applyEvent(view, e)  → what is drawn, one step at a time
```

* **Commit-then-reveal.** A result is written to the database *before* it is shown. A reload can never re-roll.
* **Instant compute, animated playback.** A whole run of NPC turns is computed and saved at once, then played back one
  event at a time (`web/src/game/playback.ts`). Speed only changes how long each event stays on screen.
* **One reducer for three viewers.** `applyEvent` (`engine/src/view.ts`) powers the live game, the spectator and the
  replay, so they can never disagree. A property test proves that folding the events reproduces the real state after
  every single action of 60 games.

## Data model (Firestore)

```
games/{gameId}                 setup, snapshot (`state`), `initial`, counters, summary   (public read, owner write)
games/{gameId}/events/{seq}    append-only batches of ≤250 events, zero-padded seq        (public read, create-only)
```

Each save is one atomic write batch: snapshot update + new event documents. History cannot be rewritten, a stale tab is
rejected (version must increase), and a game too long for one document is split across several.

## The map

`world-atlas` 50m topology, projected with d3-geo (Natural Earth), fetched at runtime. 225 of the 234 countries have a
polygon; 9 are drawn as pins. Features that share an ISO id (Australia + Ashmore & Cartier Islands) are merged.
Badges (flag, count, name) are placed by a deterministic greedy layout so micro-states never overlap.
