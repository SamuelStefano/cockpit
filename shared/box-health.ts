// Machine health: what the agent checks about its own box, and how each fact
// becomes ok / warn / error plus a fix the owner can run. Pure on both sides: the
// agent collects raw facts (server/box-health.ts), this file judges them, and the
// browser re-validates whatever arrives before rendering it.

export type HealthLevel = 'ok' | 'warn' | 'error';

export type HealthId = 'agent' | 'claude-cli' | 'claude-auth' | 'node' | 'pty' | 'disk' | 'devices' | 'self-update';

export interface HealthItem {
  id: HealthId;
  label: string;
  level: HealthLevel;
  detail: string;
  hint?: string;
}

export interface BoxHealth {
  at: number;
  items: HealthItem[];
}

export interface SmokeResult {
  state: 'running' | 'done';
  ok?: boolean;
  ms?: number;
  error?: string;
  hint?: string;
}

const RESTART = 'sudo systemctl restart deck-agent';
const UPDATE_CLI = 'npm install -g @anthropic-ai/claude-code@latest (ou `claude update`), depois ' + RESTART;

export interface AgentVersionFacts { head: string; boot: string; behind: number | null }

export function evalAgentVersion(f: AgentVersionFacts): HealthItem {
  const base = { id: 'agent' as const, label: 'Código do agente' };
  if (!f.head) return { ...base, level: 'warn', detail: 'versão desconhecida (não é um clone git)' };
  if (f.boot && f.boot !== f.head) {
    return { ...base, level: 'warn', detail: `rodando ${f.boot}, disco em ${f.head}`, hint: `Código novo no disco ainda não carregou: ${RESTART}` };
  }
  if (f.behind && f.behind > 0) {
    return { ...base, level: 'warn', detail: `${f.head} · ${f.behind} commit(s) atrás da main`, hint: 'O agente se atualiza sozinho em até ~10 min. Se continuar atrás, veja "Atualização automática".' };
  }
  return { ...base, level: 'ok', detail: f.behind === 0 ? `${f.head} · em dia com a main` : f.head };
}

// Flags every chat turn passes to `claude` (server/engine/claude.ts buildArgs).
// Checked by capability, not version number: a CLI that lacks one fails every prompt.
export const REQUIRED_CLI_FLAGS = ['--input-format', '--include-partial-messages', '--strict-mcp-config', '--permission-mode', '--effort'];
// Only the locked bot profile needs these (server/engine/restricted-profile.ts).
export const BOT_CLI_FLAGS = ['--restricted', '--tools'];

export interface ClaudeCliFacts { path: string; version: string; help: string }

export function missingFlags(help: string, flags: string[]): string[] {
  return flags.filter((f) => !help.includes(f));
}

export function evalClaudeCli(f: ClaudeCliFacts): HealthItem {
  const base = { id: 'claude-cli' as const, label: 'Claude Code CLI' };
  if (!f.path) {
    return { ...base, level: 'error', detail: 'claude não encontrado no PATH do agente', hint: `Instale: ${UPDATE_CLI}` };
  }
  if (!f.version) {
    return { ...base, level: 'error', detail: `${f.path} não responde --version`, hint: `Reinstale o CLI: ${UPDATE_CLI}` };
  }
  const where = `${f.version} · ${f.path}`;
  if (!f.help) return { ...base, level: 'warn', detail: `${where} · --help não respondeu` };
  const missing = missingFlags(f.help, REQUIRED_CLI_FLAGS);
  if (missing.length) {
    return { ...base, level: 'error', detail: `${where} · antigo demais (sem ${missing.join(', ')})`, hint: `Todo prompt vai falhar até atualizar: ${UPDATE_CLI}` };
  }
  const bots = missingFlags(f.help, BOT_CLI_FLAGS);
  if (bots.length) {
    return { ...base, level: 'warn', detail: `${where} · sem ${bots.join(', ')}`, hint: `Bots da Equipe no perfil travado vão falhar: ${UPDATE_CLI}` };
  }
  return { ...base, level: 'ok', detail: where };
}

export function evalClaudeAuth(f: { ready: boolean; held: boolean }): HealthItem {
  const base = { id: 'claude-auth' as const, label: 'Conta Anthropic' };
  if (!f.ready) {
    return { ...base, level: 'error', detail: 'claude não está logado nesta máquina', hint: 'Use "conectar conta" no chat do Deck, ou rode `claude auth login` na máquina com o usuário do agente.' };
  }
  if (f.held) {
    return { ...base, level: 'error', detail: 'o login expirou e não renovou sozinho', hint: 'Rode `claude /login` num terminal da máquina e reenvie o prompt.' };
  }
  return { ...base, level: 'ok', detail: 'logado' };
}

// The claude CLI declares engines node>=22 since 2.1.198: on Node 20 npm keeps
// installing 2.1.197, which the API refuses for new models.
export const MIN_NODE_MAJOR = 22;

export function evalNode(version: string): HealthItem {
  const base = { id: 'node' as const, label: 'Node.js' };
  const major = Number(/^v?(\d+)/.exec(version)?.[1] ?? NaN);
  if (!Number.isFinite(major)) return { ...base, level: 'warn', detail: version || 'versão desconhecida' };
  if (major < MIN_NODE_MAJOR) {
    return { ...base, level: 'error', detail: `${version} (mínimo ${MIN_NODE_MAJOR})`, hint: `O Claude Code exige Node ${MIN_NODE_MAJOR}+. Com o Node do instalador (~/.deck-node) o agente atualiza sozinho no próximo boot; num Node do sistema, instale o Node ${MIN_NODE_MAJOR} LTS (ou rode o instalador de novo, que baixa um em ~/.deck-node) e reinicie o deck-agent.` };
  }
  return { ...base, level: 'ok', detail: version };
}

export function evalPty(f: { ok: boolean; error: string }): HealthItem {
  const base = { id: 'pty' as const, label: 'Terminais (node-pty)' };
  if (f.ok) return { ...base, level: 'ok', detail: 'carrega' };
  return {
    ...base, level: 'warn', detail: f.error ? `não carrega: ${f.error.slice(0, 120)}` : 'não carrega',
    hint: 'Chats funcionam, terminais não. Instale make, g++ e python3 e rode `npm ci` no clone do agente (ou o instalador de novo).',
  };
}

const GB = 1024 ** 3;
export const DISK_ERROR_BYTES = 1 * GB;
export const DISK_WARN_BYTES = 5 * GB;

export function fmtBytes(n: number): string {
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`;
  return `${Math.round(n / 1024 ** 2)} MB`;
}

export function evalDisk(freeBytes: number | null): HealthItem {
  const base = { id: 'disk' as const, label: 'Disco livre (home)' };
  if (freeBytes === null) return { ...base, level: 'warn', detail: 'não deu pra medir' };
  const detail = `${fmtBytes(freeBytes)} livres`;
  if (freeBytes < DISK_ERROR_BYTES) return { ...base, level: 'error', detail, hint: 'Sem espaço o claude falha ao gravar a sessão. Libere espaço (ex.: `du -sh ~/* | sort -h`).' };
  if (freeBytes < DISK_WARN_BYTES) return { ...base, level: 'warn', detail, hint: 'Pouco espaço: libere antes que os turnos comecem a falhar.' };
  return { ...base, level: 'ok', detail };
}

export function evalDevices(count: number | null): HealthItem {
  const base = { id: 'devices' as const, label: 'Aparelhos cadastrados' };
  if (count === null) return { ...base, level: 'warn', detail: 'lista de aparelhos ilegível', hint: 'Confira ~/.deck-agent/devices.json na máquina (ou `deck-agent devices`).' };
  if (count === 0) return { ...base, level: 'warn', detail: 'nenhum', hint: 'Rode `deck-agent enroll-device` na máquina para cadastrar este navegador.' };
  return { ...base, level: 'ok', detail: `${count}` };
}

export interface SelfUpdateFacts { result: string | null; reason: string }

export function evalSelfUpdate(f: SelfUpdateFacts): HealthItem {
  const base = { id: 'self-update' as const, label: 'Atualização automática' };
  switch (f.result) {
    case null: return { ...base, level: 'ok', detail: 'primeira checagem logo após o boot' };
    case 'current': return { ...base, level: 'ok', detail: 'em dia' };
    case 'waiting': return { ...base, level: 'ok', detail: 'atualização esperando os turnos terminarem' };
    case 'restarting': return { ...base, level: 'ok', detail: 'reiniciando com a versão nova' };
    case 'disabled': return { ...base, level: 'warn', detail: 'desligada (DECK_SELF_UPDATE=off)', hint: 'Atualize à mão: `git pull` no clone e ' + RESTART };
    case 'fetch-failed': return { ...base, level: 'warn', detail: 'não alcançou o GitHub', hint: 'Confira a rede da máquina: `git -C <clone> fetch origin main`.' };
    case 'diverged': return { ...base, level: 'warn', detail: 'o clone divergiu da main', hint: 'O clone tem commits próprios: `git reset --hard origin/main` no clone do agente.' };
    case 'known-bad':
    case 'rolled-back': return { ...base, level: 'warn', detail: 'a versão nova falhou e foi revertida', hint: 'Fica na versão anterior até sair uma correção na main.' };
    case 'merge-failed': return { ...base, level: 'warn', detail: 'fast-forward falhou', hint: 'Rode `git status` no clone do agente e limpe o que estiver no caminho.' };
    case 'skipped':
      if (/supervisor/.test(f.reason)) return { ...base, level: 'warn', detail: 'sem supervisor (systemd)', hint: 'Sem systemd o agente não reinicia sozinho nem se atualiza. Rode o instalador de novo.' };
      return { ...base, level: 'ok', detail: `pulada: ${f.reason}` };
    default: return { ...base, level: 'warn', detail: f.result };
  }
}

const RANK: Record<HealthLevel, number> = { ok: 0, warn: 1, error: 2 };

export function overallLevel(items: Pick<HealthItem, 'level'>[]): HealthLevel {
  return items.reduce<HealthLevel>((acc, i) => (RANK[i.level] > RANK[acc] ? i.level : acc), 'ok');
}

// Turns the real failure text of a smoke prompt into the fix. Order matters:
// the first pattern that matches names the most specific cause.
const SMOKE_HINTS: Array<[RegExp, string]> = [
  [/model.*(not found|not available|does not exist)|invalid model|does not support this model/i, 'O modelo não está disponível para esta conta/CLI. Atualize o CLI: ' + UPDATE_CLI],
  [/spawn claude ENOENT|claude: (command )?not found/i, 'O agente não acha o `claude`. Instale: ' + UPDATE_CLI],
  [/unknown option|unknown argument|error: option/i, 'O claude desta máquina é antigo demais para o Deck. Atualize: ' + UPDATE_CLI],
  [/OAuth|login|authenticat|Invalid API key|invalid bearer|401/i, 'O login do claude falhou. Use "conectar conta" no chat, ou `claude auth login` na máquina.'],
  [/rate.?limit|429|usage limit|quota/i, 'A conta bateu no limite de uso. Espere o reset ou use outra conta.'],
  [/ENOSPC|no space/i, 'Disco cheio na máquina. Libere espaço e teste de novo.'],
  [/EACCES|EPERM|permission denied/i, 'Permissão negada na máquina: confira o dono de ~/.claude e da pasta de trabalho (`ls -la ~`).'],
  [/timeout|timed out|demorou/i, 'O claude não respondeu a tempo. Confira a rede da máquina e tente de novo.'],
  [/ENOTFOUND|ECONNREFUSED|ECONNRESET|network|fetch failed/i, 'A máquina não alcança a API da Anthropic. Confira DNS, firewall e proxy.'],
];

export function smokeHint(error: string): string {
  for (const [re, hint] of SMOKE_HINTS) if (re.test(error)) return hint;
  return 'Veja o log do agente: `journalctl -u deck-agent -n 50 --no-pager`.';
}

const LEVELS: ReadonlySet<string> = new Set(['ok', 'warn', 'error']);
const IDS: ReadonlySet<string> = new Set(['agent', 'claude-cli', 'claude-auth', 'node', 'pty', 'disk', 'devices', 'self-update']);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export function parseHealth(raw: unknown): BoxHealth | null {
  const h = raw as { at?: unknown; items?: unknown } | null;
  if (!h || typeof h !== 'object' || !Array.isArray(h.items)) return null;
  const items: HealthItem[] = [];
  for (const r of h.items.slice(0, 20)) {
    const i = r as Record<string, unknown> | null;
    if (!i || !IDS.has(i.id as string) || !LEVELS.has(i.level as string)) continue;
    const hint = str(i.hint, 400);
    items.push({ id: i.id as HealthId, label: str(i.label, 60), level: i.level as HealthLevel, detail: str(i.detail, 200), ...(hint ? { hint } : {}) });
  }
  return { at: typeof h.at === 'number' ? h.at : Date.now(), items };
}

export function parseSmoke(raw: Record<string, unknown>): SmokeResult | null {
  if (raw.state !== 'running' && raw.state !== 'done') return null;
  const out: SmokeResult = { state: raw.state };
  if (typeof raw.ok === 'boolean') out.ok = raw.ok;
  if (typeof raw.ms === 'number') out.ms = raw.ms;
  if (typeof raw.error === 'string') out.error = raw.error.slice(0, 400);
  if (typeof raw.hint === 'string') out.hint = raw.hint.slice(0, 400);
  return out;
}
