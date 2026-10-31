import { memo, useEffect, useMemo, useRef } from 'react';
import type { BoardView } from '@conquest/engine';
import { MAP_H, MAP_W, type GeoIndex } from './geo';
import { badgeWidth, placeBadges, type Placed } from './layout';

export interface MapCountry {
  code: string;
  name: string;
  iso2: string;
  numeric: string;
  hasShape: boolean;
  lat: number;
  lng: number;
}

export interface WorldMapProps {
  geo: GeoIndex | null;
  /** The ten countries in play. */
  countries: readonly MapCountry[];
  view: BoardView;
  ownerColor: (ownerId: string) => string;
  ownerName: (ownerId: string) => string;
  humanId: string;
  /** Players who have not had their first turn yet: they cannot be attacked, so their land is hatched. */
  protectedIds?: ReadonlySet<string>;
  selectedFrom?: string | null;
  selectedTo?: string | null;
  /** An arrow between two countries (the battle in progress, or the attack being planned). */
  arrow?: { from: string; to: string } | null;
  /** Re-triggers a short highlight on a country (e.g. a battle just hit it). Change `id` to replay it. */
  flash?: { id: number; code: string; kind: 'hit' | 'conquer' } | null;
  onSelect?: (code: string) => void;
}

const FONT = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

function usePrevious<T>(value: T): T {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export function WorldMap(props: WorldMapProps) {
  const { geo, countries, view, ownerColor, ownerName, humanId, protectedIds, selectedFrom, selectedTo, arrow, flash, onSelect } = props;

  const placed = useMemo(() => {
    if (!geo) return new Map<string, Placed>();
    const anchors = countries.map((c) => {
      const pt = (c.hasShape ? geo.shapes.get(c.numeric)?.anchor : null) ?? geo.project(c.lng, c.lat) ?? [MAP_W / 2, MAP_H / 2];
      return { code: c.code, x: pt[0], y: pt[1], width: badgeWidth(c.name) + 22, priority: c.hasShape ? 1 : 0 };
    });
    return new Map(placeBadges(anchors).map((p) => [p.code, p]));
  }, [geo, countries]);

  const a = arrow ? { from: placed.get(arrow.from), to: placed.get(arrow.to) } : null;

  return (
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="world-map" preserveAspectRatio="xMidYMid meet" role="group" aria-label="World map of the ten countries in play">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="rgba(255,255,255,0)" />
          <rect width="2.4" height="6" fill="rgba(242,237,226,0.3)" />
        </pattern>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="#ff5c35" />
        </marker>
      </defs>

      {geo ? (
        <>
          {/* every country, muted */}
          <path d={geo.landPath} fill="#d6d0c4" fillOpacity={0.1} stroke="#f2ede2" strokeOpacity={0.16} strokeWidth={0.35} />

          {/* the ten in play, coloured by owner */}
          <g>
            {countries.map((c) => {
              const shape = c.hasShape ? geo.shapes.get(c.numeric) : undefined;
              const t = view.territories[c.code];
              if (!shape || !t) return null;
              const isFlash = flash?.code === c.code;
              return (
                <path
                  key={isFlash ? `${c.code}-${flash.id}` : c.code}
                  d={shape.d}
                  fill={ownerColor(t.ownerId)}
                  fillOpacity={0.9}
                  stroke="#11100e"
                  strokeWidth={0.7}
                  className={`country-shape in-play${isFlash ? ` flash-${flash.kind}` : ''}`}
                  onClick={() => onSelect?.(c.code)}
                >
                  <title>{`${c.name}: ${t.soldiers} soldiers (${ownerName(t.ownerId)})`}</title>
                </path>
              );
            })}
          </g>
          {/* hatching over land whose owner is still protected */}
          {countries.map((c) => {
            const shape = c.hasShape ? geo.shapes.get(c.numeric) : undefined;
            const t = view.territories[c.code];
            if (!shape || !t || !protectedIds?.has(t.ownerId)) return null;
            return <path key={`h-${c.code}`} d={shape.d} fill="url(#hatch)" pointerEvents="none" />;
          })}

          {a?.from && a.to && <Arc from={a.from} to={a.to} />}

          {countries.map((c) => {
            const p = placed.get(c.code);
            const t = view.territories[c.code];
            if (!p || !t) return null;
            return (
              <Badge
                key={c.code}
                country={c}
                placed={p}
                soldiers={t.soldiers}
                color={ownerColor(t.ownerId)}
                ownerName={ownerName(t.ownerId)}
                mine={t.ownerId === humanId}
                isTurn={t.ownerId === view.currentPlayerId}
                isProtected={protectedIds?.has(t.ownerId) ?? false}
                isFrom={c.code === selectedFrom}
                isTo={c.code === selectedTo}
                onSelect={onSelect}
              />
            );
          })}
        </>
      ) : null}
    </svg>
  );
}

const Badge = memo(function Badge(props: {
  country: MapCountry;
  placed: Placed;
  soldiers: number;
  color: string;
  ownerName: string;
  mine: boolean;
  isTurn: boolean;
  isProtected: boolean;
  isFrom: boolean;
  isTo: boolean;
  onSelect?: (code: string) => void;
}) {
  const { country: c, placed: p, soldiers, color, ownerName, mine, isTurn, isProtected, isFrom, isTo, onSelect } = props;
  const prev = usePrevious(soldiers);
  const trend = soldiers < prev ? 'down' : soldiers > prev ? 'up' : '';
  const label = `${c.name}, ${soldiers} ${soldiers === 1 ? 'soldier' : 'soldiers'}, owned by ${ownerName}${isProtected ? ', protected until their first turn' : ''}`;
  const interactive = Boolean(onSelect);

  return (
    <g
      className="badge"
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : -1}
      aria-label={label}
      onClick={() => onSelect?.(c.code)}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect?.(c.code);
        }
      }}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {p.displaced && <line x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke="#11100e" strokeWidth={1} strokeOpacity={0.7} />}
      {(p.displaced || !c.hasShape) && <circle cx={p.ax} cy={p.ay} r={3.4} fill={color} stroke="#11100e" strokeWidth={1} />}
      <g transform={`translate(${p.x},${p.y})`}>
        {isTurn && <circle r={23} fill="none" stroke={color} strokeWidth={2.5} className="turn-ring" />}
        {isFrom && <circle r={26} fill="none" stroke="#e9e2d6" strokeWidth={3.5} strokeDasharray="6 4" />}
        {isTo && <circle r={26} fill="none" stroke="#ff4d4d" strokeWidth={3.5} strokeDasharray="6 4" />}
        <circle r={16} fill={color} stroke={mine ? '#f2ede2' : '#11100e'} strokeWidth={mine ? 3 : 2} className="badge-disc" />
        <text
          key={soldiers}
          className={`count ${trend}`}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={FONT}
          fontSize={soldiers > 99 ? 12 : 16}
          fontWeight={800}
          fill="#171310"
        >
          {soldiers}
        </text>
        {isProtected && (
          <g transform="translate(9,-26)">
            <title>Protected until their first turn</title>
            <path d="M7 0 L14 2.6 V8.4 C14 12.4 11 15 7 16.6 C3 15 0 12.4 0 8.4 V2.6 Z" fill="#f2ede2" stroke="#11100e" strokeWidth={1.2} />
            <path d="M4 8 L6.4 10.4 L10.4 5.6" fill="none" stroke="#11100e" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        <image href={`/flags/${c.iso2.toLowerCase()}.svg`} x={-30} y={-27} width={20} height={15} preserveAspectRatio="xMidYMid slice" className="badge-flag" />
        <rect x={-30} y={-27} width={20} height={15} fill="none" stroke="rgba(242,237,226,0.4)" strokeWidth={1} rx={1.5} pointerEvents="none" />
        <text y={32} textAnchor="middle" fontFamily={FONT} fontSize={11.5} fontWeight={700} fill="#f2ede2" stroke="#11100e" strokeWidth={3.2} paintOrder="stroke" strokeLinejoin="round">
          {c.name}
        </text>
      </g>
    </g>
  );
});

function Arc({ from, to }: { from: Placed; to: Placed }) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  if (dist < 1) return null;
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2 - Math.min(110, dist * 0.28);
  const GAP = 24;
  const toward = (p: { x: number; y: number }, q: { x: number; y: number }) => {
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: p.x + ((q.x - p.x) / d) * GAP, y: p.y + ((q.y - p.y) / d) * GAP };
  };
  const start = toward(from, { x: cx, y: cy });
  const end = toward(to, { x: cx, y: cy });
  const d = `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke="#11100e" strokeWidth={6} strokeOpacity={0.85} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#ff5c35" strokeWidth={3} strokeDasharray="8 6" markerEnd="url(#arrowhead)" className="attack-arc" strokeLinecap="round" />
    </g>
  );
}
