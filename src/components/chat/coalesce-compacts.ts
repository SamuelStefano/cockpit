import type { Message, CompactMessage, PrLink } from '../../data/types';

// Colapsa runs consecutivos de divisores (role 'compact') do MESMO kind num
// divisor único — sessões de loop noturno acumulam dezenas de wakeups seguidos e
// lotes de PR abertas em sequência, que empilhados viram uma parede de linhas e
// escondem o prompt com a resposta. Wakeup/compactação viram contagem; 'pr'
// junta os links numa lista, porque cada um precisa continuar clicável.
export function coalesceCompacts(messages: Message[]): Message[] {
  const out: Message[] = [];
  let run: CompactMessage[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const last = run[run.length - 1];
    if (run.length === 1) out.push(last);
    else if (last.kind === 'pr') out.push({ ...last, prs: run.flatMap(prLinks) });
    else out.push({ ...last, count: run.reduce((n, m) => n + (m.count ?? 1), 0) });
    run = [];
  };

  for (const m of messages) {
    if (m.role !== 'compact') { flush(); out.push(m); continue; }
    if (run.length > 0 && run[0].kind !== m.kind) flush();
    run.push(m);
  }
  flush();
  return out;
}

// Sempre devolve pelo menos uma entrada: um marcador sem url ainda ocupa lugar no
// grupo (o PrGroup o mostra sem link), senão a PR sumiria calada do divisor.
export function prLinks(m: CompactMessage): PrLink[] {
  return m.prs ?? [{ label: m.label ?? m.url ?? 'PR aberta', url: m.url ?? '' }];
}
