import { takeToken, type Bucket } from '../ws/guard';

// Freio da rota /mcp. O limiter do WS (`ws/guard.ts`) é POR CONEXÃO e chaveado
// por frame; esta rota é HTTP stateless, então o balde vive no módulo — que é o
// escopo certo aqui: o Deck é single-account, um token = um ator.
//
// Sem isto o `sessions_search` (grep sobre centenas de MB) e o `sessions_read`
// (parse de JSONL que chega a centenas de MB) escapavam do balde HEAVY que o WS
// impõe ao MESMO trabalho — pelo mesmo vetor de DoS, agora numa porta alcançável
// de fora da box.

const GLOBAL_RATE = 30, GLOBAL_BURST = 60;
const HEAVY_RATE = 8, HEAVY_BURST = 15;

// Espelha o HEAVY do WS: o que faz grep, varre o diretório de sessões ou parseia
// um transcript inteiro. `contexts_*`/`skills_*` leem arquivos pequenos e ficam
// só no balde global.
const HEAVY_TOOLS: ReadonlySet<string> = new Set(['sessions_search', 'sessions_read', 'sessions_list']);

export function isHeavyTool(name: string): boolean {
  return HEAVY_TOOLS.has(name);
}

export function createMcpLimiter(now = () => Date.now()) {
  const global: Bucket = { tokens: GLOBAL_BURST, last: now() };
  const heavy: Bucket = { tokens: HEAVY_BURST, last: now() };
  return {
    // Uma requisição HTTP = um token do balde global, antes de o SDK sequer
    // parsear o corpo: uma rajada de JSON-RPC malformado custa igual.
    allowRequest(): boolean {
      return takeToken(global, now(), GLOBAL_RATE, GLOBAL_BURST);
    },
    // O nome da tool só existe depois do parse do JSON-RPC, então o balde caro
    // é cobrado lá dentro (runTool), não aqui na borda.
    allowTool(name: string): boolean {
      if (!isHeavyTool(name)) return true;
      return takeToken(heavy, now(), HEAVY_RATE, HEAVY_BURST);
    },
  };
}

export const mcpLimiter = createMcpLimiter();
