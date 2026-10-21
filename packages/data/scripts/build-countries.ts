/**
 * Builds src/countries.json from:
 *   - data/worldometers-2026.csv   (the population snapshot the brief points to)
 *   - world-countries              (ISO codes, centroids, regions)
 *   - world-atlas (50m)            (does the country have a polygon on the map?)
 *
 * It FAILS LOUDLY if any Worldometers row cannot be matched, so the dataset can never silently drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

interface WorldCountry {
  name: { common: string; official: string };
  cca2: string;
  cca3: string;
  ccn3: string;
  altSpellings?: string[];
  region: string;
  latlng: [number, number];
}

const worldCountries: WorldCountry[] = JSON.parse(
  readFileSync(require.resolve('world-countries/countries.json'), 'utf8'),
);
const atlas = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8')) as {
  objects: { countries: { geometries: Array<{ id?: string }> } };
};
const shapeIds = new Set(atlas.objects.countries.geometries.map((g) => g.id).filter((id): id is string => !!id));

/** Worldometers names that don't match an ISO common/official/alternate name. */
const ISO3_ALIASES: Record<string, string> = {
  Turkey: 'TUR',
  'Czech Republic (Czechia)': 'CZE',
  'Cabo Verde': 'CPV',
  'St. Vincent & Grenadines': 'VCT',
  'U.S. Virgin Islands': 'VIR',
  'Turks and Caicos': 'TCA',
  'Holy See': 'VAT',
};

/** Friendlier names for display. */
const DISPLAY_NAMES: Record<string, string> = {
  'Czech Republic (Czechia)': 'Czechia',
  'Holy See': 'Vatican City',
  'Faeroe Islands': 'Faroe Islands',
};

const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const byCca3 = new Map(worldCountries.map((c) => [c.cca3, c]));
const byCommon = new Map(worldCountries.map((c) => [norm(c.name.common), c]));
const byAlt = new Map<string, WorldCountry>();
for (const c of worldCountries) {
  for (const n of [c.name.official, ...(c.altSpellings ?? [])]) {
    const k = norm(n);
    if (k && !byAlt.has(k)) byAlt.set(k, c);
  }
}

const lines = readFileSync(join(here, '../data/worldometers-2026.csv'), 'utf8').trim().split('\n').slice(1);
const out: Array<Record<string, unknown>> = [];
const seen = new Map<string, string>();
const problems: string[] = [];

for (const line of lines) {
  const first = line.indexOf(',');
  const last = line.lastIndexOf(',');
  const rank = Number(line.slice(0, first));
  const wname = line.slice(first + 1, last);
  const population = Number(line.slice(last + 1));

  const alias = ISO3_ALIASES[wname];
  const c = alias ? byCca3.get(alias) : (byCommon.get(norm(wname)) ?? byAlt.get(norm(wname)));
  if (!c) {
    problems.push(`No ISO match for "${wname}"`);
    continue;
  }
  if (seen.has(c.cca3)) problems.push(`Duplicate ${c.cca3}: "${wname}" and "${seen.get(c.cca3)}"`);
  seen.set(c.cca3, wname);
  if (!Number.isInteger(population) || population <= 0) problems.push(`Bad population for "${wname}"`);

  out.push({
    code: c.cca3,
    name: DISPLAY_NAMES[wname] ?? wname,
    population,
    rank,
    iso2: c.cca2,
    numeric: c.ccn3,
    region: c.region,
    lat: c.latlng[0],
    lng: c.latlng[1],
    hasShape: shapeIds.has(c.ccn3),
  });
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

writeFileSync(join(here, '../src/countries.json'), JSON.stringify(out, null, 1) + '\n');
const noShape = out.filter((c) => !c.hasShape).map((c) => c.code);
console.log(`Wrote ${out.length} countries. No map polygon (pin only): ${noShape.length} -> ${noShape.join(', ')}`);