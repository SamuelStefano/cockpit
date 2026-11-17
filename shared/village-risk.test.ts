import { describe, expect, it } from 'vitest';
import { isUnsafeTask, matchRiskTerm } from './village-risk';

const task = (title: string, description = '') => ({ title, description, links: [] });

describe('village risk net', () => {
  it('catches accents and case', () => {
    expect(matchRiskTerm('Produção')).toBe('producao');
    expect(matchRiskTerm('MIGRAÇÃO do banco')).toBe('migracao');
    expect(matchRiskTerm('Permissão nova')).toBe('permissao');
  });
  it('catches compatibility forms (NFKC)', () => {
    expect(matchRiskTerm('ｐｒｏｄ')).toBe('prod');
  });
  it('catches multi-word and symbol terms', () => {
    expect(matchRiskTerm('git reset --hard')).toBe('reset --hard');
    expect(matchRiskTerm('bind em 0.0.0.0')).toBe('0.0.0.0');
    expect(matchRiskTerm('arquivo .env')).toBe('.env');
  });
  it('does not match inside other words', () => {
    expect(matchRiskTerm('product roadmap')).toBeNull();
    expect(matchRiskTerm('refactor the card layout')).toBeNull();
  });
  it('scans description and links', () => {
    expect(isUnsafeTask(task('x', 'rodar na produção'))).toBe(true);
    expect(isUnsafeTask({ ...task('x'), links: [{ url: 'https://a.com/stripe' }] })).toBe(true);
  });
  it('explicit unsafe wins, safe text stays safe', () => {
    expect(isUnsafeTask({ ...task('ajustar cor'), unsafe: true })).toBe(true);
    expect(isUnsafeTask(task('ajustar cor do botão'))).toBe(false);
  });
});
