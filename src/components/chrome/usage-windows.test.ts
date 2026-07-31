import { describe, it, expect } from 'vitest';
import { windowLabel, usageTone } from './usage-windows';

describe('windowLabel', () => {
  it('nomeia cada janela que a conta pode expor', () => {
    expect(windowLabel('five_hour')).toBe('Sessão · 5h');
    expect(windowLabel('seven_day')).toBe('Semana');
    expect(windowLabel('seven_day_opus')).toBe('Semana · Opus');
    expect(windowLabel('seven_day_sonnet')).toBe('Semana · Sonnet');
    expect(windowLabel('overage')).toBe('Excedente pago');
  });
});

describe('usageTone', () => {
  it('vira âmbar em 70% e vermelho em 90%', () => {
    expect(usageTone(0)).toBe('green');
    expect(usageTone(69)).toBe('green');
    expect(usageTone(70)).toBe('yellow');
    expect(usageTone(89)).toBe('yellow');
    expect(usageTone(90)).toBe('red');
    expect(usageTone(100)).toBe('red');
  });
});
