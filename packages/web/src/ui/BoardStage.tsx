import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCountry } from '@conquest/data';
import { describeEvent, type BoardView, type GameEvent, type Player } from '@conquest/engine';
import { BattleDrawer } from '../battle/BattleDrawer';
import type { CommentaryItem } from '../game/useBattleCommentary';
import { WorldMap, type MapCountry } from '../map/WorldMap';
import { useGeo } from '../map/useGeo';

type BattleRound = Extract<GameEvent, { type: 'battleRound' }>;

interface Props {
  players: readonly Player[];
  view: BoardView;
  current: { id: number; event: GameEvent } | null;
  nameOf: (code: string) => string;
  colorOf: (playerId: string) => string;
  humanId: string | null;
  speed: number;
  commentary: readonly CommentaryItem[];
  selectedFrom?: string | null;
  selectedTo?: string | null;
  onSelect?: (code: string) => void;
  /** Overlays such as the victory banner. */
  children?: ReactNode;
}

/** The map, the ticker and the battle drawer. Everything is driven by the presented view and event, so it is identical live, spectating and replaying. */
export function BoardStage(props: Props) {
  const { players, view, current, nameOf, colorOf, humanId, speed, commentary, selectedFrom, selectedTo, onSelect, children } = props;
  const { geo, error, retry } = useGeo();

  const countries = useMemo<MapCountry[]>(
    () =>
      Object.keys(view.territories)
        .map((code) => {
          const c = getCountry(code);
          return c ? { code, name: c.name, iso2: c.iso2, numeric: c.numeric, hasShape: c.hasShape, lat: c.lat, lng: c.lng } : null;
        })
        .filter((c): c is MapCountry => c !== null),
    // the ten countries never change during a game
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Object.keys(view.territories).join(',')],
  );

  const protectedIds = useMemo(
    () => new Set(players.filter((p) => !view.firstTurnTaken.includes(p.id) && !view.eliminated.includes(p.id)).map((p) => p.id)),
    [players, view.firstTurnTaken, view.eliminated],
  );

  // The drawer shows the last battle round for as long as that attack is going on.
  const [shown, setShown] = useState<{ id: number; event: BattleRound } | null>(null);
  useEffect(() => {
    if (!current) return;
    const e = current.event;
    if (e.type === 'battleRound') setShown({ id: current.id, event: e });
    else if (['attackStarted', 'attackStopped', 'turnStarted', 'turnEnded', 'captureCompleted', 'transferred', 'reinforcementsAllocated'].includes(e.type)) setShown(null);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = useMemo(() => {
    if (!current) return null;
    const e = current.event;
    if (e.type === 'battleRound' && e.defenderLosses > 0) return { id: current.id, code: e.to, kind: 'hit' as const };
    if (e.type === 'territoryConquered') return { id: current.id, code: e.to, kind: 'conquer' as const };
    return null;
  }, [current]);

  const arrow = view.attack
    ? { from: view.attack.from, to: view.attack.to }
    : selectedFrom && selectedTo
      ? { from: selectedFrom, to: selectedTo }
      : null;

  const ticker = current
    ? current.event.type === 'npcDecision'
      ? `${nameOf(current.event.playerId)}: ${current.event.reason}`
      : describeEvent(current.event, nameOf)
    : null;

  const ownerOf = (code: string): string => view.territories[code]?.ownerId ?? code;
  const drawerCommentary = shown ? (commentary.find((c) => c.id === shown.id) ?? null) : null;

  return (
    <div className="map-board">
      <WorldMap
        geo={geo}
        countries={countries}
        view={view}
        ownerColor={colorOf}
        ownerName={nameOf}
        humanId={humanId ?? ''}
        protectedIds={protectedIds}
        selectedFrom={selectedFrom}
        selectedTo={selectedTo}
        arrow={arrow}
        flash={flash}
        onSelect={onSelect}
      />
      {!geo && (
        <div className="map-skeleton" role="status">
          {error ? (
            <span>
              {error} <button onClick={retry}>Retry</button>
            </span>
          ) : (
            <span>
              <span className="spinner" /> Unrolling the map…
            </span>
          )}
        </div>
      )}
      {ticker && (
        <div className="ticker" key={`tick-${current?.id}`} role="status">
          {ticker}
        </div>
      )}
      {shown && (
        <BattleDrawer
          key={`drawer-${shown.id}`}
          event={shown.event}
          before={{ attacker: shown.event.attackerSoldiersAfter + shown.event.attackerLosses, defender: shown.event.defenderSoldiersAfter + shown.event.defenderLosses }}
          attacker={{ name: nameOf(shown.event.playerId), color: colorOf(shown.event.playerId), country: nameOf(shown.event.from) }}
          defender={{ name: nameOf(ownerOf(shown.event.to)), color: colorOf(ownerOf(shown.event.to)), country: nameOf(shown.event.to) }}
          speed={speed}
          commentary={drawerCommentary}
        />
      )}
      {children}
    </div>
  );
}
