import { describe, it, expect } from 'vitest';
import { activityPhrase, activityIcons, toolKind } from './activity-summary';
import type { ToolCall } from '../../data/types';

const t = (name: string, status: ToolCall['status'] = 'done'): ToolCall =>
  ({ id: Math.random().toString(), name, label: name, command: '', status, output: [] });

describe('activityPhrase', () => {
  it('summarizes a finished turn in plain Portuguese', () => {
    const tools = [t('Read'), t('Read'), t('Read'), t('mcp__dfl-campaigns__list_posts')];
    expect(activityPhrase(tools)).toBe('Leu 3 arquivos e consultou o dfl-campaigns');
  });

  it('uses the singular', () => {
    expect(activityPhrase([t('Bash')])).toBe('Rodou 1 comando');
  });

  it('switches to the live phrase while something runs', () => {
    const tools = [t('Bash'), t('Bash'), t('Write', 'running')];
    expect(activityPhrase(tools)).toBe('Rodando · 2 comandos, 1 arquivo alterado');
  });

  it('caps the phrase at three parts', () => {
    const tools = [t('Read'), t('Grep'), t('WebFetch'), t('Bash'), t('Edit')];
    expect(activityPhrase(tools)).toBe('Leu 1 arquivo, buscou no código, pesquisou na web e mais 2');
  });
});

describe('activityIcons', () => {
  it('returns at most three distinct icons', () => {
    expect(activityIcons([t('Read'), t('Read'), t('Bash'), t('Edit'), t('Grep')])).toEqual(['file', 'search', 'terminal']);
  });
  it('classifies unknown tools as other', () => {
    expect(toolKind({ name: 'Mystery' })).toBe('other');
  });
});
