import { describe, it, expect } from 'vitest';
import { scanMetaText, type MetaScan } from './index';

const user = (text: string) => JSON.stringify({ type: 'user', message: { role: 'user', content: text } });
const asst = JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [] } });
const aiTitle = (t: string) => JSON.stringify({ type: 'ai-title', aiTitle: t });

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

  it('skips malformed JSON lines without counting them', () => {
    const text = ['not json', user('ok'), '{bad'].join('\n') + '\n';
    const s = scanMetaText(text);
    expect(s.count).toBe(1);
    expect(s.firstUser).toBe('ok');
  });
});
