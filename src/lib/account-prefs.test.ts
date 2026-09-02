// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ACCOUNT_PREF_KEYS, MODE_KEY, MODEL_KEY, EFFORT_KEY, CUSTOM_MODELS_KEY,
  readLocalAccountPrefs, mergeAccountPrefs, applyAccountPrefs, clearAccountPrefs,
  subscribeAccountPrefs, type AccountPrefs,
} from './account-prefs';
import { loadPref, savePref, setPref, hasPref } from './persist';
import { SHOW_TOOLS_KEY, GROUP_NOTES_KEY, SHOW_SESSION_DESC_KEY } from './prefs';

describe('ACCOUNT_PREF_KEYS', () => {
  it('leva as prefs de conta e nenhuma de aparelho', () => {
    expect([...ACCOUNT_PREF_KEYS]).toEqual([
      'mode', 'model', 'effort', 'chat.showTools', 'chat.groupNotes', 'sessions.showDesc', 'customModels',
    ]);
    for (const local of ['drafts', 'auth.token', 'ws.url', 'activeId', 'seen', 'pendingAtts:abc']) {
      expect(ACCOUNT_PREF_KEYS as readonly string[]).not.toContain(local);
    }
  });
});

describe('mergeAccountPrefs', () => {
  it('remoto presente vence por chave (escolha do outro device propaga)', () => {
    const merged = mergeAccountPrefs({ [MODE_KEY]: 'plan' }, { [MODE_KEY]: 'auto' });
    expect(merged).toEqual({ value: { mode: 'plan' }, seed: false });
  });

  it('valor falsy do remoto ainda vence — desligar um toggle propaga', () => {
    const merged = mergeAccountPrefs({ [SHOW_TOOLS_KEY]: false }, { [SHOW_TOOLS_KEY]: true });
    expect(merged.value[SHOW_TOOLS_KEY]).toBe(false);
    expect(merged.seed).toBe(false);
  });

  it('coluna nula: mantém o local inteiro e marca seed', () => {
    const local = { [MODE_KEY]: 'plan', [EFFORT_KEY]: 'high' };
    expect(mergeAccountPrefs(null, local)).toEqual({ value: local, seed: true });
  });

  it('coluna nula sem nada local: nada a semear', () => {
    expect(mergeAccountPrefs(null, {})).toEqual({ value: {}, seed: false });
  });

  it('mistura: a chave que só o local tem sobe, a que o remoto tem desce', () => {
    const merged = mergeAccountPrefs({ [MODEL_KEY]: 'opus' }, { [MODEL_KEY]: 'sonnet', [EFFORT_KEY]: 'high' });
    expect(merged.value).toEqual({ model: 'opus', effort: 'high' });
    expect(merged.seed).toBe(true);
  });

  it('remoto nulo por chave conta como ausente', () => {
    const merged = mergeAccountPrefs({ [MODE_KEY]: null } as AccountPrefs, { [MODE_KEY]: 'plan' });
    expect(merged).toEqual({ value: { mode: 'plan' }, seed: true });
  });

  it('ignora chave desconhecida vinda do jsonb', () => {
    const merged = mergeAccountPrefs({ 'auth.token': 'segredo' } as AccountPrefs, {});
    expect(merged.value).toEqual({});
  });
});

describe('prefs locais', () => {
  beforeEach(() => localStorage.clear());

  it('lê só o que foi de fato escolhido neste aparelho', () => {
    expect(readLocalAccountPrefs()).toEqual({});
    savePref(MODE_KEY, 'plan');
    savePref(CUSTOM_MODELS_KEY, ['claude-x']);
    expect(readLocalAccountPrefs()).toEqual({ mode: 'plan', customModels: ['claude-x'] });
  });

  it('aplica o resultado do merge no cache local', () => {
    applyAccountPrefs({ [MODE_KEY]: 'plan', [GROUP_NOTES_KEY]: false });
    expect(loadPref(MODE_KEY, 'auto')).toBe('plan');
    expect(loadPref(GROUP_NOTES_KEY, true)).toBe(false);
    expect(hasPref(EFFORT_KEY)).toBe(false);
  });

  it('troca de conta: repinta no default e apaga a chave', () => {
    savePref(MODE_KEY, 'plan');
    savePref(SHOW_SESSION_DESC_KEY, false);
    const seen: unknown[] = [];
    const off = subscribeAccountPrefs(() => seen.push(loadPref(MODE_KEY, 'auto')));
    clearAccountPrefs();
    off();
    expect(readLocalAccountPrefs()).toEqual({});
    expect(hasPref(MODE_KEY)).toBe(false);
    // Repintou antes de apagar: a UI viu o default, não a escolha da conta anterior.
    expect(seen[0]).toBe('auto');
  });

  it('depois da limpeza, o device não semeia nada da conta antiga', () => {
    savePref(MODEL_KEY, 'opus');
    clearAccountPrefs();
    expect(mergeAccountPrefs(null, readLocalAccountPrefs())).toEqual({ value: {}, seed: false });
  });

  it('avisa os assinantes quando uma pref de conta muda', () => {
    let hits = 0;
    const off = subscribeAccountPrefs(() => { hits += 1; });
    setPref(EFFORT_KEY, 'high');
    setPref('drafts', 'nada a ver');
    off();
    setPref(EFFORT_KEY, 'low');
    expect(hits).toBe(1);
  });
});
