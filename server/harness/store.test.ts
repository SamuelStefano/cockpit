import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HarnessTaskView } from '../../shared/protocol';

const dir = mkdtempSync(join(tmpdir(), 'deck-harness-'));
process.env.COCKPIT_DB = join(dir, 'test.db');

const S = await import('./store');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function running(id: string): HarnessTaskView {
  return { id, ts: 1000, prompt: `tarefa ${id}`, context: null, mode: 'auto', tier: 'medium', tierReason: '', model: '', status: 'running' };
}

describe('harness store', () => {
  it('insere running, fecha com resultado e lista mais recente primeiro', () => {
    S.insertTask(running('a'));
    S.insertTask({ ...running('b'), ts: 2000 });
    S.finishTask('a', {
      tier: 'complex', tierReason: 'multi-passo', model: 'claude-opus-4-8', status: 'done',
      resultText: 'pronto', costUsd: 0.02, inputTokens: 100, outputTokens: 50, durationMs: 4200,
    });

    const list = S.listTasks();
    expect(list.map((t) => t.id)).toEqual(['b', 'a']); // ordena por ts desc
    const a = list.find((t) => t.id === 'a')!;
    expect(a).toMatchObject({ status: 'done', model: 'claude-opus-4-8', tier: 'complex', resultText: 'pronto', costUsd: 0.02 });
  });

  it('registra erro', () => {
    S.insertTask(running('d'));
    S.finishTask('d', { tier: 'medium', tierReason: '', model: 'claude-sonnet-5', status: 'error', error: 'timeout' });
    const d = S.listTasks().find((t) => t.id === 'd')!;
    expect(d.status).toBe('error');
    expect(d.error).toBe('timeout');
  });
});
