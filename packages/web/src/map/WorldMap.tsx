import { COUNTRIES } from '@conquest/data';
import { useGame } from '../game/useGame';
import { useTargeting } from '../game/targeting';
import { MAP_FEATURES, MAP_HEIGHT, MAP_WIDTH, projectCentroid } from './useMapProjection';
import { SoldierBadge } from './SoldierBadge';
import { AttackLine } from './AttackLine';

export const PLAYER_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
];

const numericToCountry = new Map<string, typeof COUNTRIES[number]>();
for (const c of COUNTRIES) {
  if (!numericToCountry.has(c.numeric)) numericToCountry.set(c.numeric, c);
}

export function WorldMap() {
  const { state } = useGame();
  const { fromCode, toCode, color } = useTargeting();
  const byCode = state.territories;

  return (
    <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="world-map" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="paper-tint" x="-5%" y="-5%" width="110%" height="110%">
          <feColorMatrix
            type="matrix"
            values="0.92 0.05 0.02 0 0.02
                    0.05 0.85 0.05 0 0.02
                    0.02 0.05 0.75 0 0.05
                    0    0    0    1 0"
          />
        </filter>
        <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
        </radialGradient>
        <clipPath id="map-clip">
          <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} />
        </clipPath>
      </defs>

      <g clipPath="url(#map-clip)">
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#2a2318" />
        <image href="/paper.jpg" x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="xMidYMid slice" />

        <g filter="url(#paper-tint)" style={{ mixBlendMode: 'multiply' }}>
          {MAP_FEATURES.map((f, index) => {
            const country = numericToCountry.get(f.id);
            if (!f.d || !country) return null;
            const territory = byCode[country.code];
            const player = state.players.find((p) => p.id === territory?.ownerId);
            const inPlay = Boolean(territory);
            const fill = player ? PLAYER_COLORS[player.colorIndex] : '#5c5140';
            return (
              <path key={index} d={f.d} fill={fill} stroke="#3a2f1f" strokeWidth={0.4}
                className={`country-shape ${inPlay ? 'in-play' : 'not-in-play'}`}>
                <title>{country.name}{inPlay ? ` — ${territory.soldiers} soldiers` : ''}</title>
              </path>
            );
          })}
        </g>

        {COUNTRIES.filter((c) => !c.hasShape).map((c) => {
          const [x, y] = projectCentroid(c.lng, c.lat);
          const territory = byCode[c.code];
          const player = state.players.find((p) => p.id === territory?.ownerId);
          return (
            <circle key={c.code} cx={x} cy={y} r={3.5}
              fill={player ? PLAYER_COLORS[player.colorIndex] : '#8a7c66'} stroke="#3a2f1f" strokeWidth={1}>
              <title>{c.name} — {territory?.soldiers ?? 0} soldiers</title>
            </circle>
          );
        })}

        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#vignette)" pointerEvents="none" />

        {COUNTRIES.map((c) => {
          const t = byCode[c.code];
          if (!t) return null;
          const [x, y] = projectCentroid(c.lng, c.lat);
          const player = state.players.find((p) => p.id === t.ownerId);
          return (
            <SoldierBadge key={c.code} x={x} y={y} soldiers={t.soldiers}
              color={player ? PLAYER_COLORS[player.colorIndex] : '#8a7c66'} />
          );
        })}

        {/* The attack line renders on top of everything, only when both ends are chosen. */}
        {fromCode && toCode && (
          <AttackLine fromCode={fromCode} toCode={toCode} color={color} />
        )}
      </g>
    </svg>
  );
}