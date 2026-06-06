// Seleciona quais threads despejar do cache em memória quando ele passa do teto.
// Numa aba aberta por semanas, cada sessão visitada deixa o Message[] inteiro
// retido. Acima do `cap`, despeja as MAIS ANTIGAS por atividade — nunca a ativa,
// nem com run vivo (`running`), nem com turno em voo (`inFlight`), nem locais
// `new-` (efêmeras, ainda não migradas). Reabrir uma despejada re-busca o JSONL.
export function selectEvictions(
  keys: string[],
  opts: { active: string; cap: number; running: Set<string>; inFlight: Set<string>; lastActivity: Record<string, number> },
): string[] {
  if (keys.length <= opts.cap) return [];
  return keys
    .filter((k) => k !== opts.active && !opts.running.has(k) && !opts.inFlight.has(k) && !k.startsWith('new-'))
    .sort((a, b) => (opts.lastActivity[a] ?? 0) - (opts.lastActivity[b] ?? 0))
    .slice(0, keys.length - opts.cap);
}
