import type { BoxInfo } from '../../../shared/boxes';
import type { SealState } from '../../cockpit/sealed-socket';
import { boxLabel, currentBoxId } from '../../cockpit/boxes-store';
import type { boxStore } from '../../cockpit/boxes-store';

export type ConnCause = 'login-refused' | 'no-internet' | 'relay-unreachable' | 'box-offline' | 'handshake-silent';

export interface CauseInput {
  authRejected: boolean;
  online: boolean;
  relayAnswered: boolean;
  agentOnline: boolean;
  box: BoxInfo | null;
  seal: SealState;
}

// What the Deck knows, most specific first: a 4401 is never a network problem, and
// an answer from the relay rules out the network and the relay itself.
export function connectionCause(i: CauseInput): ConnCause {
  if (i.authRejected) return 'login-refused';
  if (!i.relayAnswered) return i.online ? 'relay-unreachable' : 'no-internet';
  if (i.box ? !i.box.online : !i.agentOnline) return 'box-offline';
  return 'handshake-silent';
}

// The box this tab dials; unbound with every box offline (no primary), the one
// seen last is the best guess of what the user expects to reach.
export function selectedBox(s: ReturnType<typeof boxStore.get>): BoxInfo | null {
  const boxes = s.frame?.boxes ?? [];
  const id = currentBoxId(s);
  const hit = id ? boxes.find((b) => b.id === id) : undefined;
  if (hit) return hit;
  if (boxes.length === 1) return boxes[0];
  const offline = boxes.filter((b) => !b.online).sort((a, b) => (b.lastSeen ?? '').localeCompare(a.lastSeen ?? ''));
  return offline.length && offline.length === boxes.length ? offline[0] : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

// Local time, relative to today: "hoje às 14:05", "ontem às 22:10", "27/10 às 09:00".
export function formatSince(iso: string | null, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff === 0) return `hoje às ${hm}`;
  if (diff === 1) return `ontem às ${hm}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${hm}`;
}

export interface CauseMessage { title: string; body: string; step: string; commands: boolean }

export function causeMessage(cause: ConnCause, ctx: { box: BoxInfo | null; host: string; now?: Date }): CauseMessage {
  const name = ctx.box ? boxLabel(ctx.box) : 'sua máquina';
  switch (cause) {
    case 'login-refused':
      return { title: 'Seu login não foi aceito', body: 'O servidor do Deck recusou a sua sessão — ela pode ter expirado.', step: 'Toque em reconectar; se continuar, saia e entre de novo.', commands: false };
    case 'no-internet':
      return { title: 'Sem internet neste aparelho', body: 'O Deck volta sozinho quando a conexão voltar.', step: 'Confira o Wi-Fi ou os dados móveis.', commands: false };
    case 'relay-unreachable':
      return { title: 'Servidor do Deck fora do alcance', body: `Sua internet funciona, mas ${ctx.host} não responde.`, step: 'O admin recebe um aviso automático. Tente de novo em alguns minutos.', commands: false };
    case 'box-offline': {
      const since = formatSince(ctx.box?.lastSeen ?? null, ctx.now);
      return { title: `A máquina ${name} está offline`, body: since ? `Sem sinal dela desde ${since}.` : 'Ela não está conectada ao Deck agora.', step: 'Ligue a máquina ou reinicie o agente nela:', commands: true };
    }
    case 'handshake-silent':
      return { title: `A máquina ${name} não respondeu`, body: 'O servidor está ok, mas o agente na máquina não completou a conexão.', step: 'Reinicie o agente na máquina:', commands: true };
  }
}

export const AGENT_COMMANDS = {
  status: 'sudo systemctl status deck-agent',
  logs: 'sudo journalctl -u deck-agent -n 80',
  restart: 'sudo systemctl restart deck-agent',
  update: 'sudo -u deck git -C /home/deck/.deck-src pull && sudo systemctl restart deck-agent',
} as const;
