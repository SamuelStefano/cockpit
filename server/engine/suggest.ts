import { oneShot } from './triage';

// Tópicos de continuação pós-turno (chips selecionáveis, estilo ChatGPT): um
// haiku one-shot barato lê o fim da conversa e propõe até 3 próximos passos
// curtos. Best-effort — falha/timeout devolve [] e a UI simplesmente não mostra
// chips. Custo controlado: haiku + effort low (herdado do oneShot), janela de
// contexto cortada e saída minúscula.
const MAX_ITEMS = 3;
const MAX_LEN = 80;

export function parseSuggestions(raw: string): string[] {
  if (!raw) return [];
  const m = raw.match(/\[[\s\S]*\]/); // o modelo às vezes embrulha em ```json
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length >= 8 && s.length <= MAX_LEN * 2)
      .map((s) => (s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1) + '…' : s))
      .slice(0, MAX_ITEMS);
  } catch { return []; }
}

export async function suggestFollowups(userPrompt: string, assistantTail: string, sessionKey = '_'): Promise<string[]> {
  // Resposta curtinha (ack, "feito") não rende continuação útil — não gasta a chamada.
  if (assistantTail.trim().length < 120) return [];
  const p = [
    'Você sugere PRÓXIMOS PASSOS numa conversa com um agente de engenharia que roda na VPS do usuário.',
    'PEDIDO_DO_USUÁRIO: ' + JSON.stringify(userPrompt.slice(0, 500)),
    'FIM_DA_RESPOSTA_DO_AGENTE: ' + JSON.stringify(assistantTail.slice(-1200)),
    'Gere até 3 continuações que o usuário provavelmente vai querer mandar em seguida.',
    'Regras: em português; cada uma com no máximo 8 palavras; imperativas e ESPECÍFICAS ao conteúdo acima',
    '(nada genérico tipo "continue" ou "explique mais"); nada de duplicar o que já foi feito.',
    'Responda SÓ com JSON, sem texto fora: ["...", "...", "..."]',
  ].join('\n');
  return parseSuggestions(await oneShot(p, 20000, 8192, sessionKey));
}
