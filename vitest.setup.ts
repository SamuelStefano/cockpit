import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Ambiente de teste isolado da máquina de quem roda. Sem isto, `npm test` na box de
// um dev com o Deck configurado subia arquivo DE VERDADE pro Supabase da DFL: o teste
// de anexos chama addUploadChunk → uploadToS3, e uploadToS3 só desliga quando não
// acha credencial. Medido: 7,08s de teste com a chave no ambiente contra 25ms sem —
// eram POSTs reais gravando lixo de fixture em storage compartilhado.

const home = mkdtempSync(join(tmpdir(), 'deck-test-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home;

// Credencial vinda do shell do dev (export no perfil) não é alcançada por HOME
// descartável — some daqui explicitamente.
for (const k of ['DECK_S3_ANON_KEY', 'DECK_S3_UPLOAD_URL']) delete process.env[k];

// Rede externa não entra em teste: quem depender dela é flaky por definição e pode
// mexer em infra compartilhada. Loopback segue liberado — o relay sobe servidor de
// verdade em 127.0.0.1 e conversa com ele.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const realFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const raw = typeof input === 'string' ? input
    : input instanceof URL ? input.href
    : (input as Request).url;
  let host = '';
  try { host = new URL(raw).hostname; } catch { host = 'localhost'; }
  if (!LOOPBACK.has(host)) {
    return Promise.reject(new Error(
      `rede externa bloqueada no teste: ${raw}\n` +
      'Injete um fetch fake (o padrão dos testes do relay) ou use vi.stubGlobal.',
    ));
  }
  return realFetch(input, init);
}) as typeof fetch;

// Desmonta o que cada teste renderizou. Sem isto os componentes ficam montados até
// o fim do ARQUIVO e, como o ambiente é derrubado logo depois, todo trabalho async
// pendente (timer de debounce, import dinâmico do shiki) acorda num mundo sem
// `window` e o setState vira `ReferenceError` — a "flake" que derrubava o CI
// apontando ora AppStudio, ora CodeBlock. A limpeza automática do testing-library
// só se registra sozinha com `globals: true`, e o projeto roda com globals off.
//
// Guardado por `document`: este setup também roda nos arquivos de ambiente node
// (server/, relay/), onde o testing-library não tem o que limpar.
if (typeof document !== 'undefined') {
  const { afterEach } = await import('vitest');
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);
}
