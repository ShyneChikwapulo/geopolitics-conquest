# Security notes

## Rules (`firestore.rules`)
| Action | Who |
|---|---|
| read a game or its events | anyone (spectator links) |
| create a game | signed-in user, as the owner, `status: active`, `version: 0`, valid shape |
| update a game | its owner only; owner/setup/`initial` immutable; `version` strictly increases; only while active |
| delete a game / events | its owner only |
| create an event batch | the game's owner; ≤250 events; **never updated** (append-only) |
| anything else | nobody |

## Verify them yourself (Firebase console → Firestore → Rules → Rules playground)
1. Unauthenticated **get** `/games/<id>` → allowed. 2. Unauthenticated **update** → denied.
3. Authenticated as user B, **update** user A's game → denied. 4. As A, update with a lower `version` → denied.
5. As A, **update** an existing `/games/<id>/events/00000000` → denied.
6. Any read/write at `/users/x` → denied.
(These rules were reviewed and exercised against an in-memory model of them in the test-suite; they have not been run
against the real Firestore emulator in this environment, so please do the playground checks above.)

## Known limits
* No server means no server-side engine. An owner can falsify their own game from devtools. That affects nobody else,
  but it means the analytics are not tamper-proof. A competitive leaderboard would need server authority.
* The spectator link exposes a game id. Ids are random UUIDs (unguessable), and games contain no personal data.
* Firebase web config and the project id are public. That is expected.
* An LLM key must never be a `VITE_` variable in production: use `infra/llm-proxy`.
* `render.yaml` previously contained a username and password for a front-end login. They were not real accounts but
  they were committed, so treat them as burned and do not reuse them anywhere.
