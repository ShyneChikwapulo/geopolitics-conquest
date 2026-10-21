import { describe, expect, it } from 'vitest';
import { createGame, soldiersForPopulation } from '@conquest/engine';
import { COUNTRIES, getCountry } from '../src';

describe('countries dataset', () => {
  it('has the 234 entries of the Worldometers table, ranked 1..234', () => {
    expect(COUNTRIES).toHaveLength(234);
    COUNTRIES.forEach((c, i) => expect(c.rank).toBe(i + 1));
  });

  it('is sorted by population (descending) and every population is a positive integer', () => {
    for (let i = 0; i < COUNTRIES.length; i++) {
      const c = COUNTRIES[i]!;
      expect(Number.isInteger(c.population) && c.population > 0).toBe(true);
      if (i > 0) expect(c.population).toBeLessThanOrEqual(COUNTRIES[i - 1]!.population);
    }
  });

  it('has unique, well-formed ISO codes and plausible coordinates', () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((c) => c.numeric)).size).toBe(COUNTRIES.length);
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{3}$/);
      expect(c.iso2).toMatch(/^[A-Z]{2}$/);
      expect(c.numeric).toMatch(/^\d{3}$/);
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lng).toBeGreaterThanOrEqual(-180);
      expect(c.lng).toBeLessThanOrEqual(180);
    }
  });

  it('reproduces the examples in the brief', () => {
    expect(soldiersForPopulation(getCountry('IND')!.population)).toBe(9); // "India has a soldier value of 9"
    expect(soldiersForPopulation(getCountry('VAT')!.population)).toBe(1); // "Vatican City has a value of 1"
    expect(soldiersForPopulation(getCountry('ZAF')!.population)).toBe(5);
    expect(getCountry('VAT')!.name).toBe('Vatican City');
  });

  it('maps tricky names to the right country', () => {
    expect(getCountry('COG')!.name).toBe('Congo');
    expect(getCountry('COD')!.name).toBe('DR Congo');
    expect(getCountry('NER')!.name).toBe('Niger');
    expect(getCountry('NGA')!.name).toBe('Nigeria');
    expect(getCountry('MAF')!.name).toBe('Saint Martin');
    expect(getCountry('SXM')!.name).toBe('Sint Maarten');
    expect(getCountry('CZE')!.name).toBe('Czechia');
  });

  it('every soldier tier 1..9 is represented', () => {
    const tiers = new Set(COUNTRIES.map((c) => soldiersForPopulation(c.population)));
    for (let t = 1; t <= 9; t++) expect(tiers.has(t)).toBe(true);
  });

  it('lists exactly the countries that have no polygon on the 50m map (pin-only)', () => {
    const pinOnly = COUNTRIES.filter((c) => !c.hasShape).map((c) => c.code).sort();
    expect(pinOnly).toEqual(['BES', 'GIB', 'GLP', 'GUF', 'MTQ', 'MYT', 'REU', 'TKL', 'TUV']);
  });

  it('a game can be created with any country as the human player', () => {
    for (const c of COUNTRIES) {
      const { state } = createGame({ id: 'x', seed: 1, allCountries: COUNTRIES, humanCode: c.code });
      expect(state.players).toHaveLength(10);
      expect(state.players.filter((p) => p.isHuman).map((p) => p.id)).toEqual([c.code]);
    }
  });
});