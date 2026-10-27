import { describe, expect, it } from 'vitest';
import { exportTemplate, parseTemplate, templateToDraft, templateToJson, templateToLink, validateTemplate } from './agent-template';

const bot = {
  name: 'ana', label: 'ajudante', instructions: 'Ajude com planilhas.',
  mascot: { shape: 'blob' as const, color: '#AABBCC' }, skills: ['planilhas'],
};

function exported() {
  const r = exportTemplate(bot);
  if (!r.ok) throw new Error(r.error);
  return r.template;
}

describe('exportTemplate', () => {
  it('carries only identity fields, never ids or permissions', () => {
    const full = { ...bot, id: 'b123', parentId: 'b9', sessionId: 's', profile: 'full', mode: 'auto', model: 'agent:grok' };
    const t = exportTemplate(full);
    expect(t.ok && Object.keys(t.template).sort()).toEqual(['instructions', 'kind', 'label', 'mascot', 'name', 'skills', 'v']);
    expect(t.ok && t.template.mascot.color).toBe('#aabbcc');
  });

  it.each([
    ['sk-abcdefghijklmnop1234'],
    ['use ghp_abcdefghijklmnopqrstuvwxyz123456'],
    ['senha: hunter2hunter2'],
    ['-----BEGIN PRIVATE KEY-----'],
    ['Authorization: Bearer abcdefghijklmnopqrstuvwxyz'],
  ])('refuses instructions with a secret (%s)', (instructions) => {
    const r = exportTemplate({ ...bot, instructions });
    expect(r.ok).toBe(false);
  });
});

describe('parseTemplate', () => {
  it('round-trips through JSON and through the share link', () => {
    const t = exported();
    expect(parseTemplate(templateToJson(t))).toEqual({ ok: true, template: t });
    const link = templateToLink({ ...t, instructions: 'Fale em português: ação é tudo.' }, 'https://deck.example');
    expect(link.startsWith('https://deck.example/equipe#agente=')).toBe(true);
    const back = parseTemplate(link);
    expect(back.ok && back.template.instructions).toBe('Fale em português: ação é tudo.');
    const code = link.split('#agente=')[1];
    expect(parseTemplate(code).ok).toBe(true);
  });

  it('rejects garbage, empty and oversized input', () => {
    expect(parseTemplate('').ok).toBe(false);
    expect(parseTemplate('{not json').ok).toBe(false);
    expect(parseTemplate('!!!').ok).toBe(false);
    expect(parseTemplate(JSON.stringify({ ...exported(), instructions: 'x'.repeat(30_000) })).ok).toBe(false);
  });
});

describe('validateTemplate', () => {
  const base = () => ({ ...exported() });
  const err = (o: unknown) => { const r = validateTemplate(o); return r.ok ? null : r.error; };

  it('accepts a valid template', () => {
    expect(validateTemplate(base()).ok).toBe(true);
  });

  it('rejects wrong kind, version and non-objects', () => {
    expect(err(null)).toMatch(/não é um agente/);
    expect(err([])).toMatch(/não é um agente/);
    expect(err({ ...base(), kind: 'other' })).toMatch(/do Deck/);
    expect(err({ ...base(), v: 2 })).toMatch(/versão/);
  });

  it('rejects bad name, mascot, skills and instructions', () => {
    expect(err({ ...base(), name: '!!!' })).toMatch(/nome/);
    expect(err({ ...base(), mascot: { shape: 'cube', color: '#000000' } })).toMatch(/forma/);
    expect(err({ ...base(), mascot: { shape: 'blob', color: 'red' } })).toMatch(/cor/);
    expect(err({ ...base(), skills: ['../etc/passwd'] })).toMatch(/habilidades/);
    expect(err({ ...base(), skills: 'planilhas' })).toMatch(/habilidades/);
    expect(err({ ...base(), instructions: 5 })).toMatch(/instruções/);
    expect(err({ ...base(), instructions: 'é'.repeat(5000) })).toMatch(/8KB/);
    expect(err({ ...base(), label: 'x'.repeat(61) })).toMatch(/cargo/);
  });

  it('refuses a template that smuggles a secret', () => {
    expect(err({ ...base(), instructions: 'use sk-abcdefghijklmnop1234' })).toMatch(/chave/);
  });

  it('drops fields it does not know, including permissions', () => {
    const r = validateTemplate({ ...base(), profile: 'full', mode: 'bypass', parentId: 'x' });
    expect(r.ok && Object.keys(r.template)).not.toContain('profile');
    expect(r.ok && Object.keys(r.template)).not.toContain('mode');
  });

  it('dedupes skills', () => {
    const r = validateTemplate({ ...base(), skills: ['a', 'a', 'b'] });
    expect(r.ok && r.template.skills).toEqual(['a', 'b']);
  });
});

describe('templateToDraft', () => {
  it('keeps installed skills and reports the ones this box lacks', () => {
    const t = { ...exported(), skills: ['planilhas', 'faltando'] };
    const d = templateToDraft(t, new Set(['planilhas']));
    expect(d.skills).toEqual(['planilhas']);
    expect(d.missingSkills).toEqual(['faltando']);
    expect(d.shape).toBe('blob');
  });
});
