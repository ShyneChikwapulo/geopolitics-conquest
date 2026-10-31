export interface Anchor {
  code: string;
  x: number;
  y: number;
  /** Width of the whole badge including its name label (defaults to just the circle). */
  width?: number;
  /** Higher = placed first = stays closest to its true location. */
  priority?: number;
}

export interface Placed {
  code: string;
  /** Where the badge is drawn. */
  x: number;
  y: number;
  /** The true location on the map (end of the leader line). */
  ax: number;
  ay: number;
  displaced: boolean;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
}

/** A badge occupies: circle (radius ~18) plus a name label underneath. */
export const BADGE_ABOVE = 20;
export const BADGE_BELOW = 42;
export const MIN_BADGE_WIDTH = 38;

/** Rough width of a badge with its label, in map units. */
export function badgeWidth(name: string): number {
  return Math.max(MIN_BADGE_WIDTH, Math.ceil(name.length * 6.9) + 10);
}

interface Box {
  x: number;
  y: number;
  w: number;
}

const STEP = 6;
const REACH_X = 360;
const REACH_Y = 228; // multiples of STEP so the (0, 0) offset exists

/** Candidate offsets, nearest first. Computed once; the tie-break keeps results deterministic. */
const OFFSETS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let dy = -REACH_Y; dy <= REACH_Y; dy += STEP) {
    for (let dx = -REACH_X; dx <= REACH_X; dx += STEP) out.push([dx, dy]);
  }
  return out.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[1] - b[1] || a[0] - b[0]);
})();

function overlap(a: Box, b: Box, padding: number): boolean {
  const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const oy = Math.min(a.y + BADGE_BELOW, b.y + BADGE_BELOW) - Math.max(a.y - BADGE_ABOVE, b.y - BADGE_ABOVE);
  return ox + padding > 0 && oy + padding > 0;
}

/**
 * Places each badge (circle + name label) at the free spot nearest to its true location, so nothing
 * is drawn on top of anything else and everything stays inside the map. Greedy and deterministic:
 * the picture never jitters between renders. Items with a higher `priority` are placed first and
 * therefore stay closest to their true location.
 */
export function placeBadges(items: readonly Anchor[], options: LayoutOptions = {}): Placed[] {
  const { width = 1000, height = 500, padding = 4 } = options;
  const order = items.map((_, i) => i).sort((i, j) => (items[j]!.priority ?? 0) - (items[i]!.priority ?? 0) || i - j);
  const placed: Box[] = [];
  const result = new Array<Placed>(items.length);

  for (const index of order) {
    const a = items[index]!;
    const w = a.width ?? MIN_BADGE_WIDTH;
    const fits = (box: Box): boolean =>
      box.x - w / 2 >= 2 &&
      box.x + w / 2 <= width - 2 &&
      box.y - BADGE_ABOVE >= 2 &&
      box.y + BADGE_BELOW <= height - 2 &&
      placed.every((p) => !overlap(box, p, padding));

    let chosen: Box | null = null;
    for (const [dx, dy] of OFFSETS) {
      const box = { x: a.x + dx, y: a.y + dy, w };
      if (fits(box)) {
        chosen = box;
        break;
      }
    }
    // Nothing free within reach (cannot happen with ten badges): keep it on its anchor, clamped.
    chosen ??= {
      x: Math.min(width - w / 2 - 2, Math.max(w / 2 + 2, a.x)),
      y: Math.min(height - BADGE_BELOW - 2, Math.max(BADGE_ABOVE + 2, a.y)),
      w,
    };
    placed.push(chosen);
    result[index] = {
      code: a.code,
      x: chosen.x,
      y: chosen.y,
      ax: a.x,
      ay: a.y,
      displaced: Math.hypot(chosen.x - a.x, chosen.y - a.y) > 3,
    };
  }
  return result;
}
