import raw from './countries.json';

export interface CountryRecord {
  /** ISO 3166-1 alpha-3, e.g. "ZAF". Used as the country / player id everywhere. */
  code: string;
  name: string;
  population: number;
  /** Worldometers rank by population. */
  rank: number;
  /** ISO 3166-1 alpha-2 (lower-case it for flag-icons). */
  iso2: string;
  /** ISO 3166-1 numeric, matches the feature id in world-atlas. */
  numeric: string;
  region: string;
  /** Centroid, used to anchor soldier badges and pins. */
  lat: number;
  lng: number;
  /** false => no polygon on the 50m map, render as a pin only. */
  hasShape: boolean;
}

export const COUNTRIES: readonly CountryRecord[] = raw as CountryRecord[];

const byCode = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountry(code: string): CountryRecord | undefined {
  return byCode.get(code);
}