import { describe, expect, it } from 'vitest';
import { BADGE_ABOVE, BADGE_BELOW, badgeWidth, placeBadges, type Anchor, type Placed } from '../src/map/layout';

function overlaps(a: Placed, aw: number, b: Placed, bw: number): boolean {
  const ox = Math.min(a.x + aw / 2, b.x + bw / 2) - Math.max(a.x - aw / 2, b.x - bw / 2);
  const oy = Math.min(a.y + BADGE_BELOW, b.y + BADGE_BELOW) - Math.max(a.y - BADGE_ABOVE, b.y - BADGE_ABOVE);
  return ox > 0 && oy > 0;
}

function assertNoOverlaps(items: Anchor[], out: Placed[]): void {
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      expect(overlaps(out[i]!, items[i]!.width ?? 38, out[j]!, items[j]!.width ?? 38), `${out[i]!.code} vs ${out[j]!.code}`).toBe(false);
    }
  }
}

describe('placeBadges', () => {
  it('leaves well-separated badges where they are', () => {
    const out = placeBadges([
      { code: 'A', x: 100, y: 100 },
      { code: 'B', x: 400, y: 300 },
    ]);
    expect(out.every((p) => !p.displaced)).toBe(true);
    expect(out[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('separates badges that sit on the same spot, labels included', () => {
    const items: Anchor[] = Array.from({ length: 6 }, (_, i) => ({ code: `C${i}`, x: 500, y: 250, width: badgeWidth('Country Name') }));
    const out = placeBadges(items);
    assertNoOverlaps(items, out);
    expect(out.filter((p) => p.displaced).length).toBeGreaterThanOrEqual(5);
  });

  it("stops one badge's label running over the badge below it (the Western Sahara / Senegal case)", () => {
    const items: Anchor[] = [
      { code: 'ESH', x: 366, y: 172, width: badgeWidth('Western Sahara') },
      { code: 'SEN', x: 360, y: 186, width: badgeWidth('Senegal') },
    ];
    assertNoOverlaps(items, placeBadges(items));
  });

  it('keeps every badge inside the map and remembers the true location', () => {
    const items: Anchor[] = [
      { code: 'A', x: 2, y: 2 },
      { code: 'B', x: 4, y: 3 },
      { code: 'C', x: 998, y: 498, width: 120 },
    ];
    const out = placeBadges(items);
    for (let i = 0; i < out.length; i++) {
      const w = items[i]!.width ?? 38;
      expect(out[i]!.x - w / 2).toBeGreaterThanOrEqual(0);
      expect(out[i]!.x + w / 2).toBeLessThanOrEqual(1000);
      expect(out[i]!.y - BADGE_ABOVE).toBeGreaterThanOrEqual(0);
      expect(out[i]!.y + BADGE_BELOW).toBeLessThanOrEqual(500);
    }
    expect(out[0]).toMatchObject({ ax: 2, ay: 2 });
  });

  it('is deterministic and resolves a crowd of ten', () => {
    const items: Anchor[] = Array.from({ length: 10 }, (_, i) => ({ code: `X${i}`, x: 300 + (i % 3) * 6, y: 200 + (i % 2) * 5, width: 80 }));
    const a = placeBadges(items);
    expect(a).toEqual(placeBadges(items));
    assertNoOverlaps(items, a);
  });
});
