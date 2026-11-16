import { describe, it, expect } from 'vitest';
import { capacityBlocksSend, capacityLabel, capacityTip } from './capacity';

const c = (live: number, cap: number, configCap = 12) => ({ live, cap, configCap, availMb: 1000 });

describe('capacity helpers', () => {
  it('prints live/cap', () => {
    expect(capacityLabel(c(2, 3))).toBe('2/3');
  });

  it('says memory is the limit when the cap sits below the configured ceiling', () => {
    expect(capacityTip('VPS', c(2, 3))).toBe('VPS: 2 de 3 vagas. Memória limita a 3.');
    expect(capacityTip('PC', c(1, 12))).toBe('PC: 1 de 12 vagas. Limite configurado: 12.');
    expect(capacityTip('VPS', c(0, 1))).toBe('VPS: 0 de 1 vaga. Memória limita a 1.');
  });

  it('holds a send only when the box is full and this chat is idle', () => {
    expect(capacityBlocksSend(null, false)).toBe(false);
    expect(capacityBlocksSend(c(2, 3), false)).toBe(false);
    expect(capacityBlocksSend(c(3, 3), false)).toBe(true);
    expect(capacityBlocksSend(c(3, 3), true)).toBe(false);
    expect(capacityBlocksSend(c(5, 3), false)).toBe(true);
  });
});
