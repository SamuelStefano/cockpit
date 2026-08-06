import type { CompactMessage, Message } from '../data/mock';

// O divisor NÃO pode ir pro fim da thread enquanto um turno está em voo: o pipeline
// de render (`dropInvisible`/`collapseTurnTools`) só preserva uma bolha de assistente
// sem conteúdo quando ela é a ÚLTIMA, e o Chat ancora caret/pensando/tokens ao vivo em
// `i === último && role === 'assistant'`. Com o divisor na cauda a bolha em execução
// some e o stream parece morto até o F5. Inserindo ANTES dela mantemos a mesma ordem
// que o jsonl produz na releitura.
export function insertCompact(prev: Message[], divider: CompactMessage, runMsgId?: string): Message[] {
  const tail = prev[prev.length - 1];
  const at = runMsgId && tail && tail.id === runMsgId ? prev.length - 1 : prev.length;
  const before = prev[at - 1];
  if (!divider.kind && before && before.role === 'compact' && !before.kind) return prev;
  return [...prev.slice(0, at), divider, ...prev.slice(at)];
}
