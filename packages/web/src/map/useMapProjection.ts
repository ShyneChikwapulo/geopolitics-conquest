import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topo from 'world-atlas/countries-50m.json';

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 500;

/**
 * Fit the world inside the map viewBox with breathing room on all sides, so the outer SVG
 * can safely use `preserveAspectRatio="slice"` (paper reaches every edge) without ever
 * clipping the far-east or far-west country shapes.
 */
const PAD_X = 40;
const PAD_Y = 30;

const projection = geoNaturalEarth1().fitExtent(
  [
    [PAD_X, PAD_Y],
    [MAP_WIDTH - PAD_X, MAP_HEIGHT - PAD_Y],
  ],
  { type: 'Sphere' } as never,
);
export const path = geoPath(projection);

const features = (
  feature(topo as unknown as Topology, (topo as any).objects.countries as GeometryCollection)
).features;

export interface MapFeature {
  id: string;
  d: string | null;
}

export const MAP_FEATURES: MapFeature[] = features.map((f) => ({
  id: String((f as any).id ?? '').padStart(3, '0'),
  d: path(f as any) ?? null,
}));

export function projectCentroid(lng: number, lat: number): [number, number] {
  return projection([lng, lat]) as [number, number];
}