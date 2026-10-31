import type { ReactNode, SVGAttributes } from 'react';

/**
 * Small line icons that replace the emoji used before the redesign. They inherit the text colour and size
 * (1.15em) from their surroundings and are hidden from assistive technology: every icon sits next to a text
 * label or inside a button that carries its own aria-label.
 */
type IconProps = SVGAttributes<SVGSVGElement>;

function Base({ children, className = '', ...rest }: IconProps & { children?: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`icon ${className}`.trim()}
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconShare(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Base>
  );
}

export function IconRules(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
    </Base>
  );
}

export function IconGames(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Base>
  );
}

export function IconMenu(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1" />
    </Base>
  );
}

export function IconFastForward(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 6l7 6-7 6z" fill="currentColor" />
      <path d="M13 6l7 6-7 6z" fill="currentColor" />
    </Base>
  );
}

export function IconRewind(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M20 6l-7 6 7 6z" fill="currentColor" />
      <path d="M11 6l-7 6 7 6z" fill="currentColor" />
    </Base>
  );
}

export function IconDice(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
      <path d="M8.8 11.8l2.2 2.2 4.2-4.6" />
    </Base>
  );
}

export function IconSpark(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18.5 16.5v3M17 18h3" />
    </Base>
  );
}

export function IconSwords(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M5 19L18 6" />
      <path d="M6.5 13.5l4 4" />
      <path d="M19 19L6 6" />
      <path d="M13.5 17.5l4-4" />
    </Base>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </Base>
  );
}

export function IconReplay(p: IconProps) {
  return (
    <Base {...p}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </Base>
  );
}

export function IconPlay(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M8 5l11 7-11 7z" fill="currentColor" />
    </Base>
  );
}

export function IconPause(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </Base>
  );
}

export function IconStepBack(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M17 5l-9 7 9 7z" fill="currentColor" />
    </Base>
  );
}

export function IconStepForward(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M7 5l9 7-9 7z" fill="currentColor" />
    </Base>
  );
}

export function IconSkipStart(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 5v14" />
      <path d="M19 5l-9 7 9 7z" fill="currentColor" />
    </Base>
  );
}

export function IconChart(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M5 20v-9M12 20V4M19 20v-7" />
    </Base>
  );
}

export function IconArrowLeft(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Base>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Base>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}
