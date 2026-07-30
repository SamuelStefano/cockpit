import type { Message, ToolCall } from '../../data/mock';
import { isQuestionTool, isTodoTool } from './visible-blocks';

// Mensagem sintética (só no cliente) que carrega TODAS as ferramentas de um
// turno numa caixa só. Não vem do backend: é derivada da thread.
export type ShownMessage = Message & { digest?: ToolCall[] };

// Uma resposta longa vira dezenas de mensagens do assistant, cada uma com seus
// tool cards — o chat virava uma parede de terminais e o que importa (o prompt e
// a resposta) sumia no meio. Aqui todas as ferramentas do turno saem das bolhas
// e viram UMA caixa fechada, ancorada onde a primeira rodou. Ficam de fora
// AskUserQuestion (o usuário precisa clicar) e listas de tarefas (progresso que
// ele acompanha ao vivo).
export function collapseTurnTools(messages: Message[], showTools: boolean): ShownMessage[] {
  if (!showTools) return messages;
  const out: ShownMessage[] = [];
  const last = messages.length - 1;
  let tools: ToolCall[] = [];
  let anchor = -1;
  let anchorId = '';

  const flush = () => {
    if (tools.length) out.splice(anchor, 0, { id: `digest:${anchorId}`, role: 'assistant', blocks: [], digest: tools });
    tools = [];
    anchor = -1;
  };

  messages.forEach((m, i) => {
    if (m.role !== 'assistant') {
      // Prompt do usuário fecha o turno; divisores (compactação/wakeup/PR) não.
      if (m.role === 'user') flush();
      out.push(m);
      return;
    }
    const kept = m.blocks.filter((b) => b.type !== 'tool' || isQuestionTool(b.tool) || isTodoTool(b.tool));
    if (kept.length === m.blocks.length) { out.push(m); return; }
    if (anchor < 0) { anchor = out.length; anchorId = m.id; }
    for (const b of m.blocks) if (b.type === 'tool' && !kept.includes(b)) tools.push(b.tool);
    // A última mensagem fica mesmo vazia: com turno rodando é ela que ancora o
    // indicador de pensamento.
    if (kept.length || i === last) out.push({ ...m, blocks: kept });
  });
  flush();
  return out;
}
