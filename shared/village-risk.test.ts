import { describe, it, expect } from 'vitest';
import { isUnsafeTask, matchesUnsafeNet, normalizeText } from './village-risk';

const t = (title: string, description = '') => ({ title, description });

describe('village risk net', () => {
  it.each(['Produção', 'MIGRAÇÃO', 'Permissão', 'Irreversível', 'PAGAMENTO', 'ｐｒｏｄ', 'rodar sql', 'nova fatura', 'editar .env', 'ssh na box', 'Reembolso'])('flags %s', (w) => {
    expect(matchesUnsafeNet(t(w))).toBe(true);
    expect(matchesUnsafeNet(t('x', `please ${w} now`))).toBe(true);
  });

  it('flags a risky link', () => {
    expect(matchesUnsafeNet({ ...t('x'), links: [{ url: 'https://supabase.com/dashboard' }] })).toBe(true);
  });

  it('lets plain chores through', () => {
    expect(matchesUnsafeNet(t('Rename a helper', 'tidy the docs'))).toBe(false);
  });

  it('the flag alone makes a task unsafe; the net only adds', () => {
    expect(isUnsafeTask({ ...t('Rename a helper'), unsafe: true })).toBe(true);
    expect(isUnsafeTask(t('Rename a helper'))).toBe(false);
  });

  it('normalizes case and accents', () => {
    expect(normalizeText('PRODUÇÃO')).toBe('producao');
  });
});
