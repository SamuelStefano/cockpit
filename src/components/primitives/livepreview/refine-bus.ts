// Ponte do modo iterativo: o card de live preview fica fundo na árvore de
// render (dentro do CodeBlock, sem acesso ao compositor), então em vez de
// passar callbacks por N níveis ele publica o pedido de refino aqui e o Chat
// assina e despacha como próximo prompt. Mesmo padrão do [[toast-bus]].
type Listener = (text: string) => void;

const listeners = new Set<Listener>();

export function requestRefine(text: string): void {
  const t = text.trim();
  if (!t) return;
  for (const l of listeners) l(t);
}

export function subscribeRefine(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
