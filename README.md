# Geopolitics Conquest

A single-player, Risk-inspired world-domination game for the INF4001 entrance exam. You play one real country
against nine random rivals on a real world map. Dice decide every fight. The last nation standing wins.

**Stack:** TypeScript monorepo · React 18 + Vite · d3-geo (Natural Earth 50m) · Firebase Auth + Firestore (NoSQL) ·
OpenRouter LLM (optional) · Vitest. Hosted as a static site (Render) plus Firebase.

## What the brief asked for, and where it lives

| Requirement | Where |
|---|---|
| 10 countries: yours + 9 random, soldiers from population | `packages/data` (Worldometers 2026 snapshot), `engine/src/soldiers.ts` |
| Turn rules, 1:1 dice pairing, conquest, reinforcements, elimination | `packages/engine` (pure TypeScript, 100% unit-tested) |
| Fast-forward that still shows the gameplay | speed 1x–16x and **To my turn**: every event is still played, only shorter |
| Visible battles: attacks, dice, losses, outcomes | 3-D dice drawer (`web/src/battle`), ticker, log |
| AI commentary, accurate | `web/src/ai`: the LLM only narrates facts the engine supplies, and every answer is fact-checked (see below) |
| NPCs play to win and justify every move | `engine/src/npc` (exact odds, garrisons, focus), shown in "Rival decisions" |
| Visitors can watch, only the owner can play | spectator link `?watch=<id>`; `firestore.rules` |
| Anyone can sign up and start their own game | Firebase email/password |
| NoSQL database, deployed | Firestore, static site on Render |

**Declared bonus feature: #1, AI/LLM makes decisions for an NPC.** One rival per game (the strongest at the start)
is the *strategist*: before it attacks, the engine lists up to three legal, verified attack options and an LLM picks
one and explains why. The LLM can only return an index into that list, so it can never invent an illegal move, and the
engine still validates the resulting action. Any failure falls back to the built-in heuristic. Also built along the
way: real-time spectating (#10), dice-accurate replay (#5), difficulty levels (#6, measured), analytics (#3), and
graphics/animation (#4).

## Run it

```bash
npm install                      # once, at the repo root
npm run dev                      # http://localhost:5173 (predev copies the map + flags into public/)
npm test                         # engine + data + web
npm run typecheck
npm run build
```

Without Firebase configured, `npm run dev` shows a clearly-labelled **local guest** (games are saved in your
browser). **A production build has no guest and no built-in credentials**: it needs Firebase.

### Firebase setup (about 10 minutes)

1. Firebase console: create a project; **Build → Authentication → Sign-in method → Email/Password: enable**.
2. **Build → Firestore Database → Create database** (production mode).
3. Project settings → Your apps → add a Web app; copy the four values into `packages/web/.env.local`
   (see `.env.example`).
4. Deploy the rules (this is what makes the data safe; see `docs/security.md`):
   `npx firebase-tools deploy --only firestore:rules`.
5. Authentication → Settings → **Authorized domains**: add your Render domain.
6. Create the demo account for the markers (Authentication → Users → Add user), and add the marker emails as
   **Viewer** in Project settings → Users and permissions.

### Deploy to Render

New → Blueprint → this repo (`render.yaml`). Set the four `VITE_FIREBASE_*` values. Optionally set
`VITE_LLM_PROXY_URL` (see `infra/llm-proxy/README.md`).

## How the AI is kept honest

The engine decides everything. The LLM never sees an action it could invent: it is handed a JSON of facts and asked to
narrate. Before anything is shown it is checked (`web/src/ai/facts.ts`): every number must appear in the facts, only
the two combatants may be named (any other real country is rejected), and it may not claim a conquest that did not
happen. Anything that fails, times out or errors is replaced by a factual template, so commentary is always correct.
Tests include deliberately wrong answers. At speeds above 2x the template is used (the model cannot keep up).

## Security model, honestly

* Anything `VITE_`-prefixed is public. Firebase's web config is meant to be; **an LLM key is not**, so use the proxy.
* `firestore.rules`: anyone may *read* a game (that is the spectator feature); only the signed-in owner may create,
  change or delete it; ownership and the starting board are immutable; the version can only go up; events are
  append-only; a finished game cannot be edited.
* There is no game server, so the rules cannot re-run the engine. A signed-in owner who edits their own browser can
  falsify **their own** game. Every move is saved *before* its result is shown ("commit-then-reveal"), so closing the
  tab mid-attack cannot be used to peek at a roll and undo it. See `docs/security.md`.

## Difficulty is measured, not assumed

A competent player (the balanced heuristic) wins about **11%** against Medium rivals (chance is 10%), about **40%+**
against Easy and a little over **7%** against Hard. Hard's edge over Medium is real but modest and needs a few hundred
games to resolve. Re-run: `npm run report:difficulty -w @conquest/data -- 600`. Details: `docs/difficulty.md`.

## Layout

```
packages/engine   rules, NPC brain, difficulty, event→board reducer          (no UI, no network)
packages/data     country dataset + build script
packages/web      the app: map, dice, game loop, stores, auth, AI, replay
firestore.rules   database security      infra/llm-proxy   optional key-holding proxy
docs/             rules, architecture, security, difficulty, data
```

## Credits

Population: Worldometers (UN WPP). Map: Natural Earth via `world-atlas` (public domain). ISO data: `world-countries`
(ODbL). Flags: `flag-icons` (MIT). Dice, UI and code: this project.

## About the git history

Version 2 was written before it was committed. The history on `main` was reconstructed afterwards from that
snapshot, grouped by feature, followed by a review pass. Commit timestamps are the real time those commits were made.
