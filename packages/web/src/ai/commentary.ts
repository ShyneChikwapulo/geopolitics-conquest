import type { DicePair } from '@conquest/engine';

export interface CommentaryInput {
  attackerName: string;
  defenderName: string;
  attackerSoldiersBefore: number;
  defenderSoldiersBefore: number;
  attackerSoldiersAfter: number;
  defenderSoldiersAfter: number;
  fromName: string;
  toName: string;
  round: number;
  pairs: DicePair[];
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
}

export function templatedCommentary(i: CommentaryInput): string {
  const rolls = i.pairs.map((p) => `${p.attacker}–${p.defender}`).join(', ');
  const outcome = i.conquered
    ? `${i.attackerName} takes ${i.toName}.`
    : i.defenderLosses > i.attackerLosses
    ? `${i.attackerName} gains ground.`
    : i.attackerLosses > i.defenderLosses
    ? `${i.defenderName} holds firm.`
    : 'Both sides trade evenly.';
  return `Round ${i.round}: ${i.attackerName} rolls ${rolls} against ${i.defenderName}. ` +
    `Losses — attacker ${i.attackerLosses}, defender ${i.defenderLosses}. ${outcome} ` +
    `Forces now stand at ${i.attackerSoldiersAfter} vs ${i.defenderSoldiersAfter}.`;
}

const SYSTEM_PROMPT = `You are a war correspondent writing LIVE from the front line of a turn-based conquest game.
You will receive a JSON object describing ONE battle round between two nations.

Your job: write a short, gripping two-sentence commentary in the present tense.

STRICT RULES:
- Use ONLY the numbers and names in the JSON. Never invent soldiers, dice, countries, or round numbers.
- Reference the exact dice pairs (attacker roll vs defender roll) somewhere in the text.
- End on the CURRENT state: either the attacker broke through, the defender held, or forces are still in contact.
- Do NOT use bullet points, headings, JSON, markdown, or quotes.
- Do NOT add a title or signature.
- If the JSON says conquered=true, describe it as a conquest.
- Keep it under 55 words total.`;

export async function* streamCommentary(input: CommentaryInput, signal: AbortSignal): AsyncGenerator<string> {
  const key = import.meta.env.VITE_OPENROUTER_KEY;
  const looksValid = typeof key === 'string' && key.startsWith('sk-or-') && key.length > 20;

  if (!looksValid) {
    yield templatedCommentary(input);
    return;
  }

  let res: Response | null = null;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Geopolitics Conquest',
      },
      body: JSON.stringify({
        model: 'openrouter/free',
        stream: true,
        temperature: 0.6,
        max_tokens: 200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(input) },
        ],
      }),
      signal,
    });
  } catch {
    yield templatedCommentary(input);
    return;
  }

  if (!res.ok || !res.body) {
    console.warn(`OpenRouter ${res.status} — falling back to templated commentary.`);
    yield templatedCommentary(input);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let anyChunk = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') break;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) { anyChunk = true; yield delta; }
        } catch { /* skip malformed SSE */ }
      }
    }
  } catch {
    /* aborted */
  }

  if (!anyChunk) {
    yield templatedCommentary(input);
  }
}