import type { Block, ToolCall } from '../../data/mock';

// AskUserQuestion sempre conta como visível: é uma ação que o usuário PRECISA
// ver pra desbloquear o turno, mesmo com as tools ocultas.
export function isQuestionTool(t: ToolCall): boolean {
  return t.name === 'AskUserQuestion' && !!t.questions?.length;
}

// Lista de tarefas (TodoWrite/TaskCreate/TaskUpdate com snapshot) também fura o
// toggle: é estado de progresso que o usuário acompanha, como no terminal — com
// as tools ocultas a lista simplesmente sumia ("não consigo ver as tarefas").
export function isTodoTool(t: ToolCall): boolean {
  return !!t.todos?.length;
}

// Com as tools ocultas (toggle no menu do perfil), uma mensagem só-de-tools não
// tem NADA renderizável — sem este check a linha aparecia como um rótulo
// "opus…" órfão por mensagem de ferramenta, poluindo o chat inteiro.
export function hasVisibleAssistantContent(blocks: Block[], showTools: boolean): boolean {
  // Fail-open: só tool é ocultável — um tipo de bloco futuro continua visível
  // por padrão em vez de sumir a linha inteira em silêncio.
  return blocks.some((b) => b.type !== 'tool' || showTools || isQuestionTool(b.tool) || isTodoTool(b.tool));
}
