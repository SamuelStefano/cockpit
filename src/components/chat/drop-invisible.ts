import type { Message } from '../../data/types';
import { hasVisibleAssistantContent } from './visible-blocks';

// Tira da lista as mensagens que o MessageView renderiza como null (só-tool com
// as ferramentas ocultas). Elas não aparecem, mas ficavam ENTRE dois divisores
// consecutivos e quebravam o coalesce — daí a parede de "PR #NNN" empilhados.
// A última mensagem fica sempre: com turno rodando ela é o alvo do indicador de
// pensamento, que a renderiza mesmo sem conteúdo visível.
export function dropInvisible(messages: Message[], showTools: boolean): Message[] {
  const last = messages.length - 1;
  return messages.filter((m, i) => i === last || m.role !== 'assistant' || hasVisibleAssistantContent(m.blocks, showTools));
}
