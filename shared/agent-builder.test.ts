import { describe, expect, it } from 'vitest';
import {
  EMPTY_BUILDER_DRAFT, applyBuilderReply, builderPrompt, builderSystemPrompt, draftIsEmpty, draftsEqual, mergeDraft, parseBuilderReply,
  sanitizeName, skillBlurb, toggleSkill,
} from './agent-builder';

const known = new Set(['planilhas', 'pesquisa']);
const block = (json: string) => '```agente\n' + json + '\n```';

describe('parseBuilderReply', () => {
  it('splits the reply from the agent block', () => {
    const r = parseBuilderReply(`Qual o tom?\n${block('{"name":"ana","label":"ajudante"}')}`);
    expect(r.message).toBe('Qual o tom?');
    expect(r.patch).toEqual({ name: 'ana', label: 'ajudante' });
  });

  it('returns no patch when there is no block', () => {
    expect(parseBuilderReply('Oi! O que ele faz?')).toEqual({ message: 'Oi! O que ele faz?', patch: null });
  });

  it('takes the last valid block and still hides a broken one', () => {
    const r = parseBuilderReply(`${block('{"name":"a"}')}\ntexto\n${block('{nope')}`);
    expect(r.patch).toEqual({ name: 'a' });
    expect(r.message).toBe('texto');
  });

  it('ignores non-object payloads and unknown or mistyped fields', () => {
    expect(parseBuilderReply(block('[1,2]')).patch).toBeNull();
    expect(parseBuilderReply(block('{"name":5,"x":1}')).patch).toBeNull();
    expect(parseBuilderReply(block('{"skills":["a",3,"b"],"x":1}')).patch).toEqual({ skills: ['a', 'b'] });
  });
});

describe('mergeDraft', () => {
  it('keeps the draft when the patch is null', () => {
    const d = { ...EMPTY_BUILDER_DRAFT, name: 'x' };
    expect(mergeDraft(d, null, known)).toBe(d);
  });

  it('only touches the fields present', () => {
    const d = { name: 'ana', label: 'a', instructions: 'faça', skills: ['planilhas'] };
    expect(mergeDraft(d, { label: 'nova' }, known)).toEqual({ ...d, label: 'nova' });
  });

  it('sanitizes the name and keeps the old one when nothing survives', () => {
    const d = { ...EMPTY_BUILDER_DRAFT, name: 'ana' };
    expect(mergeDraft(d, { name: ' Robô do Zé! ' }, known).name).toBe('Robô-do-Zé');
    expect(mergeDraft(d, { name: '!!!' }, known).name).toBe('ana');
  });

  it('drops unknown and duplicate skills but replaces the list', () => {
    const d = { ...EMPTY_BUILDER_DRAFT, skills: ['pesquisa'] };
    expect(mergeDraft(d, { skills: ['planilhas', 'planilhas', 'hacker'] }, known).skills).toEqual(['planilhas']);
    expect(mergeDraft(d, { skills: [] }, known).skills).toEqual([]);
  });

  it('caps label and instructions to the team limits', () => {
    const out = mergeDraft(EMPTY_BUILDER_DRAFT, { label: 'x'.repeat(200), instructions: 'é'.repeat(9000) }, known);
    expect(out.label).toHaveLength(60);
    expect(new TextEncoder().encode(out.instructions).length).toBeLessThanOrEqual(8 * 1024);
    expect(out.instructions.length).toBeGreaterThan(0);
  });
});

describe('prompts', () => {
  const skills = [{ id: 'planilhas', name: 'Planilhas', description: 'Cria planilhas. Também importa CSV.', mtime: 0 }];

  it('lists skills by id with a short blurb and embeds the current draft', () => {
    const p = builderSystemPrompt(skills, { ...EMPTY_BUILDER_DRAFT, name: 'ana' });
    expect(p).toContain('- planilhas: Cria planilhas.');
    expect(p).not.toContain('Também importa');
    expect(p).toContain('"name":"ana"');
  });

  it('keeps only the latest turns and caps each one', () => {
    const turns = Array.from({ length: 40 }, (_, i) => ({ role: 'user' as const, text: `m${i}` }));
    const p = builderPrompt(turns);
    expect(p).not.toContain('m0\n');
    expect(p).toContain('m39');
    expect(builderPrompt([{ role: 'assistant', text: 'z'.repeat(9000) }]).length).toBeLessThan(4200);
  });
});

describe('helpers', () => {
  it('skillBlurb falls back to the name and truncates long sentences', () => {
    expect(skillBlurb({ id: 'a', name: 'Nome', description: '  ' })).toBe('Nome');
    expect(skillBlurb({ id: 'a', name: 'N', description: 'y'.repeat(300) }).length).toBeLessThanOrEqual(90);
  });

  it('sanitizeName strips leading symbols', () => {
    expect(sanitizeName('--a b')).toBe('a-b');
  });

  it('toggleSkill, draftIsEmpty and draftsEqual', () => {
    expect(toggleSkill(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSkill(['a', 'b'], 'a')).toEqual(['b']);
    expect(draftIsEmpty(EMPTY_BUILDER_DRAFT)).toBe(true);
    expect(draftIsEmpty({ ...EMPTY_BUILDER_DRAFT, skills: ['a'] })).toBe(false);
    expect(draftsEqual(EMPTY_BUILDER_DRAFT, { ...EMPTY_BUILDER_DRAFT })).toBe(true);
    expect(draftsEqual(EMPTY_BUILDER_DRAFT, { ...EMPTY_BUILDER_DRAFT, label: 'x' })).toBe(false);
  });
});

describe('applyBuilderReply', () => {
  it('merges the block and reports whether the preview changed', () => {
    const r = applyBuilderReply(EMPTY_BUILDER_DRAFT, `Pronto!\n${block('{"name":"ana","skills":["planilhas","x"]}')}`, known);
    expect(r.message).toBe('Pronto!');
    expect(r.draft).toMatchObject({ name: 'ana', skills: ['planilhas'] });
    expect(r.changed).toBe(true);
  });

  it('keeps the draft and gives a fallback line when the reply is only a block', () => {
    const r = applyBuilderReply(EMPTY_BUILDER_DRAFT, block('{"name":"a"}'), known);
    expect(r.message).toBe('Atualizei a prévia.');
    const again = applyBuilderReply(r.draft, 'Mais alguma coisa?', known);
    expect(again.changed).toBe(false);
    expect(again.draft).toBe(r.draft);
  });
});
