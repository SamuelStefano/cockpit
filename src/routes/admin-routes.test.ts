import { describe, it, expect } from 'vitest';
import { sortRoutes, routeStatus, statusTone, cooldownLabel, validateCustom } from './admin-routes';
import type { RouteView } from '../../shared/protocol';

const NOW = 1_700_000_000_000;

function route(over: Partial<RouteView> & { id: string }): RouteView {
  return {
    label: over.id, tier: 'free', priority: 10, enabled: true, active: false, configured: true,
    authEnv: 'X_KEY', cooldownUntil: 0, lastKind: null, custom: false, docsUrl: 'https://x', models: 'a/b/c',
    skip: null, ...over,
  };
}

describe('sortRoutes', () => {
  it('ordena por prioridade e desempata por label', () => {
    const r = sortRoutes([
      route({ id: 'c', label: 'C', priority: 10 }),
      route({ id: 'a', label: 'A', priority: 0 }),
      route({ id: 'b', label: 'B', priority: 10 }),
    ]);
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('não muta o array recebido', () => {
    const input = [route({ id: 'z', priority: 9 }), route({ id: 'a', priority: 1 })];
    sortRoutes(input);
    expect(input[0].id).toBe('z');
  });
});

describe('routeStatus', () => {
  it('ativa ganha de tudo (inclusive de cooldown herdado)', () => {
    expect(routeStatus(route({ id: 'x', active: true, skip: 'cooling' }))).toBe('ativa');
  });

  it('traduz cada motivo de skip do servidor', () => {
    expect(routeStatus(route({ id: 'x', skip: 'disabled' }))).toBe('desligada');
    expect(routeStatus(route({ id: 'x', skip: 'no-credential' }))).toBe('sem credencial');
    expect(routeStatus(route({ id: 'x', skip: 'cooling' }))).toBe('cooldown');
    expect(routeStatus(route({ id: 'x', skip: null }))).toBe('pronta');
  });

  // O servidor pula por 'excluded' só em consultas internas (ex.: "existe fallback
  // fora o plano?"); no snapshot da UI ele nunca chega — e é elegível de fato.
  it('motivo desconhecido não inventa status', () => {
    expect(routeStatus(route({ id: 'x', skip: 'excluded' }))).toBe('pronta');
  });
});

describe('statusTone', () => {
  it('mapeia cada status', () => {
    expect(statusTone('ativa')).toBe('green');
    expect(statusTone('pronta')).toBe('neutral');
    expect(statusTone('cooldown')).toBe('yellow');
    expect(statusTone('desligada')).toBe('red');
    expect(statusTone('sem credencial')).toBe('red');
  });
});

describe('cooldownLabel', () => {
  it('nulo quando já venceu', () => {
    expect(cooldownLabel(NOW, NOW)).toBeNull();
    expect(cooldownLabel(NOW - 5000, NOW)).toBeNull();
  });

  it('arredonda pra cima em minutos abaixo de 1h', () => {
    expect(cooldownLabel(NOW + 30_000, NOW)).toBe('1min');
    expect(cooldownLabel(NOW + 59 * 60_000, NOW)).toBe('59min');
  });

  it('vira horas a partir de 60min', () => {
    expect(cooldownLabel(NOW + 60 * 60_000, NOW)).toBe('1h');
    expect(cooldownLabel(NOW + 90 * 60_000, NOW)).toBe('1h30');
    expect(cooldownLabel(NOW + 125 * 60_000, NOW)).toBe('2h05');
  });
});

describe('validateCustom', () => {
  const ok = { id: 'meu-provedor', baseUrl: 'https://api.x.com/anthropic', model: 'm-1', authEnv: 'MEU_KEY' };

  it('aceita um provedor bem formado', () => {
    expect(validateCustom(ok)).toBeNull();
    expect(validateCustom({ ...ok, authEnv: '' })).toBeNull();
  });

  it('recusa id fora do formato', () => {
    for (const id of ['A', 'x', '-abc', '9abc', 'com espaço', 'ç', '']) {
      expect(validateCustom({ ...ok, id }), id).toBe('id: começa com letra; minúsculas, números e hífen (2-32)');
    }
  });

  it('exige modelo', () => {
    expect(validateCustom({ ...ok, model: '  ' })).toBe('informe o modelo');
  });

  // Espelha o gate do servidor: http em claro mandaria o prompt inteiro sem TLS.
  it('recusa URL não-https, malformada ou com credencial embutida', () => {
    expect(validateCustom({ ...ok, baseUrl: 'nao-e-url' })).toBe('URL inválida');
    expect(validateCustom({ ...ok, baseUrl: 'http://api.x.com' })).toBe('só https é aceito');
    expect(validateCustom({ ...ok, baseUrl: 'https://user:pw@api.x.com' })).toBe('não coloque credencial na URL');
  });

  it('recusa nome de env fora do padrão', () => {
    expect(validateCustom({ ...ok, authEnv: 'minha-key' })).toBe('env: MAIÚSCULAS_COM_UNDERLINE');
    expect(validateCustom({ ...ok, authEnv: '9KEY' })).toBe('env: MAIÚSCULAS_COM_UNDERLINE');
  });
});
