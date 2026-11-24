import { describe, it, expect } from 'vitest';
import { parsePanel } from './parse-panel';

describe('parsePanel', () => {
  it('parses a valid panel', () => {
    const p = parsePanel(JSON.stringify({
      title: 'Hoje',
      columns: [{ label: 'Feito', tone: 'green', items: [{ title: 'PR merged', detail: 'x' }, 'Plain item'] }],
    }));
    expect(p?.title).toBe('Hoje');
    expect(p?.columns[0].items).toHaveLength(2);
    expect(p?.columns[0].items[1].title).toBe('Plain item');
  });

  it('returns null for partial JSON while streaming', () => {
    expect(parsePanel('{"title":"Hoje","columns":[{"label"')).toBeNull();
  });

  it('returns null without columns', () => {
    expect(parsePanel('{"title":"x"}')).toBeNull();
  });

  it('drops non-http links and unknown tones', () => {
    const p = parsePanel(JSON.stringify({
      columns: [{ label: 'A', tone: 'pink', items: [{ title: 't', link: 'javascript:alert(1)' }] }],
    }));
    expect(p?.columns[0].tone).toBe('neutral');
    expect(p?.columns[0].items[0].link).toBeUndefined();
  });
});
