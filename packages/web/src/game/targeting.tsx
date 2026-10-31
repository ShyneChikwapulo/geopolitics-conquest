import { createContext, useContext, useMemo, useState } from 'react';

export interface TargetingState {
  fromCode: string | null;
  toCode: string | null;
  /** Player colour for the attacker side; used to tint the line. */
  color: string;
  setFrom: (code: string | null) => void;
  setTo: (code: string | null) => void;
  setColor: (color: string) => void;
  clear: () => void;
}

const Ctx = createContext<TargetingState | null>(null);

export function TargetingProvider({ children }: { children: React.ReactNode }) {
  const [fromCode, setFrom] = useState<string | null>(null);
  const [toCode, setTo] = useState<string | null>(null);
  const [color, setColor] = useState<string>('#3b82f6');

  const value = useMemo<TargetingState>(
    () => ({
      fromCode,
      toCode,
      color,
      setFrom,
      setTo,
      setColor,
      clear: () => {
        setFrom(null);
        setTo(null);
      },
    }),
    [fromCode, toCode, color],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTargeting(): TargetingState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTargeting must be inside <TargetingProvider>');
  return ctx;
}