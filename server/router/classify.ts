// Classificador de falha do turno. O Deck não fala HTTP com o provedor (quem fala
// é o `claude`), então o sinal não é status code: é o texto que o CLI cospe antes
// de sair + o rate_limit_event que ele emite. A distinção que importa é a mesma do
// OmniRoute: 429 de minuto (espera e volta) vs. cota do dia/mês acabada (troca de
// provedor agora) vs. credencial morta (não adianta tentar de novo).

export type FailureKind = 'ok' | 'transient' | 'rate_limit' | 'quota_exhausted' | 'auth';

export interface TurnOutcome {
  limited: boolean;   // rate_limit_event com status fora de allowed*
  tools: number;      // tools executadas no turno
  text: string;       // resposta do assistente
  error?: string;     // stderr/erro reportado no close
}

// Cota da janela ACABOU (dia/mês/créditos): esperar não resolve dentro da janela.
const QUOTA_RE = /insufficient[_ ]quota|credit balance is too low|out of (credits|tokens)|no credits|daily (quota|limit)|quota exceeded|exceeded your (current )?quota|today'?s quota|free tier .{0,40}exhausted|billing|payment required|402|cr[ée]ditos? esgotad|sem cr[ée]ditos|limite di[áa]rio|cota (di[áa]ria|mensal)/i;

// Teto de janela curta: reseta sozinho, dá pra voltar depois.
const RATE_RE = /rate[_ ]?limit|too many requests|\b429\b|usage limit reached|limit reached|overloaded_error|limite de uso|tokens esgotad|sem tokens/i;

// Credencial inválida/conta desativada: trocar de provedor é a única saída.
const AUTH_RE = /\b401\b|\b403\b|invalid[_ ]api[_ ]key|invalid x-api-key|authentication[_ ]error|permission[_ ]error|unauthorized|not authorized|account .{0,20}(deactivat|suspend|disabl)|api key (not found|expired)/i;

// Falha de rede/servidor: retenta o MESMO provedor depois de um respiro curto.
const TRANSIENT_RE = /\b5\d\d\b|overloaded|timed? ?out|timeout|econnreset|econnrefused|enotfound|socket hang up|fetch failed|internal server error|bad gateway|service unavailable/i;

// O CLI que bate no teto imprime uma linha e sai. Uma resposta legítima que EXPLICA
// limite de uso escreve muito mais que isso — o tamanho é o que separa bailout de
// assunto (mesma heurística que quota.ts já usa pra devolver o item da fila).
const BAIL_MAX_CHARS = 400;

// Texto que vale como sinal de falha: o stderr sempre conta; a resposta só conta se
// for curta (bailout) e sem tool nenhuma — turno que trabalhou não falhou.
export function failureSignal(o: TurnOutcome): string {
  const err = (o.error ?? '').trim();
  const text = o.text.trim();
  const bail = o.tools === 0 && text.length > 0 && text.length <= BAIL_MAX_CHARS ? text : '';
  return `${err}\n${bail}`.trim();
}

export function classifyOutcome(o: TurnOutcome): FailureKind {
  const signal = failureSignal(o);
  if (signal) {
    if (AUTH_RE.test(signal)) return 'auth';
    if (QUOTA_RE.test(signal)) return 'quota_exhausted';
    if (RATE_RE.test(signal)) return 'rate_limit';
    if (TRANSIENT_RE.test(signal)) return 'transient';
  }
  // rate_limit_event sem texto nenhum: o turno morreu no teto do plano e o CLI nem
  // chegou a escrever. Só vale como falha se nada foi produzido.
  if (o.limited && o.tools === 0 && o.text.trim() === '') return 'rate_limit';
  return 'ok';
}

const MAX_RESET_MS = 7 * 24 * 60 * 60_000;

// Dica de quando o provedor volta, extraída do próprio texto do erro. Sem isso a
// cota diária seria retestada a cada 30s pelo drainer. Formatos cobertos:
// "retry-after: 90", "try again in 2h30m", "resets in 45 minutes", "resets at <iso>".
export function parseResetHint(text: string, now = Date.now()): number | null {
  if (!text) return null;

  const retryAfter = /retry[- ]?after["':\s]+(\d+)/i.exec(text);
  if (retryAfter) return capReset(Number(retryAfter[1]) * 1000);

  const iso = /resets? at ["']?(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/i.exec(text);
  if (iso) {
    const at = Date.parse(iso[1]);
    if (Number.isFinite(at) && at > now) return capReset(at - now);
  }

  const rel = /(?:resets?|try again|retry|available)\s+(?:again\s+)?in\s+([\dhms\s.]+)/i.exec(text);
  if (rel) {
    const ms = parseDuration(rel[1]);
    if (ms) return capReset(ms);
  }

  const spelled = /(?:resets?|try again|retry)\s+(?:again\s+)?in\s+(\d+)\s*(second|minute|hour|day)s?/i.exec(text);
  if (spelled) {
    const n = Number(spelled[1]);
    const unit = { second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000 }[spelled[2].toLowerCase() as 'second'];
    return capReset(n * unit);
  }

  if (/try again tomorrow|amanh[ãa]/i.test(text)) return capReset(12 * 3_600_000);
  return null;
}

// "2h30m15s" / "45m" / "90s" → ms. Retorna 0 se nada casar.
function parseDuration(raw: string): number {
  let ms = 0;
  const re = /(\d+(?:\.\d+)?)\s*([hms])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    ms += n * (unit === 'h' ? 3_600_000 : unit === 'm' ? 60_000 : 1000);
  }
  return ms;
}

function capReset(ms: number): number {
  return Math.max(0, Math.min(ms, MAX_RESET_MS));
}
