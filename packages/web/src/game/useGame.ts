import { useContext } from 'react';
import { GameCtx } from './GameProvider';

export type { LogEntry, BattleRoundSnapshot, Speed, Difficulty, GameContextValue } from './GameProvider';

export function useGame() {
  const ctx = useContext(GameCtx);
  if (!ctx) throw new Error('useGame must be inside <GameProvider>');
  return ctx;
}