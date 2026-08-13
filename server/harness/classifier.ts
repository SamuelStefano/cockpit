import Anthropic from '@anthropic-ai/sdk';
import type { HarnessTier } from '../../shared/protocol';

// Classificador SUGERE, nunca decide sozinho (DR-003) — quem chama ainda escolhe o
// modelo de fato. 1 chamada crua e barata, sem loop agentic: não precisa do Agent SDK.
const CLASSIFIER_MODEL = 'claude-haiku-4-5';

// Default seguro em qualquer falha (schema inválido, erro de rede, refusal): nunca
// cai pro tier mais barato às cegas — EARS do requirements.
const SAFE_DEFAULT: { tier: HarnessTier; reason: string } = {
  tier: 'medium',
  reason: 'classificador não retornou uma resposta válida — default seguro',
};

const SCHEMA = {
  type: 'object',
  properties: {
    tier: { type: 'string', enum: ['simple', 'medium', 'complex'] },
    reason: { type: 'string' },
  },
  required: ['tier', 'reason'],
  additionalProperties: false,
};

function isTier(v: unknown): v is HarnessTier {
  return v === 'simple' || v === 'medium' || v === 'complex';
}

export async function classify(apiKey: string, prompt: string): Promise<{ tier: HarnessTier; reason: string }> {
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 256,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: `Classifique a complexidade da tarefa abaixo em "simple", "medium" ou "complex".
simple: pergunta direta, resposta curta, sem raciocínio de múltiplos passos.
medium: precisa de alguma análise ou síntese, mas escopo contido.
complex: múltiplos passos, ambiguidade real, ou risco alto de erro.

Tarefa:
${prompt}`,
      }],
    });
    const block = message.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return SAFE_DEFAULT;
    const parsed = JSON.parse(block.text) as { tier?: unknown; reason?: unknown };
    if (!isTier(parsed.tier) || typeof parsed.reason !== 'string') return SAFE_DEFAULT;
    return { tier: parsed.tier, reason: parsed.reason };
  } catch {
    return SAFE_DEFAULT;
  }
}
