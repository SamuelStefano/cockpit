import type { Block, Message, ToolCall } from '../../data/mock';
import type { ShownMessage } from './shown';
import { isQuestionTool } from './visible-blocks';

// O turno em curso chega por delta: a thread inteira é recalculada a cada chunk.
// Sem estes caches toda bolha do histórico ganharia referência nova por token e o
// memo do MessageRow não seguraria nada. As chaves são as mensagens originais, que
// o patch de streaming preserva por referência — some junto com a thread.
const prunedCache = new WeakMap<Message, ShownMessage>();
const digestCache = new WeakMap<Message, ShownMessage>();

// Uma resposta longa vira dezenas de tool cards — o chat virava uma parede de
// terminais e o que importa (o prompt e a resposta) sumia no meio. Aqui todas as
// ferramentas do turno saem das bolhas e viram UMA caixa fechada, no topo do
// trecho onde rodaram. Só AskUserQuestion fica de fora: o turno só destrava se o
// usuário clicar. As listas de tarefas também entram na caixa — o progresso
// continua visível na bandeja de tarefas do rodapé, que lê a thread crua.
export function collapseTurnTools(messages: Message[], showTools: boolean): ShownMessage[] {
  if (!showTools) return messages;
  const out: ShownMessage[] = [];
  const last = messages.length - 1;
  let tools: ToolCall[] = [];
  let anchor = -1;
  let anchorMsg: Message | null = null;

  const flush = () => {
    if (anchorMsg && tools.length) out.splice(anchor, 0, digestFor(anchorMsg, tools));
    tools = [];
    anchor = -1;
    anchorMsg = null;
  };

  messages.forEach((m, i) => {
    if (m.role !== 'assistant') {
      // Prompt do usuário fecha o turno; divisores (compactação/wakeup/PR) não.
      if (m.role === 'user') flush();
      out.push(m);
      return;
    }
    const kept = m.blocks.filter((b) => b.type !== 'tool' || isQuestionTool(b.tool));
    if (kept.length === m.blocks.length) { out.push(m); return; }
    // Ao vivo o turno inteiro se acumula numa bolha só, então a caixa entra antes
    // dela: o texto do turno fica junto embaixo em vez de partido em duas bolhas.
    if (!anchorMsg) { anchor = out.length; anchorMsg = m; }
    for (const b of m.blocks) if (b.type === 'tool' && !kept.includes(b)) tools.push(b.tool);
    // A última mensagem fica mesmo vazia: é ela que ancora o indicador de
    // pensamento e o "Pensou por X" de um turno que só usou ferramentas.
    if (kept.length || i === last) out.push(prune(m, kept));
  });
  flush();
  return out;
}

function prune(m: Extract<Message, { role: 'assistant' }>, kept: Block[]): ShownMessage {
  const hit = prunedCache.get(m);
  if (hit) return hit;
  const node: ShownMessage = { ...m, blocks: kept };
  prunedCache.set(m, node);
  return node;
}

function digestFor(anchorMsg: Message, tools: ToolCall[]): ShownMessage {
  const hit = digestCache.get(anchorMsg);
  if (hit && sameTools(hit.digest!, tools)) return hit;
  const node: ShownMessage = { id: `digest:${anchorMsg.id}`, role: 'assistant', blocks: [], digest: tools };
  digestCache.set(anchorMsg, node);
  return node;
}

// Ferramenta que muda de estado vira objeto novo no patch, então comparar por
// referência já pega "chegou saída nova" sem varrer o conteúdo.
function sameTools(a: ToolCall[], b: ToolCall[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}
