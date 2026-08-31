import Anthropic from '@anthropic-ai/sdk';
import { classify } from './classifier';
import { managedEnvSync } from '../admin-ops';
import { costOf } from '../db';
import { isNativeModel, nativeTarget, tierToNative, type ResolvedTarget } from './policy';
import { systemPrompt } from './prompt';
import { runOnPlan } from './plan-run';
import type { HarnessContext, HarnessEvent, HarnessModelChoice, HarnessTier, HarnessVia } from '../../shared/protocol';

// Orquestrador de UMA task do harness. Dois motores: PLANO (CLI claude no OAuth, custo 0
// em dólar — plan-run.ts) e API (plain @anthropic-ai/sdk pay-as-you-go). O system prompt
// é 100% nosso nos dois. Emite eventos ao vivo via callback; persistência/broadcast em
// ws/harness.ts. Ver DR-004 (motor) e DR-005 (caminho de plano).

const MAX_TOKENS = 16000;

export interface RunResult {
  tier: HarnessTier;
  tierReason: string;
  model: string;
  via?: HarnessVia;
  status: 'done' | 'error';
  resultText?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

interface RunOpts {
  prompt: string;
  choice: HarnessModelChoice;
  context: HarnessContext;
  onEvent: (e: HarnessEvent) => void;
}

function errMessage(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `${err.status ?? ''} ${err.message}`.trim();
  return err instanceof Error ? err.message : String(err);
}

function fail(onEvent: RunOpts['onEvent'], tier: HarnessTier, tierReason: string, message: string): RunResult {
  onEvent({ kind: 'error', message });
  return { tier, tierReason, model: '', status: 'error', error: message };
}

export async function runTask(opts: RunOpts): Promise<RunResult> {
  const { prompt, choice, context, onEvent } = opts;
  const env = managedEnvSync();

  let tier: HarnessTier = 'medium';
  let tierReason = 'seleção manual';

  // Classifica só no modo auto (é o tier que escolhe o modelo). O classificador
  // precisa da chave nativa.
  if (choice.mode === 'auto') {
    if (!env['ANTHROPIC_API_KEY']) {
      return fail(onEvent, tier, tierReason, 'sem ANTHROPIC_API_KEY no painel de env — o classificador não roda');
    }
    const c = await classify(env['ANTHROPIC_API_KEY'], prompt);
    tier = c.tier;
    tierReason = c.reason;
    onEvent({ kind: 'classified', tier, reason: tierReason });
  }

  if (choice.mode === 'orchestrated') {
    return runOrchestrated(env, choice.executor, choice.advisor, prompt, context, onEvent);
  }

  // Nativo (auto/model): plano (CLI, custo 0) ou API (plain SDK, pay-as-you-go).
  const model = choice.mode === 'auto' ? tierToNative(tier) : choice.model;
  if (choice.mode === 'model' && !isNativeModel(model)) {
    return fail(onEvent, tier, tierReason, `modelo nativo desconhecido: ${model}`);
  }
  onEvent({ kind: 'model-selected', model });
  if (choice.via === 'plan') return runViaPlan(model, prompt, context, tier, tierReason, onEvent);

  const target = nativeTarget(model, env);
  if (!target.apiKey) return fail(onEvent, tier, tierReason, 'sem ANTHROPIC_API_KEY no painel de env — o modo nativo via API não roda');
  return runSingle(target, prompt, context, tier, tierReason, onEvent);
}

// Caminho de PLANO: delega pro CLI (plan-run.ts). Custo em dólar = 0 (cota do plano).
async function runViaPlan(
  model: string, prompt: string, context: HarnessContext,
  tier: HarnessTier, tierReason: string, onEvent: RunOpts['onEvent'],
): Promise<RunResult> {
  const r = await runOnPlan({ model, prompt, context, onEvent });
  if (r.status === 'error') onEvent({ kind: 'error', message: r.error ?? 'erro no plano' });
  else onEvent({ kind: 'done', costUsd: 0 });
  return {
    tier, tierReason, model, via: 'plan',
    status: r.status, resultText: r.resultText, costUsd: r.status === 'done' ? 0 : undefined,
    inputTokens: r.inputTokens, outputTokens: r.outputTokens, error: r.error,
  };
}

function clientFor(target: ResolvedTarget): Anthropic {
  // apiKey explícita (null bloqueia o fallback pro process.env): managedEnv é a fonte,
  // não o ambiente do processo.
  return new Anthropic({ apiKey: target.apiKey ?? null });
}

async function runSingle(
  target: ResolvedTarget, prompt: string, context: HarnessContext,
  tier: HarnessTier, tierReason: string, onEvent: RunOpts['onEvent'],
): Promise<RunResult> {
  try {
    const stream = clientFor(target).messages.stream({
      model: target.model,
      max_tokens: MAX_TOKENS,
      system: systemPrompt(context),
      messages: [{ role: 'user', content: prompt }],
    });
    stream.on('text', (delta) => onEvent({ kind: 'text', text: delta }));
    const final = await stream.finalMessage();
    return finalize(final, target, tier, tierReason, onEvent);
  } catch (err) {
    const message = errMessage(err);
    onEvent({ kind: 'error', message });
    return { tier, tierReason, model: target.model, via: 'api', status: 'error', error: message };
  }
}

// Modo orquestrado: executor barato + advisor forte (advisor tool nativa da Anthropic,
// beta). Nativo-only (usa ANTHROPIC_API_KEY). Se o beta não estiver na conta, o 400 vira
// erro visível — não cai pra nada silencioso.
async function runOrchestrated(
  env: Record<string, string>, executor: string, advisor: string, prompt: string,
  context: HarnessContext, onEvent: RunOpts['onEvent'],
): Promise<RunResult> {
  const tier: HarnessTier = 'complex';
  const tierReason = `orquestrado: ${executor} executa, ${advisor} supervisiona`;
  if (!env['ANTHROPIC_API_KEY']) {
    return fail(onEvent, tier, tierReason, 'sem ANTHROPIC_API_KEY no painel de env — o modo orquestrado não roda');
  }
  if (!isNativeModel(executor) || !isNativeModel(advisor)) {
    return fail(onEvent, tier, tierReason, 'modo orquestrado usa só modelos nativos Anthropic');
  }
  onEvent({ kind: 'model-selected', model: `${executor} + advisor ${advisor}` });
  const client = new Anthropic({ apiKey: env['ANTHROPIC_API_KEY'] });
  try {
    const stream = client.beta.messages.stream({
      model: executor,
      max_tokens: MAX_TOKENS,
      betas: ['advisor-tool-2026-03-01'],
      system: systemPrompt(context),
      tools: [{ type: 'advisor_20260301', name: 'advisor', model: advisor } as never],
      messages: [{ role: 'user', content: prompt }],
    });
    stream.on('text', (delta) => onEvent({ kind: 'text', text: delta }));
    const final = await stream.finalMessage();
    return finalize(final, { model: `${executor}+${advisor}` }, tier, tierReason, onEvent);
  } catch (err) {
    const message = errMessage(err);
    onEvent({ kind: 'error', message });
    return { tier, tierReason, model: `${executor}+${advisor}`, via: 'api', status: 'error', error: message };
  }
}

interface FinalUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}
interface FinalMessage {
  content: Array<{ type: string; text?: string }>;
  usage: FinalUsage;
  stop_reason?: string | null;
}

function finalize(
  final: FinalMessage, target: Pick<ResolvedTarget, 'model'>,
  tier: HarnessTier, tierReason: string, onEvent: RunOpts['onEvent'],
): RunResult {
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const u = final.usage;
  const inTok = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
  const outTok = u.output_tokens ?? 0;
  const costUsd = costOf(target.model, {
    input: u.input_tokens ?? 0,
    output: outTok,
    cacheRead: u.cache_read_input_tokens ?? 0,
    cacheCreation: u.cache_creation_input_tokens ?? 0,
  });
  // Recusa do modelo (stop_reason 'refusal') não é erro do harness: o turno fechou, o
  // modelo declinou. Mostra como resultado (sem contorno automático — DR-001).
  const resultText = final.stop_reason === 'refusal' && !text
    ? '(o modelo recusou esta tarefa por política — sem contorno automático)'
    : text;
  onEvent({ kind: 'done', costUsd });
  return {
    tier, tierReason, model: target.model, via: 'api',
    status: 'done', resultText, costUsd, inputTokens: inTok, outputTokens: outTok,
  };
}
