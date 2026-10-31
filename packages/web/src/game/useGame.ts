import { useContext } from 'react';
import { GameContext, type GameContextValue } from './GameProvider';

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
