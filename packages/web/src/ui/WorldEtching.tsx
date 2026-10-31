/** The etched globe used behind the splash screen (lifted from the Sovereign Figma design). Decorative. */
export function WorldEtching({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 820 430" aria-hidden="true" className={className}>
      <ellipse cx="410" cy="215" rx="372" ry="187" fill="none" stroke="currentColor" opacity=".35" />
      <path
        d="M38 215h744M410 28c-88 47-137 111-137 187s49 140 137 187M410 28c88 47 137 111 137 187s-49 140-137 187M53 143h714M53 287h714"
        fill="none"
        stroke="currentColor"
        opacity=".22"
      />
      <path
        d="M107 126l77-56 83 17 36 49-25 31-62-4-17 39-55 27-47-44-33-14zm192 123 57-27 72 28 24 69-49 74-62-22-20-66-39-28zm41-145 81-52 105 20 48-21 109 53-29 52-98 21-22 61-59 8-46-45-77 8-42-49zm225 140 67-43 105 35 27 62-49 74-74-10-24-52-65-28z"
        fill="currentColor"
        opacity=".18"
      />
    </svg>
  );
}
