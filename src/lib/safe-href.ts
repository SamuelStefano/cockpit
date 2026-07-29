// Allowlist de esquema pra href vindo de conteúdo não-confiável (saída de modelo,
// tool ou registro do .jsonl da sessão): um `javascript:` viraria âncora que
// executa script no clique, e `data:text/html` é o mesmo vetor. Só http(s)/mailto
// e caminhos relativos passam; o resto perde o href e vira texto puro.
export function safeHref(url: string): string | undefined {
  const u = url.trim();
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[/#?]/.test(u) || /^[\w.-]+(\/|$)/.test(u)) return u; // relativo (sem esquema)
  return undefined;
}
