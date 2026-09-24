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

// Only a doctype, comments, whitespace and the <html> tag may precede the spot
// where the meta goes. A `<script>` before `<head>` (or a `<head>` inside an
// earlier comment) would otherwise run before the policy exists.
const PREAMBLE = /^(?:\s|<!--[\s\S]*?-->|<!doctype[^>]*>|<html(?=[\s>])[^>]*>)*$/i;
const DOCTYPE = /^(?:\s|<!--[\s\S]*?-->)*<!doctype[^>]*>/i;

// Injeta a CSP como primeiro filho do <head> — precisa vir antes de qualquer
// script do app, senão o próprio documento já teria executado sem política.
export function mcpAppDoc(html: string, csp?: McpAppView['csp']): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${mcpAppCsp(csp).replace(/"/g, '&quot;')}">`;
  // `(?=[\s>])`: a bare `<head` prefix also matched `<header>`, which put the
  // CSP meta in the body where browsers ignore it — the app ran with no policy.
  const head = html.match(/<head(?=[\s>])[^>]*>/i);
  if (head && PREAMBLE.test(html.slice(0, head.index))) {
    const at = (head.index ?? 0) + head[0].length;
    return html.slice(0, at) + meta + html.slice(at);
  }
  const htmlTag = html.match(/<html(?=[\s>])[^>]*>/i);
  if (!head && htmlTag && PREAMBLE.test(html.slice(0, htmlTag.index))) {
    const at = (htmlTag.index ?? 0) + htmlTag[0].length;
    return html.slice(0, at) + `<head>${meta}</head>` + html.slice(at);
  }
  // Content comes first: a meta before it opens <head> implicitly, and the later
  // <html>/<head> tags are merged by the parser. Stay after the doctype so the
  // document keeps standards mode.
  const at = html.match(DOCTYPE)?.[0].length ?? 0;
  return html.slice(0, at) + `<head>${meta}</head>` + html.slice(at);
}
