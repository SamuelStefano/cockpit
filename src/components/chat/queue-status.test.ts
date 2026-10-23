import { describe, it, expect } from 'vitest';
import { queueStatus, queueStatusIcon, queueStatusLabel } from './queue-status';

describe('queueStatus', () => {
  it('fila normal sem trava alguma', () => {
    expect(queueStatus({})).toBe('open');
  });

  it('teto de tokens segura a fila', () => {
    expect(queueStatus({ quotaHeld: true })).toBe('quota');
  });

  it('pausa manual tem precedência sobre o teto de tokens', () => {
    expect(queueStatus({ paused: true, quotaHeld: true })).toBe('paused');
  });

  it('cooldown pós-reset: soltando quando releaseAt é futuro', () => {
    expect(queueStatus({ releaseAt: 5000, now: 1000 })).toBe('releasing');
    expect(queueStatus({ releaseAt: 1000, now: 1000 })).toBe('open');
    expect(queueStatus({ releaseAt: 0, now: 1000 })).toBe('open');
  });

  it('soltando perde para teto de tokens, pausa e item segurado', () => {
    expect(queueStatus({ releaseAt: 5000, now: 1000, quotaHeld: true })).toBe('quota');
    expect(queueStatus({ releaseAt: 5000, now: 1000, paused: true })).toBe('paused');
    expect(queueStatus({ releaseAt: 5000, now: 1000, held: true })).toBe('held');
  });

  it('espera do cancelamento vem antes de tudo', () => {
    expect(queueStatus({ held: true, paused: true, quotaHeld: true })).toBe('held');
  });
});

describe('queueStatusLabel', () => {
  it('diz que a fila espera o reset, com a hora quando ela é conhecida', () => {
    expect(queueStatusLabel('quota', 2, '18:30')).toBe('fila aguardando tokens (2) — envia sozinha às 18:30');
    expect(queueStatusLabel('quota', 1, null)).toBe('fila aguardando tokens (1) — envia sozinha quando resetar');
  });

  it('mostra a contagem do cooldown, no mínimo 1s', () => {
    expect(queueStatusLabel('releasing', 3, null, 91_000, 1000)).toBe('fila soltando (3) — 1º envio em 90s, depois 1 a cada 30s');
    expect(queueStatusLabel('releasing', 1, null, 1100, 1000)).toContain('em 1s');
  });

  it('mantém as contagens do estado normal', () => {
    expect(queueStatusLabel('open', 1)).toBe('na fila');
    expect(queueStatusLabel('open', 3)).toBe('3 na fila');
  });

  it('preserva os avisos de pausa e de espera', () => {
    expect(queueStatusLabel('paused', 2)).toContain('fila pausada (2)');
    expect(queueStatusLabel('held', 2)).toContain('fila parada (2)');
  });
});

describe('queueStatusIcon', () => {
  it('relógio na espera por tokens, pause na pausa manual', () => {
    expect(queueStatusIcon('quota')).toBe('clock');
    expect(queueStatusIcon('open')).toBe('clock');
    expect(queueStatusIcon('releasing')).toBe('clock');
    expect(queueStatusIcon('paused')).toBe('pause');
    expect(queueStatusIcon('held')).toBe('square');
  });
});
