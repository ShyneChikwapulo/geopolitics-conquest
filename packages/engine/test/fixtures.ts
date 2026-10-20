import type { DiceRoller } from '../src/rng';
import type { CountryDef } from '../src/types';

export const COUNTRIES: CountryDef[] = [
  { code: 'ZAF', name: 'South Africa', population: 60_414_495 }, // 5
  { code: 'IND', name: 'India', population: 1_428_627_663 }, // 9
  { code: 'VAT', name: 'Vatican City', population: 800 }, // 1
  { code: 'BRA', name: 'Brazil', population: 216_422_446 }, // 9
  { code: 'NGA', name: 'Nigeria', population: 223_804_632 }, // 9
  { code: 'EGY', name: 'Egypt', population: 112_716_598 }, // 7
  { code: 'JPN', name: 'Japan', population: 123_294_513 }, // 7
  { code: 'NZL', name: 'New Zealand', population: 5_228_100 }, // 2
  { code: 'FIN', name: 'Finland', population: 5_545_475 }, // 2
  { code: 'CHE', name: 'Switzerland', population: 8_796_669 }, // 2
  { code: 'KEN', name: 'Kenya', population: 55_100_586 }, // 5
  { code: 'DEU', name: 'Germany', population: 83_294_633 }, // 6
  { code: 'FRA', name: 'France', population: 64_756_584 }, // 5
  { code: 'IRL', name: 'Ireland', population: 5_056_935 }, // 2
];

/** A roller that returns the given values in order, then throws. */
export function scripted(values: number[]): DiceRoller {
  let i = 0;
  return {
    die() {
      const v = values[i++];
      if (v === undefined) throw new Error('Scripted roller ran out of dice');
      return v;
    },
  };
}