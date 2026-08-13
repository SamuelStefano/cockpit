import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import type { RouteView, RoutesSnapshot } from '../../shared/protocol';
import { managedEnvSync } from '../admin-ops';
import {
  CATALOG, PLAN_PROVIDER_ID, buildCustomProvider, findProvider, isSafeCustom, isNativeAnthropic, mapModel,
  type CustomProviderInput, type ProviderDef,
} from './catalog';
import { classifyOutcome, failureSignal, parseResetHint, type FailureKind, type TurnOutcome } from './classify';
import { type BreakerState, prune, recordFailure, recordSuccess, openUntil } from './breaker';
import { type RouteCandidate, selectRoute, shouldReturnTo, skipReason } from './select';

// Estado vivo do roteador: qual provedor está ativo agora, quem está em cooldown, e
// o env que vai no spawn do `claude`. Os módulos vizinhos (catalog/classify/breaker/
// select) são puros; a sujeira de disco e de processo mora aqui.

const CONFIG_FILE = process.env.DECK_ROUTES_FILE ?? join(homedir(), '.deck-agent', 'routes.json');
const STATE_FILE = process.env.DECK_ROUTER_STATE_FILE ?? join(homedir(), '.cockpit', 'router-state.json');
const ANTHROPIC_CRED = process.env.DECK_ANTHROPIC_CRED_FILE ?? join(homedir(), '.config', 'anthropic', 'credentials');

export interface RouteOverride { enabled?: boolean; priority?: number }

interface RoutesConfig {
  // Roteamento desligado = comportamento antigo (só o plano; fila segura no teto).
  enabled: boolean;
  activeId: string;
  overrides: Record<string, RouteOverride>;
  custom: ProviderDef[];
}

const DEFAULT_CONFIG: RoutesConfig = { enabled: false, activeId: PLAN_PROVIDER_ID, overrides: {}, custom: [] };

let config: RoutesConfig = { ...DEFAULT_CONFIG };
let breaker: BreakerState = {};
let listener: ((change: RouteChange) => void) | null = null;
let configRaw = '';
let breakerRaw = '';

export interface RouteChange {
  from: string;
  to: string;
  kind: FailureKind | 'recover';
  reason: string;
  until: number;
}

export function onRouteChange(fn: (change: RouteChange) => void): void {
  listener = fn;
}

// --- disco -----------------------------------------------------------------

function readJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return fallback; }
}

function readRaw(path: string): string {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
}

// tmp+rename: o agente e o backend loopback escrevem no mesmo arquivo; sem isso um
// crash no meio do write deixa JSON truncado e o roteador volta ao default no boot.
// Devolve o texto gravado pra quem chama guardar como "última versão conhecida" —
// é o que impede o sync() de reler (e desfazer) a própria escrita.
function writeJson(path: string, value: unknown): string {
  const text = JSON.stringify(value, null, 2) + '\n';
  try {
    mkdirSync(dirname(path), { recursive: true });
    // Sufixo único: backend e agente escrevem o mesmo arquivo, e um tmp fixo faz
    // os dois writes se intercalarem antes do rename (config perdida).
    const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    writeFileSync(tmp, text, { mode: 0o600 });
    renameSync(tmp, path);
  } catch { /* disco cheio/somente-leitura: o estado em memória segue valendo */ }
  return text;
}

export function loadRouting(): void {
  readConfig();
  readBreaker();
}

function readConfig(): void {
  configRaw = readRaw(CONFIG_FILE);
  const raw = parse<Partial<RoutesConfig>>(configRaw, {});
  config = {
    enabled: !!raw.enabled,
    activeId: typeof raw.activeId === 'string' ? raw.activeId : PLAN_PROVIDER_ID,
    overrides: raw.overrides ?? {},
    // O arquivo é gravável pelo agente (roda com este HOME): reconferir cada
    // provedor próprio na leitura impede que um baseUrl http/interno plantado no
    // disco passe a receber todo prompt sem nunca ter passado pelo gate do WS.
    custom: (Array.isArray(raw.custom) ? raw.custom : []).filter(isSafeCustom),
  };
  if (!providerById(config.activeId)) config.activeId = PLAN_PROVIDER_ID;
}

function readBreaker(): void {
  breakerRaw = readRaw(STATE_FILE);
  breaker = prune(parse<BreakerState>(breakerRaw, {}), Date.now());
}

function parse<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// Backend loopback e agente são PROCESSOS separados que compartilham este arquivo, e
// quem spawna o `claude` é o agente. Sem reler, trocar a rota pela UI só mudava a
// memória de quem atendeu o WS: o spawn seguia no provedor antigo até o restart.
// Compara o texto cru, não o mtime: dois writes no mesmo milissegundo (que é o caso
// quando os dois processos reagem ao mesmo evento) têm mtime idêntico.
function sync(): void {
  if (readRaw(CONFIG_FILE) !== configRaw) readConfig();
  if (readRaw(STATE_FILE) !== breakerRaw) readBreaker();
}

function persistConfig(): void { configRaw = writeJson(CONFIG_FILE, config); }
function persistBreaker(): void { breakerRaw = writeJson(STATE_FILE, breaker); }

// --- credenciais ------------------------------------------------------------

// A chave vem do env gerenciado pelo admin (~/.deck-agent/env.json) ou do próprio
// processo. Para a API da Anthropic vale também o arquivo de credenciais que o
// summary.ts já usa — é onde a key pay-as-you-go da box mora hoje.
export function credentialFor(provider: ProviderDef): string | null {
  if (!provider.authEnv) return null;
  // Provedor próprio só lê do env gerenciado: o fallback pro process.env deixaria
  // um authEnv escolhido pelo usuário alcançar segredo que o minimalEnv() esconde
  // de propósito do `claude` — e mandá-lo como bearer pro endpoint dele.
  const custom = !findProvider(provider.id);
  const managed = managedEnvSync()[provider.authEnv] ?? (custom ? undefined : process.env[provider.authEnv]);
  if (managed) return managed;
  if (provider.authEnv === 'ANTHROPIC_API_KEY') return readCredFile();
  return null;
}

function readCredFile(): string | null {
  try {
    const line = readFileSync(ANTHROPIC_CRED, 'utf8').split('\n').find((l) => l.startsWith('ANTHROPIC_API_KEY='));
    return line ? line.slice('ANTHROPIC_API_KEY='.length).trim() || null : null;
  } catch { return null; }
}

function hasCredential(provider: ProviderDef): boolean {
  return provider.authMode === 'oauth' ? true : !!credentialFor(provider);
}

// --- candidatos -------------------------------------------------------------

export function allProviders(): ProviderDef[] {
  sync();
  return [...CATALOG, ...config.custom];
}

function providerById(id: string): ProviderDef | undefined {
  return allProviders().find((p) => p.id === id);
}

export function candidates(): RouteCandidate[] {
  return allProviders().map((provider) => {
    const o = config.overrides[provider.id] ?? {};
    return {
      provider,
      // O plano é o único ligado por default: os outros só entram depois que o dono
      // colocou a chave e marcou. Roteador não escolhe provedor que ninguém aprovou.
      enabled: o.enabled ?? provider.id === PLAN_PROVIDER_ID,
      priority: o.priority ?? provider.priority,
    };
  });
}

function selectOpts(now: number, exclude?: string[]) {
  return { now, breaker, hasCredential, exclude };
}

// --- rota ativa -------------------------------------------------------------

export function activeProvider(): ProviderDef {
  sync();
  return providerById(config.activeId) ?? CATALOG[0];
}

export function isRoutingEnabled(): boolean { sync(); return config.enabled; }

export function isPlanRoute(): boolean {
  sync();
  return !config.enabled || activeProvider().id === PLAN_PROVIDER_ID;
}

// Existe pra onde ir se o plano acabar agora? É o que autoriza a fila a continuar
// drenando no teto de tokens em vez de dormir até o reset.
export function hasFallbackRoute(now = Date.now()): boolean {
  sync();
  if (!config.enabled) return false;
  return !!selectRoute(candidates(), selectOpts(now, [PLAN_PROVIDER_ID]));
}

// Env do provedor ativo, mesclado no minimalEnv do spawn. Vazio quando o roteador
// está desligado ou a rota é o plano — nesse caso o CLI usa o OAuth como sempre.
export function routeEnv(): Record<string, string> {
  sync();
  if (!config.enabled) return {};
  const p = activeProvider();
  if (p.id === PLAN_PROVIDER_ID) return {};
  const env: Record<string, string> = {};
  if (p.baseUrl) env.ANTHROPIC_BASE_URL = p.baseUrl;
  const key = credentialFor(p);
  if (key) {
    if (p.authMode === 'bearer') {
      env.ANTHROPIC_AUTH_TOKEN = key;
      // Vazio, não ausente: o minimalEnv() mescla o env gerenciado (que guarda a
      // chave pay-as-you-go da Anthropic) ANTES da rota, então sem zerar aqui o CLI
      // sairia mandando o x-api-key da Anthropic pro endpoint do outro provedor —
      // e, no caso do OpenRouter, ainda voltaria a autenticar direto na Anthropic.
      env.ANTHROPIC_API_KEY = '';
    } else env.ANTHROPIC_API_KEY = key;
  }
  if (!isNativeAnthropic(p)) {
    // O CLI usa um modelo "pequeno" próprio pra tarefas internas (título, resumo).
    // Sem redirecionar, ele pediria `claude-haiku` num endpoint que não conhece o
    // nome e o turno inteiro morre num 404 de modelo.
    env.ANTHROPIC_SMALL_FAST_MODEL = p.models.haiku;
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = p.models.haiku;
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = p.models.sonnet;
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = p.models.opus;
  }
  return env;
}

// Modelo efetivo pro `--model` deste turno, traduzido pro id do provedor ativo.
export function routeModel(requested: string | undefined): string | undefined {
  sync();
  if (!config.enabled) return requested;
  return mapModel(activeProvider(), requested);
}

// O `--fallback-model` do CLI só existe no vocabulário da Anthropic.
export function routeIsNativeAnthropic(): boolean {
  sync();
  return !config.enabled || isNativeAnthropic(activeProvider());
}

// --- decisão ----------------------------------------------------------------

function switchTo(to: RouteCandidate, kind: FailureKind | 'recover', reason: string, now: number): RouteChange | null {
  const from = config.activeId;
  if (from === to.provider.id) return null;
  config.activeId = to.provider.id;
  persistConfig();
  const change: RouteChange = { from, to: to.provider.id, kind, reason, until: openUntil(breaker, from, now) };
  listener?.(change);
  return change;
}

export interface OutcomeResult {
  kind: FailureKind;
  changed: RouteChange | null;
}

// Veredito do fim do turno: classifica, abre o breaker do provedor que falhou e
// escolhe o próximo. Chamado uma vez por close de run.
export function reportOutcome(o: TurnOutcome, now = Date.now()): OutcomeResult {
  sync();
  const kind = classifyOutcome(o);
  if (!config.enabled) return { kind, changed: null };

  const activeId = config.activeId;
  if (kind === 'ok') {
    // Turno saudável zera o contador; a recuperação pra uma rota melhor acontece
    // aqui, não num timer — é o momento em que dá pra trocar sem interromper nada.
    const cleaned = recordSuccess(breaker, activeId);
    if (cleaned !== breaker) { breaker = cleaned; persistBreaker(); }
    const back = shouldReturnTo(activeId, candidates(), selectOpts(now));
    return { kind, changed: back ? switchTo(back, 'recover', `${back.provider.label} voltou a ficar disponível`, now) : null };
  }

  const hint = parseResetHint(failureSignal(o), now);
  breaker = recordFailure(breaker, activeId, kind, now, hint);
  persistBreaker();

  const next = selectRoute(candidates(), selectOpts(now));
  if (!next) return { kind, changed: null };
  return { kind, changed: switchTo(next, kind, describe(kind), now) };
}

function describe(kind: FailureKind): string {
  switch (kind) {
    case 'quota_exhausted': return 'cota do provedor esgotada';
    case 'rate_limit': return 'teto de tokens atingido';
    case 'auth': return 'credencial recusada';
    case 'transient': return 'falha de conexão com o provedor';
    default: return 'troca de rota';
  }
}

// O gate de quota do plano bateu (rate/usage-plan) mas o turno nem rodou: troca de
// rota ANTES de disparar, para o drainer não precisar esperar um turno morrer.
export function switchOnPlanExhausted(untilMs: number, now = Date.now()): RouteChange | null {
  sync();
  if (!config.enabled || config.activeId !== PLAN_PROVIDER_ID) return null;
  breaker = recordFailure(breaker, PLAN_PROVIDER_ID, 'rate_limit', now, Math.max(0, untilMs - now));
  persistBreaker();
  const next = selectRoute(candidates(), selectOpts(now));
  if (!next) return null;
  return switchTo(next, 'rate_limit', 'plano sem tokens na janela', now);
}

// --- comandos de admin ------------------------------------------------------

export function setRoutingEnabled(on: boolean): void {
  sync();
  config.enabled = on;
  if (!on) config.activeId = PLAN_PROVIDER_ID;
  persistConfig();
}

export function setOverride(id: string, patch: RouteOverride): { ok: boolean; message: string } {
  sync();
  if (!providerById(id)) return { ok: false, message: 'provedor desconhecido' };
  const cur = config.overrides[id] ?? {};
  const next: RouteOverride = { ...cur };
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
  if (typeof patch.priority === 'number' && Number.isFinite(patch.priority)) {
    next.priority = Math.max(0, Math.min(999, Math.round(patch.priority)));
  }
  config.overrides[id] = next;
  persistConfig();
  return { ok: true, message: 'rota atualizada' };
}

// Troca manual. Zera o breaker do alvo: o dono mandou ir pra lá, então a espera que
// sobrou de uma falha antiga não pode barrar o pedido explícito dele.
export function setActiveRoute(id: string): { ok: boolean; message: string } {
  sync();
  const p = providerById(id);
  if (!p) return { ok: false, message: 'provedor desconhecido' };
  if (!hasCredential(p)) return { ok: false, message: `falta a chave ${p.authEnv} no painel de env` };
  const from = config.activeId;
  breaker = recordSuccess(breaker, id);
  persistBreaker();
  config.activeId = id;
  if (id !== PLAN_PROVIDER_ID) config.enabled = true;
  persistConfig();
  // Só avisa se mudou de verdade: reafirmar a rota atual disparava um toast de
  // "trocou pra X" para uma troca que não houve.
  if (from !== id) listener?.({ from, to: id, kind: 'recover', reason: 'troca manual', until: 0 });
  return { ok: true, message: `rota ativa: ${p.label}` };
}

export function addCustomProvider(input: CustomProviderInput): { ok: boolean; message: string } {
  sync();
  if (config.custom.some((c) => c.id === input.id)) return { ok: false, message: 'id já existe' };
  const built = buildCustomProvider(input);
  if ('error' in built) return { ok: false, message: built.error };
  config.custom.push(built);
  persistConfig();
  return { ok: true, message: `${built.label} adicionado` };
}

export function removeCustomProvider(id: string): { ok: boolean; message: string } {
  sync();
  const before = config.custom.length;
  config.custom = config.custom.filter((c) => c.id !== id);
  if (config.custom.length === before) return { ok: false, message: 'provedor custom não encontrado' };
  delete config.overrides[id];
  if (config.activeId === id) config.activeId = PLAN_PROVIDER_ID;
  persistConfig();
  return { ok: true, message: 'provedor removido' };
}

// --- projeção pro cliente ---------------------------------------------------

export function routesView(now = Date.now()): RoutesSnapshot {
  sync();
  const opts = selectOpts(now);
  const customIds = new Set(config.custom.map((c) => c.id));
  const routes: RouteView[] = candidates()
    .map((c) => ({
      id: c.provider.id,
      label: c.provider.label,
      tier: c.provider.tier,
      priority: c.priority,
      enabled: c.enabled,
      active: c.provider.id === config.activeId,
      configured: hasCredential(c.provider),
      authEnv: c.provider.authEnv,
      cooldownUntil: openUntil(breaker, c.provider.id, now),
      lastKind: breaker[c.provider.id]?.lastKind ?? null,
      custom: customIds.has(c.provider.id),
      docsUrl: c.provider.docsUrl,
      note: c.provider.note,
      models: [...new Set(Object.values(c.provider.models))].join(', '),
      skip: skipReason(c, opts),
    }))
    .sort((a, b) => a.priority - b.priority);
  return { enabled: config.enabled, activeId: config.activeId, routes, hasFallback: hasFallbackRoute(now) };
}

// Só para os testes: reinicia o módulo sem depender de reimport.
export function __resetRouting(next?: Partial<RoutesConfig>): void {
  config = { ...DEFAULT_CONFIG, overrides: {}, custom: [], ...next };
  breaker = {};
  listener = null;
  // Casa com o disco: senão o primeiro sync() logo em seguida releria o arquivo que
  // sobrou do teste anterior e desfaria o reset.
  configRaw = readRaw(CONFIG_FILE);
  breakerRaw = readRaw(STATE_FILE);
}
