import { geoArea, geoCentroid, geoNaturalEarth1, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

export const MAP_W = 1000;
export const MAP_H = 500;
/** Antarctica is left out: nobody plays there and it wastes a lot of the map. */
const ANTARCTICA = '010';

export type CountriesTopology = Topology<{ countries: GeometryCollection }>;

export interface Shape {
  /** ISO 3166-1 numeric id, matches CountryRecord.numeric */
  id: string;
  /** SVG path data */
  d: string;
  /** Projected centroid of the country's largest polygon, in map units. */
  anchor: [number, number] | null;
}

export interface GeoIndex {
  /** All land as one path (cheap to draw). */
  landPath: string;
  shapes: Map<string, Shape>;
  /** Projects lng/lat to map units. */
  project: (lng: number, lat: number) => [number, number] | null;
}

export function buildGeo(topology: CountriesTopology): GeoIndex {
  const collection = feature(topology, topology.objects.countries) as unknown as FeatureCollection<Geometry>;
  const land = collection.features.filter((f) => String(f.id) !== ANTARCTICA);

  const projection = geoNaturalEarth1().fitExtent(
    [
      [6, 6],
      [MAP_W - 6, MAP_H - 6],
    ],
    { type: 'FeatureCollection', features: land },
  );
  const path = geoPath(projection);

  const shapes = new Map<string, Shape>();
  const areas = new Map<string, number>();
  const parts: string[] = [];
  for (const f of land) {
    if (f.id === undefined) continue;
    const d = path(f);
    if (!d) continue;
    parts.push(d);
    const id = String(f.id);
    const { anchor, area } = anchorOf(f.geometry, projection);
    const existing = shapes.get(id);
    if (!existing) {
      shapes.set(id, { id, d, anchor });
      areas.set(id, area);
    } else {
      // Two features can share one ISO id (Australia and the Ashmore & Cartier Islands both are 036).
      // Merge them so a small territory can never replace the mainland; keep the anchor of the biggest piece.
      existing.d += d;
      if (area > (areas.get(id) ?? -1)) {
        existing.anchor = anchor;
        areas.set(id, area);
      }
    }
  }

  return {
    landPath: parts.join(''),
    shapes,
    project: (lng, lat) => projection([lng, lat]) ?? null,
  };
}

function anchorOf(
  geometry: Geometry,
  projection: (p: [number, number]) => [number, number] | null,
): { anchor: [number, number] | null; area: number } {
  let polygon: Polygon | null = null;
  let best = -1;
  if (geometry.type === 'Polygon') {
    polygon = geometry;
    best = geoArea(geometry);
  } else if (geometry.type === 'MultiPolygon') {
    for (const coordinates of geometry.coordinates) {
      const candidate: Polygon = { type: 'Polygon', coordinates };
      const area = geoArea(candidate);
      if (area > best) {
        best = area;
        polygon = candidate;
      }
    }
  }
  if (!polygon) return { anchor: null, area: 0 };
  return { anchor: projection(geoCentroid(polygon) as [number, number]), area: best };
}

let geoPromise: Promise<GeoIndex> | null = null;
let geoCache: GeoIndex | null = null;

/** The map if it has already been loaded (lets re-mounted components render it immediately). */
export function getCachedGeo(): GeoIndex | null {
  return geoCache;
}

/** Fetches and prepares the world map once. The topology lives in public/ so it is not part of the JS bundle. */
export function loadGeo(url = '/countries-50m.json'): Promise<GeoIndex> {
  geoPromise ??= fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`The map could not be loaded (HTTP ${r.status}).`);
      return r.json() as Promise<CountriesTopology>;
    })
    .then((t) => (geoCache = buildGeo(t)))
    .catch((e) => {
      geoPromise = null; // allow a retry
      throw e;
    });
  return geoPromise;
}
