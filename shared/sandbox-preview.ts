export interface SandboxTarget {
  url: string;
  host: string;
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
