# Geopolitics Conquest

INF4001N entrance exam — Risk-style single-player conquest game against 9 NPCs on a world map.

## Run locally

```bash
npm install
npm run dev
```
# open http://localhost:5173

## Anti-cheat model

The engine is deterministic and pure:

- Every `applyAction(state, action)` returns a *new* state plus an event log; no side effects, no hidden randomness.
- The RNG is a seeded `mulberry32` and its full state lives in `GameState.rngState`. Given the same state and the same action, the next state is identical, forever.
- Every action is persisted (`saveLocalGame` after each `applyAction`). If you close the browser mid-attack, the persisted state is the state *before* the last uncommitted action. Reopening the game re-renders that state; no in-flight dice are lost because they never resolved server-side, and no attack can be "rolled twice" by refreshing.
- Because `roll` returns dice from `state.rngState`, a player who somehow replayed a `roll` action would see the *same* dice, not new ones — so refreshing does not re-roll in your favour.
- For a future online version, the same property makes an authoritative server trivial: the server owns `rngState`, every client action is validated against `validateAction`, and the result is broadcast as the same `GameEvent[]` union the UI already consumes. No engine change required.

## Login credentials

The app is behind a login gate (required by the brief, page 6 item 4).

Default credentials:

- **Username:** `student`
- **Password:** `inf4001n`

Override locally by setting `VITE_APP_USER` and `VITE_APP_PASS` in
`packages/web/.env.local`. Override in production by setting the same
variables in the Render dashboard.

## Integrations

### Firebase (required for the NoSQL database requirement)

Copy `packages/web/.env.example` to `packages/web/.env.local` and fill in
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_APP_ID` from a Firebase project (Firestore enabled). Every
`applyAction` persists the new state to the `games` collection.

Without these variables the app falls back to `localStorage` — playable,
but does not satisfy the brief's "use a NoSQL database" requirement. The
Firebase project for the submission has the three lecturer emails
(`ammarcanani@gmail.com`, `mc.tanner@uct.ac.za`,
`ridewaan.hanslo@uct.ac.za`) added as Editors.

### OpenRouter (optional)

`VITE_OPENROUTER_KEY` enables live LLM commentary. Without it, commentary
falls back to a templated sentence.

- Firestore security rules are intentionally permissive (`allow read, write: if true`)
  so that the marking team can inspect the `games` collection without needing
  a Firebase account. A real deployment would restrict reads/writes to
  authenticated users.
- The login gate uses `VITE_APP_USER` / `VITE_APP_PASS` (defaults
  `student` / `inf4001n`) rather than Firebase Auth, matching the brief's
  "username and password for your application" without adding a second
  authentication system.