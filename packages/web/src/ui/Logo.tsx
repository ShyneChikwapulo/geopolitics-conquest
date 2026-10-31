import { LOGO_SRC } from '../brand';

/**
 * The game's mark, shown inside a round frame (.logo-mark in styles/global.css).
 * The artwork is public/brand/logo.svg: replace that file and every place the logo appears updates.
 * It is decorative here because the game's name is always printed next to it.
 */
export function Logo({ size = 40 }: { size?: number; variant?: 'gold' | 'mono' }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size }}>
      <img src={LOGO_SRC} alt="" aria-hidden="true" draggable={false} />
    </span>
  );
}
