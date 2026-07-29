import { useMemo } from 'react';
import { clampToPendingQuestion } from '../../cockpit/pending-question';
import { coalesceCompacts } from './coalesce-compacts';
import { dropInvisible } from './drop-invisible';
import { usePersisted } from '../../lib/persist';
import { SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT } from '../../lib/prefs';
import type { Message } from '../../data/mock';

// A lista que a thread realmente renderiza, em ordem:
// 1. clampToPendingQuestion trava numa pergunta pendente do agente — o `claude -p`
//    auto-resolve o AskUserQuestion e segue gerando, e o card "sumia" enterrado.
// 2. dropInvisible tira as mensagens que renderizam null (só-tool com ferramentas
//    ocultas); invisíveis, elas ainda separavam divisores e impediam o colapso.
// 3. coalesceCompacts junta runs de divisores num só — loop noturno empilhava
//    dezenas de wakeups e de PRs, escondendo prompt e resposta.
export function useShownMessages(messages: Message[]): Message[] {
  const [showTools] = usePersisted<boolean>(SHOW_TOOLS_KEY, SHOW_TOOLS_DEFAULT);
  // messages troca de referência a cada token streamado; a cadeia só deve rodar
  // quando a lista (ou a preferência) realmente muda.
  return useMemo(
    () => coalesceCompacts(dropInvisible(clampToPendingQuestion(messages), showTools)),
    [messages, showTools],
  );
}
