import { CARD_MARKER_RE, FLOW_MARKER_RE } from '../../shared/canvas';

// The interrupted turn's prompt is already in the transcript the new turn resumes,
// so it only needs a pointer; pasting it whole doubled up to MAX_PROMPT_BYTES.
// Without a session to resume, the full prompt is the only copy the model gets.
export const CARRY_PROMPT_CHARS = 600;
export const CARRY_PROGRESS_CHARS = 1500;

// Card and flow markers bind the turn to its card and carry the flow hop count
// (MAX_HOPS), so the ones cut off with the tail are kept.
function markersCut(text: string, keep: number): string[] {
  const out: string[] = [];
  for (const re of [CARD_MARKER_RE, FLOW_MARKER_RE]) {
    for (const m of text.matchAll(new RegExp(re.source, 'g'))) if (m.index + m[0].length > keep) out.push(m[0]);
  }
  return out;
}

export function carriedPrompt(prompt: string, resuming: boolean): string {
  if (!resuming || prompt.length <= CARRY_PROMPT_CHARS) return prompt;
  const markers = markersCut(prompt, CARRY_PROMPT_CHARS);
  return `${prompt.slice(0, CARRY_PROMPT_CHARS)}…${markers.length ? ` ${markers.join(' ')}` : ''}`;
}

export function priorityCarry(cur: { prompt: string; text: string; thinking: string }, prompt: string, resuming: boolean): string {
  if (!cur.text && !cur.thinking) return prompt;
  return `Você estava no meio de: ${carriedPrompt(cur.prompt, resuming)}\n\nProgresso até agora (não repita, continue daqui):\n${(cur.thinking || '').slice(-CARRY_PROGRESS_CHARS)}\n${(cur.text || '').slice(-CARRY_PROGRESS_CHARS)}\n\nNOVA INSTRUÇÃO URGENTE (priorize):\n${prompt}`;
}
