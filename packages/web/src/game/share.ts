/** The link that lets anyone (no account needed) watch a game live, or replay it afterwards. */
export function shareUrl(gameId: string): string {
  return `${location.origin}${location.pathname}?watch=${gameId}`;
}
