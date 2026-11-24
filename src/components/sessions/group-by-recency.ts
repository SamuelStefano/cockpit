import type { Session } from '../../data/types';

// Agrupa as sessões por estado e depois por recência: Fixadas, Trabalhando (some
// quando vazio), Aguardando você, e os baldes por mtime. Só roda fora da busca.
export const WAITING_LABEL = 'Aguardando você';
export const RUNNING_LABEL = 'Trabalhando';
export const PINNED_LABEL = 'Fixadas';
export const OLD_LABEL = 'Antigas';

// Pergunta pendente é fila do dia, não arquivo morto: passadas 48h ela sai do topo
// e volta pro balde cronológico (o ponto violeta na linha mantém o sinal).
export const WAITING_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface GroupByRecencyOpts {
  now: number;
  pinned: Set<string>;
  running?: Set<string>;
  // Perguntas que o usuário mandou ignorar — ver [[useWaitingDismissed]].
  dismissed?: Set<string>;
}

export function groupByRecency(list: Session[], { now, pinned, running, dismissed }: GroupByRecencyOpts): { label: string; items: Session[] }[] {
  const ref = new Date(now);
  const startOfToday = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
  const day = 86_400_000;
  const [pinnedB, runningB, waitingB, today, yesterday, week, old] = [PINNED_LABEL, RUNNING_LABEL, WAITING_LABEL, 'Hoje', 'Ontem', 'Últimos 7 dias', OLD_LABEL]
    .map((label) => ({ label, items: [] as Session[] }));
  for (const s of list) {
    // Rodando vence "aguardando": o turno voltou a andar, a pergunta de antes já
    // não é o que te trava. Aguardando vence fixada — é a fila acionável do dia.
    if (running?.has(s.id)) { runningB.items.push(s); continue; }
    if (s.waiting && s.mtime > now - WAITING_WINDOW_MS && !dismissed?.has(s.id)) { waitingB.items.push(s); continue; }
    if (pinned.has(s.id)) { pinnedB.items.push(s); continue; }
    if (s.mtime >= startOfToday) today.items.push(s);
    else if (s.mtime >= startOfToday - day) yesterday.items.push(s);
    else if (s.mtime >= startOfToday - 7 * day) week.items.push(s);
    else old.items.push(s);
  }
  return [pinnedB, runningB, waitingB, today, yesterday, week, old].filter((b) => b.items.length > 0);
}
