# Country data

| What | Source | Notes |
|---|---|---|
| Population | Worldometers "Population by Country (2026)", snapshot taken 21 Oct 2026 | UN WPP 2024 revision, medium variant. Stored in `packages/data/data/worldometers-2026.csv`. |
| ISO codes, regions, coordinates | `world-countries` (mledoze/countries) | Joined by name; 7 names need aliases (see `build-countries.ts`). |
| Map shapes | `world-atlas` 50m, derived from Natural Earth | 225 of 234 entries have a polygon. |

## Decisions
- All 234 Worldometers rows are playable, including dependent territories (the brief links this table).
- 9 entries have no polygon and are drawn as pins: REU, GLP, MYT, MTQ, GUF, GIB, BES, TUV, TKL.
- The build script fails if any row is unmatched or duplicated, so the dataset cannot silently drift.
- Soldiers per country are derived from population by the engine (`soldiersForPopulation`), never stored.