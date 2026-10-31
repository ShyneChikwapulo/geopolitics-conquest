import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { COUNTRIES } from '@conquest/data';
import { MAP_H, MAP_W, buildGeo, type CountriesTopology } from '../src/map/geo';

const require = createRequire(import.meta.url);
const topology = JSON.parse(readFileSync(require.resolve('world-atlas/countries-50m.json'), 'utf8')) as CountriesTopology;
const geo = buildGeo(topology);

describe('world map geometry', () => {
  it('has a shape for every country that the dataset says has one', () => {
    for (const c of COUNTRIES.filter((c) => c.hasShape)) {
      expect(geo.shapes.has(c.numeric), `${c.name} (${c.numeric})`).toBe(true);
    }
  });

  it('has no shape for the pin-only countries', () => {
    for (const c of COUNTRIES.filter((c) => !c.hasShape)) expect(geo.shapes.has(c.numeric), c.name).toBe(false);
  });

  it('gives Australia its mainland, not just the Ashmore and Cartier Islands that share its ISO id', () => {
    const au = geo.shapes.get('036')!;
    expect(au.d.length).toBeGreaterThan(2000);
    const at = au.anchor!;
    // The mainland is a continent-sized polygon: its anchor is far from the speck of an island at roughly (841, 323).
    expect(Math.hypot(at[0] - 840.9, at[1] - 322.7)).toBeGreaterThan(40);
  });

  it('draws sizeable countries as real geometry (no empty or speck-sized paths)', () => {
    const big = ['USA', 'CAN', 'RUS', 'CHN', 'BRA', 'AUS', 'IND', 'ZAF', 'ARG', 'KAZ', 'DZA', 'COD', 'SAU', 'MEX', 'IDN', 'LBY', 'IRN', 'MNG', 'PER', 'TCD', 'NER', 'AGO', 'MLI', 'ETH', 'EGY', 'TZA', 'NGA', 'VEN', 'PAK', 'TUR', 'CHL', 'ZMB', 'MMR', 'AFG', 'SOM', 'FRA', 'ESP', 'DEU', 'SWE', 'ITA', 'JPN', 'NZL'];
    for (const code of big) {
      const c = COUNTRIES.find((x) => x.code === code)!;
      expect(geo.shapes.get(c.numeric)!.d.length, c.name).toBeGreaterThan(1500);
    }
  });

  it('leaves Antarctica out', () => {
    expect(geo.shapes.has('010')).toBe(false);
  });

  it('puts every anchor and every pin inside the map', () => {
    for (const c of COUNTRIES) {
      const pt = c.hasShape ? (geo.shapes.get(c.numeric)?.anchor ?? null) : geo.project(c.lng, c.lat);
      expect(pt, c.name).not.toBeNull();
      expect(pt![0], c.name).toBeGreaterThan(-5);
      expect(pt![0], c.name).toBeLessThan(MAP_W + 5);
      expect(pt![1], c.name).toBeGreaterThan(-5);
      expect(pt![1], c.name).toBeLessThan(MAP_H + 5);
    }
  });

  it('places countries in the right relative positions', () => {
    const at = (code: string) => geo.shapes.get(COUNTRIES.find((c) => c.code === code)!.numeric)!.anchor!;
    expect(at('ZAF')[1]).toBeGreaterThan(at('EGY')[1]); // South Africa is south of Egypt
    expect(at('JPN')[0]).toBeGreaterThan(at('FRA')[0]); // Japan is east of France
    expect(at('BRA')[0]).toBeLessThan(at('IND')[0]); // Brazil is west of India
    expect(at('CAN')[1]).toBeLessThan(at('MEX')[1]); // Canada is north of Mexico
  });
});
