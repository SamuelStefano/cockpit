import { describe, it, expect } from 'vitest';
import { parseAgentFile, labelFromPrompt, sameAgents, STALE_MS, type BgAgent } from './bg-agents';

const NOW = 1_700_000_000_000;
const iso = (ms: number) => new Date(ms).toISOString();

function line(o: Record<string, unknown>): string {
  return JSON.stringify(o);
}

function userPrompt(text: string, ts: number) {
  return line({ type: 'user', timestamp: iso(ts), message: { role: 'user', content: text } });
}
function assistant(opts: { ts: number; stop?: string; text?: string; toolUse?: boolean; usage?: Record<string, number> }) {
  const content: unknown[] = [];
  if (opts.text) content.push({ type: 'text', text: opts.text });
  if (opts.toolUse) content.push({ type: 'tool_use', name: 'Read', input: {} });
  return line({
    type: 'assistant',
    timestamp: iso(opts.ts),
    message: { role: 'assistant', stop_reason: opts.stop ?? null, content, usage: opts.usage },
  });
}

describe('labelFromPrompt', () => {
  it('corta na 1ª frase e limita tamanho', () => {
    expect(labelFromPrompt('Explore the CLI entry points. Find things.', 'aid')).toBe('Explore the CLI entry points.');
  });
  it('cai pro agentId sem texto', () => {
    expect(labelFromPrompt(undefined, 'aid123')).toBe('aid123');
    expect(labelFromPrompt('', 'aid123')).toBe('aid123');
  });
  it('usa a 1ª linha quando não há pontuação', () => {
    expect(labelFromPrompt('faz X\nfaz Y', 'aid')).toBe('faz X');
  });
});

describe('parseAgentFile', () => {
  it('agente rodando: tool_use por último + mtime fresco', () => {
    const content = [
      userPrompt('Explore the CLI. Find entry points.', NOW - 5000),
      assistant({ ts: NOW - 4000, stop: 'tool_use', toolUse: true, usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 5 } }),
    ].join('\n');
    const a = parseAgentFile('aid', content, NOW - 1000, NOW)!;
    expect(a.status).toBe('running');
    expect(a.label).toBe('Explore the CLI.');
    expect(a.tokens).toBe(35);
    expect(a.startedAt).toBe(NOW - 5000);
    expect(a.durationMs).toBeGreaterThanOrEqual(5000);
  });

  it('agente concluído: end_turn + texto final', () => {
    const content = [
      userPrompt('Resuma o repo.', NOW - 10000),
      assistant({ ts: NOW - 9000, stop: 'tool_use', toolUse: true, usage: { input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 0 } }),
      assistant({ ts: NOW - 8000, stop: 'end_turn', text: 'Pronto, aqui vai o resumo.', usage: { input_tokens: 2, output_tokens: 100, cache_creation_input_tokens: 0 } }),
    ].join('\n');
    const a = parseAgentFile('aid', content, NOW - 8000, NOW)!;
    expect(a.status).toBe('done');
    expect(a.tokens).toBe(117);
    expect(a.durationMs).toBe(2000); // endTs(lastTs) - startedAt
  });

  it('done mesmo com mtime velho (já terminou)', () => {
    const content = [
      userPrompt('X.', NOW - 100000),
      assistant({ ts: NOW - 99000, stop: 'end_turn', text: 'ok', usage: { output_tokens: 5 } }),
    ].join('\n');
    const a = parseAgentFile('aid', content, NOW - 90000, NOW)!;
    expect(a.status).toBe('done');
  });

  it('stale sem terminal vira failed (processo morto)', () => {
    const content = [
      userPrompt('X.', NOW - 100000),
      assistant({ ts: NOW - 99000, stop: 'tool_use', toolUse: true }),
    ].join('\n');
    const a = parseAgentFile('aid', content, NOW - (STALE_MS + 5000), NOW)!;
    expect(a.status).toBe('failed');
  });

  it('terminal sem texto algum vira failed', () => {
    const content = [
      userPrompt('X.', NOW - 5000),
      assistant({ ts: NOW - 4000, stop: 'end_turn', usage: { output_tokens: 1 } }),
    ].join('\n');
    const a = parseAgentFile('aid', content, NOW - 4000, NOW)!;
    expect(a.status).toBe('failed');
  });

  it('ignora linha parcial/inválida (arquivo sendo escrito)', () => {
    const content = [
      userPrompt('X. faz', NOW - 5000),
      assistant({ ts: NOW - 4000, stop: 'tool_use', toolUse: true, usage: { output_tokens: 7 } }),
      '{"type":"assistant","message":{"usage":{"output_to', // truncada
    ].join('\n');
    const a = parseAgentFile('aid', content, NOW - 1000, NOW)!;
    expect(a.status).toBe('running');
    expect(a.tokens).toBe(7);
  });

  it('retorna null sem evento válido', () => {
    expect(parseAgentFile('aid', '\n\n{ broken', NOW, NOW)).toBeNull();
    expect(parseAgentFile('aid', '', NOW, NOW)).toBeNull();
  });
});

describe('sameAgents', () => {
  const base: BgAgent = { id: 'a', label: 'l', startedAt: 1, tokens: 10, status: 'running', durationMs: 5 };
  it('igual quando id/status/tokens batem', () => {
    expect(sameAgents([base], [{ ...base, durationMs: 999, label: 'x' }])).toBe(true);
  });
  it('diferente quando tokens mudam (progresso)', () => {
    expect(sameAgents([base], [{ ...base, tokens: 20 }])).toBe(false);
  });
  it('diferente quando status muda (done)', () => {
    expect(sameAgents([base], [{ ...base, status: 'done' }])).toBe(false);
  });
  it('diferente quando tamanho muda', () => {
    expect(sameAgents([base], [])).toBe(false);
  });
});
