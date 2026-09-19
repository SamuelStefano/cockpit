import { describe, it, expect } from 'vitest';
import { remainingMs, isExpired, fmtCountdown, diagnose } from './pairing';

const NOW = 1_700_000_000_000;
const inMs = (ms: number) => new Date(NOW + ms).toISOString();

describe('remainingMs', () => {
  it('conta o que falta do prazo', () => {
    expect(remainingMs(inMs(90_000), NOW)).toBe(90_000);
  });

  it('nunca fica negativo', () => {
    expect(remainingMs(inMs(-5_000), NOW)).toBe(0);
  });

  it('sem prazo (relay antigo) não inventa contagem', () => {
    expect(remainingMs(null, NOW)).toBeNull();
    expect(remainingMs('lixo', NOW)).toBeNull();
  });
});

describe('isExpired', () => {
  it('só é expirado quando existe prazo E ele passou', () => {
    expect(isExpired(inMs(1), NOW)).toBe(false);
    expect(isExpired(inMs(0), NOW)).toBe(true);
    expect(isExpired(null, NOW)).toBe(false);
  });
});

describe('fmtCountdown', () => {
  it('formata em m:ss', () => {
    expect(fmtCountdown(600_000)).toBe('10:00');
    expect(fmtCountdown(65_000)).toBe('1:05');
    expect(fmtCountdown(0)).toBe('0:00');
  });
});

describe('diagnose', () => {
  const base = { probe: 'unknown' as const, agentOnline: false, expired: false, hasCode: true };

  it('agente online ganha de tudo', () => {
    expect(diagnose({ ...base, probe: 'unreachable', expired: true, agentOnline: true }).tone).toBe('green');
  });

  it('relay inalcançável aponta o navegador, não a VPS', () => {
    const d = diagnose({ ...base, probe: 'unreachable' });
    expect(d.tone).toBe('red');
    expect(d.title).toContain('não alcança o relay');
    expect(d.steps.length).toBeGreaterThan(0);
  });

  it('sessão recusada manda relogar em vez de caçar log na VPS', () => {
    expect(diagnose({ ...base, probe: 'rejected' })).toMatchObject({ tone: 'red', steps: [] });
  });

  it('código expirado explica o silêncio sem mandar caçar fantasma', () => {
    const d = diagnose({ ...base, expired: true });
    expect(d.title).toContain('expirou');
    expect(d.steps).toEqual([]);
  });

  it('relay ok e ninguém pareou entrega os comandos da VPS', () => {
    const d = diagnose({ ...base, probe: 'ok' });
    expect(d.tone).toBe('orange');
    expect(d.steps).toContain('systemctl status deck-agent --no-pager');
    expect(d.steps).toContain('journalctl -u deck-agent -n 50 --no-pager');
  });

  it('sem teste rodado ainda só espera', () => {
    expect(diagnose(base)).toMatchObject({ tone: 'neutral', steps: [] });
  });

  it('sem código ainda diz que está gerando', () => {
    expect(diagnose({ ...base, hasCode: false }).title).toContain('Gerando');
  });
});
