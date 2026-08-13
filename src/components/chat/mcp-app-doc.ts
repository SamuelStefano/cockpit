import type { McpAppView } from '../../../shared/protocol';

// CSP do iframe de MCP App. Deny-by-default (SEP-1865): o app só alcança a rede
// nos domínios que ele mesmo declarou em `_meta.ui.csp`. Sem declaração, nada.
// `unsafe-inline` em script/style é inerente ao formato — o recurso ui:// é um
// documento auto-contido — e é seguro porque o iframe roda SEM allow-same-origin:
// origem opaca, sem acesso ao localStorage do Deck (onde vive o JWT do Supabase).
export function mcpAppCsp(csp?: McpAppView['csp']): string {
  const src = (list: string[] | undefined, extra = '') => {
    const domains = (list ?? []).filter((d) => /^https:\/\/[^\s;']+$/.test(d));
    const parts = [extra, ...domains].filter(Boolean);
    return parts.length ? parts.join(' ') : "'none'";
  };
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "font-src data:",
    `img-src ${src(csp?.resourceDomains, 'data: blob:')}`,
    `connect-src ${src(csp?.connectDomains)}`,
    `frame-src ${src(csp?.frameDomains)}`,
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

// Injeta a CSP como primeiro filho do <head> — precisa vir antes de qualquer
// script do app, senão o próprio documento já teria executado sem política.
export function mcpAppDoc(html: string, csp?: McpAppView['csp']): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${mcpAppCsp(csp).replace(/"/g, '&quot;')}">`;
  const head = html.match(/<head[^>]*>/i);
  if (head) {
    const at = (head.index ?? 0) + head[0].length;
    return html.slice(0, at) + meta + html.slice(at);
  }
  const htmlTag = html.match(/<html[^>]*>/i);
  if (htmlTag) {
    const at = (htmlTag.index ?? 0) + htmlTag[0].length;
    return html.slice(0, at) + `<head>${meta}</head>` + html.slice(at);
  }
  return `<head>${meta}</head>${html}`;
}
