export interface SandboxTarget {
  url: string;
  host: string;
}

const PREVIEW_SUFFIX = '.preview.devfellowship.com';

// Servir o preview por `<slug>.localhost:<porta do Deck>` o torna MESMO SITE que o
// Deck, e só assim cookie de sessão e localStorage param de ser tratados como de
// terceiro (era isso que abria o preview deslogado). Fora de `localhost` não dá:
// subdomínio de IP não resolve e subdomínio de domínio real exigiria DNS.
export function proxiedSandboxUrl(target: SandboxTarget, deckHost: string): string | undefined {
  if (!target.host.endsWith(PREVIEW_SUFFIX)) return undefined;
  const [deckName, deckPort] = deckHost.split(':');
  if (deckName !== 'localhost') return undefined;
  const slug = target.host.slice(0, -PREVIEW_SUFFIX.length);
  if (slug.includes('.')) return undefined;
  const { pathname, search, hash } = new URL(target.url);
  return `http://${slug}.localhost${deckPort ? `:${deckPort}` : ''}${pathname}${search}${hash}`;
}

// O corpo da cerca ```sandbox vem de conteúdo não-confiável (saída de modelo, JSONL
// da sessão) e vira o src de um iframe. `javascript:` e `data:text/html` executam
// script ali, então o esquema é allowlist, não blocklist.
export function parseSandboxTarget(body: string): SandboxTarget | undefined {
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    try {
      const parsed = new URL(line);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
      return { url: parsed.toString(), host: parsed.host };
    } catch {
      return undefined;
    }
  }
  return undefined;
}
