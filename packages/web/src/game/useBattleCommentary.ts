import { useEffect, useRef, useState } from 'react';
import type { GameEvent } from '@conquest/engine';
import { battleFacts, streamCommentary, templateCommentary } from '../ai/commentary';
import type { LlmSettings } from '../config';
import { MAX_LLM_SPEED } from './playback';

export interface CommentaryItem {
  id: number;
  text: string;
  source: 'llm' | 'template';
  loading: boolean;
}

interface Options {
  /** null disables the LLM entirely (spectators, replays): the factual template is used instead. */
  llm: LlmSettings | null;
  speed: number;
  nameOf: (code: string) => string;
  /** Who owns a country right now (the defender of this battle). */
  ownerOf: (code: string) => string;
}

const MAX_ITEMS = 5;

/**
 * Commentary for the battle round currently on screen. At low speeds it streams from the LLM (and is fact-checked);
 * at high speeds, or without an LLM, it uses the guaranteed-accurate template. Only the newest request is kept alive.
 */
export function useBattleCommentary(current: { id: number; event: GameEvent } | null, opts: Options): CommentaryItem[] {
  const [items, setItems] = useState<CommentaryItem[]>([]);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!current || current.event.type !== 'battleRound') return;
    const { id, event } = current;
    const o = optsRef.current;
    const facts = battleFacts(event, {
      attacker: o.nameOf(event.playerId),
      defender: o.nameOf(o.ownerOf(event.to)),
      attackerCountry: o.nameOf(event.from),
      defenderCountry: o.nameOf(event.to),
    });
    const put = (patch: Partial<CommentaryItem>) =>
      setItems((prev) => {
        const next = prev.some((i) => i.id === id)
          ? prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
          : [...prev, { id, text: '', source: 'template' as const, loading: false, ...patch }];
        return next.slice(-MAX_ITEMS);
      });

    if (!o.llm || o.speed > MAX_LLM_SPEED) {
      put({ text: templateCommentary(facts), source: 'template', loading: false });
      return;
    }
    const controller = new AbortController();
    put({ text: '', loading: true });
    void streamCommentary(
      facts,
      o.llm,
      (text, provisional) => !controller.signal.aborted && put({ text, loading: provisional }),
      controller.signal,
    ).then((r) => {
      // If we were superseded, still leave a correct sentence behind rather than an empty row.
      if (controller.signal.aborted) put({ text: templateCommentary(facts), source: 'template', loading: false });
      else put({ text: r.text, source: r.source, loading: false });
    });
    return () => controller.abort();
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return items;
}
