import { describe, it, expect } from 'vitest';
import { scanMetaText, type MetaScan } from './index';

const user = (text: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: text } });
const asst = JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [] } });
const aiTitle = (t: string) => JSON.stringify({ type: 'ai-title', aiTitle: t });
const asstText = (text: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const ask = (id: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion', id }] } });
const answer = (id: string) => JSON.stringify({ type: 'user', toolUseResult: {}, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'Café' }] } });

describe('scanMetaText', () => {
  it('counts user/assistant records and grabs the first user text', () => {
    const text = [user('hello'), asst, user('second')].join('\n') + '\n';
    const s = scanMetaText(text);
    expect(s.count).toBe(3);
    expect(s.firstUser).toBe('hello');
  });

  it('takes the last ai-title and ignores non-message records', () => {
    const text = [aiTitle('old'), user('hi'), aiTitle('new'), JSON.stringify({ type: 'summary' })].join('\n') + '\n';
    const s = scanMetaText(text);
    expect(s.title).toBe('new');
    expect(s.count).toBe(1);
  });

  it('joins array text parts for the first user message', () => {
    const rec = JSON.stringify({ type: 'user', message: { role: 'user', content: [
      { type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' },
    ] } });
    expect(scanMetaText(rec + '\n').firstUser).toBe('a b');
  });

  it('tracks consumed bytes only up to the last newline', () => {
    const text = user('x') + '\n';
    const s = scanMetaText(text);
    expect(s.consumed).toBe(Buffer.byteLength(text, 'utf8'));
  });

  it('leaves an incomplete trailing line unconsumed', () => {
    const complete = user('x') + '\n';
    const s = scanMetaText(complete + '{"partial":');
    expect(s.count).toBe(1);
    expect(s.consumed).toBe(Buffer.byteLength(complete, 'utf8'));
  });

  it('continues a prior scan over the new tail (incremental)', () => {
    const head = user('first') + '\n' + asst + '\n';
    const first = scanMetaText(head);
    const tail = user('third') + '\n';
    const merged = scanMetaText(tail, first);
    expect(merged.count).toBe(3);
    expect(merged.firstUser).toBe('first');
    expect(merged.consumed).toBe(Buffer.byteLength(head + tail, 'utf8'));
  });

  it('full scan equals incremental scan split at the line boundary', () => {
    const a = user('um') + '\n' + asst + '\n';
    const b = user('dois') + '\n' + asst + '\n';
    const full = scanMetaText(a + b);
    const inc = scanMetaText(b, scanMetaText(a));
    expect(inc).toEqual<MetaScan>(full);
  });

  it('counts multibyte UTF-8 bytes, not characters', () => {
    const text = user('héllo → 日本') + '\n';
    expect(scanMetaText(text).consumed).toBe(Buffer.byteLength(text, 'utf8'));
  });

  it('keeps the newest message timestamp', () => {
    const at = (ts: string) => JSON.stringify({ type: 'assistant', timestamp: ts, message: { role: 'assistant', content: [] } });
    const s = scanMetaText([at('2026-08-13T10:00:00.000Z'), at('2026-08-13T12:00:00.000Z')].join('\n') + '\n');
    expect(s.lastTs).toBe(Date.parse('2026-08-13T12:00:00.000Z'));
  });

  it('ignores unparseable timestamps and records without one', () => {
    const bad = JSON.stringify({ type: 'assistant', timestamp: 'nope', message: { role: 'assistant', content: [] } });
    expect(scanMetaText([user('sem ts'), bad].join('\n') + '\n').lastTs).toBeUndefined();
  });

  it('flags a pending AskUserQuestion', () => {
    expect(scanMetaText([user('vai'), ask('toolu_1')].join('\n') + '\n').pendingAsk).toBe('toolu_1');
  });

  it('does not flag a turn that merely ended with a question mark', () => {
    const text = [user('e aí?'), asstText('Achei dois caminhos. Quer que eu siga pelo primeiro?')].join('\n') + '\n';
    expect(scanMetaText(text).pendingAsk).toBeUndefined();
  });

  it('clears the waiting state when the user answers with a new prompt', () => {
    const s = scanMetaText([user('vai'), ask('toolu_1'), user('pode seguir')].join('\n') + '\n');
    expect(s.pendingAsk).toBeUndefined();
  });

  it('clears the waiting state when the card is answered as a tool_result', () => {
    const s = scanMetaText([user('vai'), ask('toolu_1'), answer('toolu_1')].join('\n') + '\n');
    expect(s.pendingAsk).toBeUndefined();
  });

  it('keeps waiting when the tool_result belongs to another tool_use', () => {
    const s = scanMetaText([user('vai'), ask('toolu_1'), answer('toolu_outro')].join('\n') + '\n');
    expect(s.pendingAsk).toBe('toolu_1');
  });

  it('does not treat a tool output or a meta line as the user answering', () => {
    const toolResult = JSON.stringify({ type: 'user', toolUseResult: { ok: true }, message: { role: 'user', content: [{ type: 'text', text: 'saída' }] } });
    const meta = JSON.stringify({ type: 'user', isMeta: true, message: { role: 'user', content: 'system-reminder' } });
    expect(scanMetaText([ask('toolu_1'), toolResult, meta].join('\n') + '\n').pendingAsk).toBe('toolu_1');
  });

  it('ignores subagent lines — a sidechain question is not for the user', () => {
    const sub = JSON.stringify({ type: 'assistant', isSidechain: true, message: { role: 'assistant', content: [{ type: 'tool_use', name: 'AskUserQuestion', id: 'toolu_sub' }] } });
    expect(scanMetaText([user('vai'), sub].join('\n') + '\n').pendingAsk).toBeUndefined();
  });

  it('carries the waiting state across an incremental scan', () => {
    const head = user('vai') + '\n';
    const tail = ask('toolu_1') + '\n';
    expect(scanMetaText(tail, scanMetaText(head)).pendingAsk).toBe('toolu_1');
  });

  it('skips malformed JSON lines without counting them', () => {
    const text = ['not json', user('ok'), '{bad'].join('\n') + '\n';
    const s = scanMetaText(text);
    expect(s.count).toBe(1);
    expect(s.firstUser).toBe('ok');
  });
});
