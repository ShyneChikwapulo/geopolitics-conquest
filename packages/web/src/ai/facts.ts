/**
 * Helpers for checking that model-written text only states facts the engine actually supplied.
 * The LLM never decides anything about the game: it narrates, and we verify what it narrated.
 */

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

/** Every number in the text: digits ("12", "78%"), and number words used as counts ("two soldiers"). */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  const countable = /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:more\s+|fewer\s+|extra\s+|remaining\s+)?(?:soldier|soldiers|troop|troops|die|dice|roll|rolls|round|rounds|pair|pairs|loss|losses|casualt|point|points)/gi;
  for (const m of text.matchAll(countable)) out.push(NUMBER_WORDS[m[1]!.toLowerCase()]!);
  return out;
}

/** True if every number in `text` is one of `allowed`. */
export function onlyAllowedNumbers(text: string, allowed: ReadonlySet<number>): boolean {
  return extractNumbers(text).every((n) => allowed.has(n));
}

/** Case-insensitive, accent-insensitive "does the text mention this name". */
export function mentions(text: string, name: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return norm(text).includes(norm(name));
}

/** Pulls the first JSON object out of a model reply (tolerates code fences and chatter). */
export function extractJson<T>(text: string): T | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const norm = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Returns the first real country named in `text` that is NOT one of `allowed` (or part of an allowed name),
 * or null. Used to stop a model dragging an unrelated country into a description.
 */
export function foreignCountry(text: string, allowed: readonly string[], allNames: readonly string[]): string | null {
  const haystack = norm(text);
  const allowedNorm = allowed.map(norm);
  for (const name of allNames) {
    const n = norm(name);
    if (allowedNorm.some((a) => a === n || new RegExp(`\\b${escapeRe(n)}\\b`).test(a))) continue; // allowed, or part of an allowed name
    if (new RegExp(`\\b${escapeRe(n)}\\b`).test(haystack)) return name;
  }
  return null;
}
