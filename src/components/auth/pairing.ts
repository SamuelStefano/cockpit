// Lógica pura do onboarding de pareamento. O dashboard mostrava "aguardando o
// agente conectar…" pra sempre: o código de pareamento expira em 10min no relay e
// nada na tela dizia isso, então quem voltava meia hora depois colava um comando
// morto e via o mesmo spinner. Ponto de abandono #1 do backlog.

export type RelayProbe = 'unknown' | 'checking' | 'ok' | 'unreachable' | 'rejected';

// Quanto falta do código, em ms. Sem prazo conhecido devolve null (relay antigo
// não manda `expiresAt`) — aí a UI não inventa contagem nenhuma.
export function remainingMs(expiresAt: string | null, now: number): number | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return null;
  return Math.max(0, at - now);
}

export function isExpired(expiresAt: string | null, now: number): boolean {
  const left = remainingMs(expiresAt, now);
  return left !== null && left === 0;
}

// m:ss — o prazo é de minutos, então segundos soltos ("438s") não ajudam ninguém.
export function fmtCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface PairDiagnosis {
  tone: 'neutral' | 'orange' | 'green' | 'red' | 'yellow';
  title: string;
  // O que rodar NA VPS, em ordem. Diagnóstico sem comando é só um aviso bonito.
  steps: string[];
}

export interface DiagnoseInput {
  probe: RelayProbe;
  agentOnline: boolean;
  expired: boolean;
  hasCode: boolean;
}

const AGENT_STEPS = [
  'systemctl status deck-agent --no-pager',
  'journalctl -u deck-agent -n 50 --no-pager',
  'curl -sS https://relay.devfellowship.com/status',
];

// Traduz o estado observável em algo acionável. A ordem importa: sem relay
// alcançável nada mais é diagnosticável, e um código expirado explica sozinho o
// silêncio do agente — mandar o usuário caçar log da VPS ali seria caça-fantasma.
export function diagnose({ probe, agentOnline, expired, hasCode }: DiagnoseInput): PairDiagnosis {
  if (agentOnline) {
    return { tone: 'green', title: 'Agente conectado — abrindo o Deck…', steps: [] };
  }
  if (probe === 'checking') {
    return { tone: 'neutral', title: 'Testando a conexão com o relay…', steps: [] };
  }
  if (probe === 'unreachable') {
    return {
      tone: 'red',
      title: 'Este navegador não alcança o relay. O problema está aqui, não na VPS.',
      steps: ['Confira sua rede/VPN e tente de novo', 'curl -sS https://relay.devfellowship.com/status'],
    };
  }
  if (probe === 'rejected') {
    return {
      tone: 'red',
      title: 'O relay respondeu, mas recusou esta sessão. Saia e entre de novo.',
      steps: [],
    };
  }
  if (expired) {
    return {
      tone: 'yellow',
      title: 'O código expirou — o comando antigo não pareia mais. Gere um novo.',
      steps: [],
    };
  }
  if (!hasCode) {
    return { tone: 'neutral', title: 'Gerando um código de pareamento…', steps: [] };
  }
  if (probe === 'ok') {
    return {
      tone: 'orange',
      title: 'O relay está de pé e ninguém pareou ainda: o comando não rodou na VPS, ou o agente subiu e caiu.',
      steps: AGENT_STEPS,
    };
  }
  return { tone: 'neutral', title: 'Aguardando o agente conectar…', steps: [] };
}
