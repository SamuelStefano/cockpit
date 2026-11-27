import { describe, expect, it } from 'vitest';
import { draftFrom, type BotDraft } from './useBotForm';
import { exportPayloads, importDraft } from './useBotTemplate';

const skills = [{ id: 'planilhas', name: 'Planilhas', description: '', mtime: 0 }];
const draft = (over: Partial<BotDraft> = {}): BotDraft => ({ ...draftFrom(null, 0), name: 'ana', instructions: 'Ajude com planilhas.', skills: ['planilhas'], ...over });

describe('template export/import', () => {
  it('exports a link and a file that import back to the same agent', () => {
    const out = exportPayloads(draft({ label: 'ajudante' }), 'https://deck.test');
    if (!out.ok) throw new Error(out.error);
    for (const text of [out.link, out.json]) {
      const r = importDraft(text, skills);
      expect(r).toMatchObject({ ok: true, draft: { name: 'ana', label: 'ajudante', skills: ['planilhas'], missingSkills: [] } });
    }
  });

  it('never exports the boss, model or profile', () => {
    const out = exportPayloads(draft({ parentId: 'b1', model: 'agent:grok', profile: 'full', mode: 'auto' }), 'https://deck.test');
    if (!out.ok) throw new Error(out.error);
    expect(out.json).not.toMatch(/parentId|model|profile|mode/);
  });

  it('refuses to export instructions that hold a secret', () => {
    expect(exportPayloads(draft({ instructions: 'use sk-abcdefghijklmnop1234' }), 'x')).toMatchObject({ ok: false });
  });

  it('reports skills missing on this box and rejects garbage', () => {
    const out = exportPayloads(draft({ skills: ['planilhas', 'outra'] }), 'https://deck.test');
    if (!out.ok) throw new Error(out.error);
    expect(importDraft(out.json, skills)).toMatchObject({ ok: true, draft: { skills: ['planilhas'], missingSkills: ['outra'] } });
    expect(importDraft('banana', skills)).toMatchObject({ ok: false });
  });
});
