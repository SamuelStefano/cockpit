// Monitor externo do Deck: sonda o relay DE FORA e classifica o estado.
//
// Por que fora: o supervisor do agente (run-agent.sh) e o doctor.sh rodam NA box
// observada. Quando a box trava — que é o modo de falha real, visto em 07-11 e
// 08-10 — o vigia trava junto e ninguém fica sabendo. Este processo roda em outra
// máquina e só enxerga o que um usuário enxergaria.
//
// Este arquivo é PURO (sem fs, sem rede, sem relógio): recebe o resultado da sonda
// e decide. A rede fica em main.ts.

export type Health = 'up' | 'degraded' | 'down';

export interface Sample {
  ts: number;
  health: Health;
  latencyMs: number | null;
  detail: string;
}

export interface StatusBody {
  ok?: boolean;
  uptimeSec?: number;
  accounts?: number;
  agents?: number;
  browsers?: number;
  rssMb?: number;
}

export interface ProbeResult {
  status: number | null;      // null = não respondeu (timeout / conexão recusada)
  body: StatusBody | null;
  latencyMs: number | null;
  error?: string;
}

// `degraded` = relay no ar mas nenhuma máquina de usuário conectada. Distinguir isso
// de `down` importa: são causas e donos diferentes — relay caído é problema da VPS
// do relay, agente ausente é problema da box do usuário.
export function classify(r: ProbeResult): Omit<Sample, 'ts'> {
  if (r.status === null) return { health: 'down', latencyMs: null, detail: r.error ?? 'sem resposta' };
  if (r.status < 200 || r.status >= 300) return { health: 'down', latencyMs: r.latencyMs, detail: `http ${r.status}` };
  if (r.body?.ok !== true) return { health: 'down', latencyMs: r.latencyMs, detail: 'corpo sem ok:true' };

  const { accounts, agents } = r.body;
  // Sem token de detalhe o corpo não traz contagem — só dá pra afirmar que o relay
  // responde. Não inventar `up` completo a partir de dado que não veio.
  if (accounts === undefined || agents === undefined) {
    return { health: 'up', latencyMs: r.latencyMs, detail: 'relay ok (sem detalhe)' };
  }
  if (accounts > 0 && agents === 0) {
    return { health: 'degraded', latencyMs: r.latencyMs, detail: `${accounts} conta(s), nenhum agente conectado` };
  }
  return { health: 'up', latencyMs: r.latencyMs, detail: `${agents}/${accounts} agente(s) online` };
}

export interface AlertState {
  observed: Health;      // última leitura crua
  streak: number;        // leituras consecutivas iguais a `observed`
  confirmed: Health;     // estado já confirmado (e do qual se alertou)
}

export interface Alert {
  from: Health;
  to: Health;
  detail: string;
}

export const initialAlertState = (): AlertState => ({ observed: 'up', streak: 0, confirmed: 'up' });

// Só alerta depois de `confirmAfter` leituras iguais seguidas. Uma sonda solta erra
// por qualquer soluço de rede no meio do caminho; alertar na primeira falha treina
// o dono a ignorar o alerta, que é pior que não ter alerta.
export function nextAlert(
  state: AlertState,
  sample: Pick<Sample, 'health' | 'detail'>,
  confirmAfter: number,
): { state: AlertState; alert: Alert | null } {
  const streak = sample.health === state.observed ? state.streak + 1 : 1;
  const next: AlertState = { observed: sample.health, streak, confirmed: state.confirmed };
  if (streak < confirmAfter || sample.health === state.confirmed) return { state: next, alert: null };
  return {
    state: { ...next, confirmed: sample.health },
    alert: { from: state.confirmed, to: sample.health, detail: sample.detail },
  };
}
