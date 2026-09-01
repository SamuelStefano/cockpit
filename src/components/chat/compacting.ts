import type { Message } from '../../data/types';
import { ctxPct } from '../../lib/format';
import { SATURATED_PCT } from './saturation';

// O CLI só conta que compactou DEPOIS de terminar (system/compact_boundary): nos
// minutos em que ele resume o histórico não sai UM frame, e o chat parece
// travado. Como não existe evento de início, o estado é inferido: turno rodando +
// contexto perto do teto + silêncio longo sem explicação mais simples.
// Compactar leva minutos, então o corte é folgado — mentir "compactando" sai
// mais caro do que demorar a mostrar.
export const COMPACT_SILENCE_MS = 45_000;

export interface CompactingInput {
  running: boolean;
  silentMs: number;
  contextTokens: number;
  quotaPaused: boolean;
  explained: boolean;
}

export function isCompacting({ running, silentMs, contextTokens, quotaPaused, explained }: CompactingInput): boolean {
  // Quota estourada trava o turno pelo mesmo sintoma (silêncio) e já tem banner
  // próprio; sem este veto os dois avisos se contradizem na tela.
  if (!running || quotaPaused || explained) return false;
  if (silentMs < COMPACT_SILENCE_MS) return false;
  // O medidor acompanha o turno (vem de cada evento `assistant`), mas o corte é o
  // mesmo do banner de saturação — abaixo dele o CLI não tem por que compactar.
  return ctxPct(contextTokens) >= SATURATED_PCT;
}

// Silêncio com causa mais banal que compactação: ferramenta ainda aberta (um
// build de 5min não é compactação) ou nenhum frame do assistente depois do
// último envio — no começo do turno o CLI monta o prefill e fica mudo, e em
// sessão saturada esse mudo passa do corte com facilidade.
export function silenceExplained(messages: Message[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return true;
  return last.blocks.some((b) => b.type === 'tool' && b.tool.status === 'running');
}

// Sinal de vida do turno por CONTEÚDO, não por identidade do array: `messages` é
// recriado em render sem frame novo (thread ausente vira `[]` nova, replay do
// reconnect devolve o mesmo histórico) e cada recriação zerava o cronômetro.
export function frameFingerprint(messages: Message[]): string {
  const last = messages[messages.length - 1];
  if (!last) return '';
  if (last.role !== 'assistant') return `${messages.length}:${last.id}`;
  const tail = last.blocks[last.blocks.length - 1];
  const tip = !tail ? ''
    : tail.type === 'text' ? `${tail.md.length}`
      : tail.type === 'thinking' ? `${tail.text.length}`
        : tail.type === 'code' ? `${tail.code.length}`
          : `${tail.tool.status}:${tail.tool.output.length}`;
  return `${messages.length}:${last.id}:${last.blocks.length}:${tip}`;
}
