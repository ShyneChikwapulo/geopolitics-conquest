export function Logo({ size = 40, variant = 'gold' }: { size?: number; variant?: 'gold' | 'mono' }) {
  const gold = variant === 'gold';
  const star = gold ? '#fbbf24' : 'currentColor';
  const ring = gold ? '#d97706' : 'currentColor';
  const bg = gold ? '#0e1626' : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Geopolitics Conquest compass">
      <circle cx="32" cy="32" r="30" fill={bg} stroke={ring} strokeWidth="2" />
      <circle cx="32" cy="32" r="24" fill="none" stroke={ring} strokeWidth="1" opacity="0.5" />
      {/* 8-point compass star */}
      <g fill={star}>
        <polygon points="32,6 35,28 32,32 29,28" />
        <polygon points="32,58 35,36 32,32 29,36" />
        <polygon points="6,32 28,29 32,32 28,35" />
        <polygon points="58,32 36,29 32,32 36,35" />
        <polygon points="13,13 30,26 32,32 26,30" opacity="0.7" />
        <polygon points="51,13 34,26 32,32 38,30" opacity="0.7" />
        <polygon points="13,51 26,34 32,32 30,38" opacity="0.7" />
        <polygon points="51,51 38,34 32,32 34,38" opacity="0.7" />
      </g>
      <circle cx="32" cy="32" r="3" fill={ring} />
    </svg>
  );
}