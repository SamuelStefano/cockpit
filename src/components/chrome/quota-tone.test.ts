import { describe, it, expect } from 'vitest';
import { quotaBorder } from './quota-tone';

describe('quotaBorder', () => {
  it('fica neutra sem aviso nenhum', () => {
    expect(quotaBorder(false, false)).toContain('border-neutral-800');
  });

  it('vira âmbar no aviso', () => {
    expect(quotaBorder(true, false)).toContain('border-amber-500/50');
  });

  it('vira vermelha quando pausado, mesmo sem warn', () => {
    expect(quotaBorder(false, true)).toContain('border-red-500/60');
    expect(quotaBorder(true, true)).toContain('border-red-500/60');
  });
});
