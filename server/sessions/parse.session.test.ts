import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { parseSession, parseFullSession } from './parse';
import { CONFIG } from '../config';

// Integração end-to-end do reload: escreve um JSONL real com a estrutura EXATA que
// o `claude -p` grava ao auto-resolver um AskUserQuestion (pergunta → tool_result
// falso → continuação) e prova que parseSession entrega a pergunta como ÚLTIMA
// mensagem (respondível), não enterrada pela continuação. Reproduz o bug "apareceu
// 1s e sumiu": o re-fetch trazia a continuação por cima da pergunta.
const SID = 'feedfeed-0000-4000-8000-000000000abc';
const FILE = join(CONFIG.projectsDir, `${SID}.jsonl`);

function write(lines: object[]) {
  writeFileSync(FILE, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}
afterEach(() => { try { rmSync(FILE); } catch { /* já removido */ } });

const QUESTION = {
  type: 'assistant', uuid: 'a1', parentUuid: 'u1', sessionId: SID, timestamp: '2026-06-17T10:00:01.000Z',
  message: { role: 'assistant', model: 'claude-opus-4-8', content: [
    { type: 'text', text: 'Preciso de uma escolha:' },
    { type: 'tool_use', id: 'toolu_q', name: 'AskUserQuestion', input: { questions: [{ question: 'Qual abordagem?', header: 'Abordagem', multiSelect: false, options: [{ label: 'A', description: 'aa' }, { label: 'B' }] }] } },
  ] },
};
const USER = { type: 'user', uuid: 'u1', parentUuid: null, sessionId: SID, timestamp: '2026-06-17T10:00:00.000Z', message: { role: 'user', content: 'faça X' } };
const AUTO_CANCEL = { type: 'user', uuid: 'tr1', parentUuid: 'a1', sessionId: SID, timestamp: '2026-06-17T10:00:02.000Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_q', content: 'No response requested.' }] } };
const CONTINUATION = { type: 'assistant', uuid: 'a2', parentUuid: 'tr1', sessionId: SID, timestamp: '2026-06-17T10:00:03.000Z', message: { role: 'assistant', model: 'claude-opus-4-8', content: [{ type: 'text', text: 'Continuei sozinho com resposta falsa.' }] } };

function lastIsQuestion(messages: { role: string; blocks?: { type: string; tool?: { name?: string; questions?: unknown[] } }[] }[]): boolean {
  const last = messages[messages.length - 1];
  return !!last && last.role === 'assistant' && !!last.blocks?.some((b) => b.type === 'tool' && b.tool?.name === 'AskUserQuestion' && (b.tool?.questions?.length ?? 0) > 0);
}

describe('parseSession — AskUserQuestion auto-resolvida (reload)', () => {
  it('a pergunta fica como ÚLTIMA mensagem quando não houve resposta real', async () => {
    write([USER, QUESTION, AUTO_CANCEL, CONTINUATION, { type: 'last-prompt', leafUuid: 'a2' }]);
    const r = await parseSession(SID);
    expect(r).toBeTruthy();
    expect(lastIsQuestion(r!.messages)).toBe(true);
  });

  it('NÃO trunca quando o usuário respondeu (prompt real após a pergunta)', async () => {
    const answer = { type: 'user', uuid: 'u2', parentUuid: 'a2', sessionId: SID, timestamp: '2026-06-17T10:01:00.000Z', message: { role: 'user', content: 'Abordagem: A' } };
    const after = { type: 'assistant', uuid: 'a3', parentUuid: 'u2', sessionId: SID, timestamp: '2026-06-17T10:01:01.000Z', message: { role: 'assistant', model: 'claude-opus-4-8', content: [{ type: 'text', text: 'feito' }] } };
    write([USER, QUESTION, AUTO_CANCEL, CONTINUATION, answer, after, { type: 'last-prompt', leafUuid: 'a3' }]);
    const r = await parseSession(SID);
    expect(lastIsQuestion(r!.messages)).toBe(false);
    expect(r!.messages[r!.messages.length - 1].role).toBe('assistant');
  });

  it('parseFullSession ("ver tudo") mostra a continuação — read-only, sem truncar', async () => {
    write([USER, QUESTION, AUTO_CANCEL, CONTINUATION, { type: 'last-prompt', leafUuid: 'a2' }]);
    const full = await parseFullSession(SID);
    expect(lastIsQuestion(full!.messages)).toBe(false);
  });
});
