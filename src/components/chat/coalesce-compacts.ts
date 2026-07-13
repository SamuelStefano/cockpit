import type { Message, CompactMessage } from '../../data/mock';

// Colapsa runs consecutivos de divisores (role 'compact') do MESMO kind num
// divisor único com contagem — sessões de loop noturno acumulam dezenas de
// wakeups seguidos que empilhados viravam uma parede de linhas. 'pr' fica de
// fora: cada um carrega um link distinto que precisa continuar clicável.
export function coalesceCompacts(messages: Message[]): Message[] {
  const out: Message[] = [];
  let run: CompactMessage[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const last = run[run.length - 1];
    out.push(run.length === 1 ? last : { ...last, count: run.reduce((n, m) => n + (m.count ?? 1), 0) });
    run = [];
  };

  for (const m of messages) {
    if (m.role !== 'compact' || m.kind === 'pr') { flush(); out.push(m); continue; }
    if (run.length > 0 && run[0].kind !== m.kind) flush();
    run.push(m);
  }
  flush();
  return out;
}
