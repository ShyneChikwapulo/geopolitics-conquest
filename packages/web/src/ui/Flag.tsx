/** A country flag from /public/flags (copied at build time). Decorative: the country name is always shown next to it. */
export function Flag({ iso2, size = 18, className = '' }: { iso2: string; size?: number; className?: string }) {
  const code = iso2.toLowerCase();
  return (
    <img
      src={`/flags/${code}.svg`}
      alt=""
      aria-hidden
      loading="lazy"
      width={Math.round(size * 1.333)}
      height={size}
      className={`flag ${className}`}
      style={{ width: Math.round(size * 1.333), height: size }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
      }}
    />
  );
}
