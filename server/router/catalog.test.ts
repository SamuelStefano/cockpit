import { describe, it, expect } from 'vitest';
import { CATALOG, PLAN_PROVIDER_ID, buildCustomProvider, findProvider, isNativeAnthropic, mapModel, slotOf, validateBaseUrl } from './catalog';

describe('CATALOG', () => {
  it('tem ids únicos', () => {
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
  });

  it('todo provedor com baseUrl exige credencial', () => {
    for (const p of CATALOG) {
      if (p.baseUrl) expect(p.authEnv, p.id).toBeTruthy();
    }
  });

  it('toda baseUrl do catálogo passa na própria validação', () => {
    for (const p of CATALOG) {
      if (p.baseUrl) expect(validateBaseUrl(p.baseUrl).ok, p.id).toBe(true);
    }
  });

  it('o plano é a prioridade mais alta e o único sem chave', () => {
    const plan = findProvider(PLAN_PROVIDER_ID)!;
    expect(plan.priority).toBe(0);
    expect(plan.authEnv).toBeNull();
    expect(Math.min(...CATALOG.map((p) => p.priority))).toBe(0);
  });

  it('pay-as-you-go da Anthropic é a última opção', () => {
    expect(Math.max(...CATALOG.map((p) => p.priority))).toBe(findProvider('anthropic-api')!.priority);
  });
});

describe('validateBaseUrl', () => {
  it('aceita https público', () => {
    expect(validateBaseUrl('https://api.z.ai/api/anthropic')).toEqual({ ok: true, url: 'https://api.z.ai/api/anthropic' });
  });

  it('remove a barra final', () => {
    const r = validateBaseUrl('https://api.z.ai/anthropic/');
    expect(r.ok && r.url).toBe('https://api.z.ai/anthropic');
  });

  it('recusa http', () => {
    expect(validateBaseUrl('http://api.z.ai')).toEqual({ ok: false, error: 'só https é aceito' });
  });

  it('recusa credencial embutida na URL', () => {
    expect(validateBaseUrl('https://user:pass@api.z.ai').ok).toBe(false);
  });

  it('recusa loopback e rede privada (prompt não vaza pra dentro da VPS)', () => {
    for (const u of ['https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.10/x', 'https://169.254.169.254/latest', 'https://172.16.0.9/x']) {
      expect(validateBaseUrl(u).ok, u).toBe(false);
    }
  });

  it('recusa lixo', () => {
    expect(validateBaseUrl('nao-e-url').ok).toBe(false);
  });
});

describe('buildCustomProvider', () => {
  const base = { id: 'meu-proxy', baseUrl: 'https://proxy.exemplo.com/anthropic', model: 'glm-4.6' };

  it('monta um provedor válido', () => {
    const p = buildCustomProvider(base);
    expect('error' in p).toBe(false);
    if ('error' in p) return;
    expect(p.models.sonnet).toBe('glm-4.6');
    expect(p.models.haiku).toBe('glm-4.6');
    expect(p.authMode).toBe('bearer');
  });

  it('usa smallModel quando informado', () => {
    const p = buildCustomProvider({ ...base, smallModel: 'glm-4.5-air' });
    expect('error' in p ? null : p.models.haiku).toBe('glm-4.5-air');
  });

  it('recusa id que colide com o catálogo', () => {
    expect(buildCustomProvider({ ...base, id: 'zai-glm' })).toEqual({ error: 'id já existe no catálogo' });
  });

  it('recusa id malformado', () => {
    expect(buildCustomProvider({ ...base, id: 'MEU PROXY' }).hasOwnProperty('error')).toBe(true);
  });

  it('recusa baseUrl insegura', () => {
    expect(buildCustomProvider({ ...base, baseUrl: 'http://x.com' })).toEqual({ error: 'só https é aceito' });
  });

  it('exige modelo', () => {
    expect(buildCustomProvider({ ...base, model: '  ' })).toEqual({ error: 'informe o modelo' });
  });
});

describe('mapModel', () => {
  const zai = findProvider('zai-glm')!;
  const plan = findProvider(PLAN_PROVIDER_ID)!;

  it('provedor nativo passa o modelo direto', () => {
    expect(mapModel(plan, 'claude-opus-4-5')).toBe('claude-opus-4-5');
    expect(mapModel(plan, undefined)).toBeUndefined();
  });

  it('traduz alias e id concreto pro modelo do provedor', () => {
    expect(mapModel(zai, 'opus')).toBe('glm-4.6');
    expect(mapModel(zai, 'claude-haiku-4-5-20251001')).toBe('glm-4.5-air');
    expect(mapModel(zai, 'sonnet')).toBe('glm-4.6');
  });

  it('sem pedido usa o modelo padrão do provedor', () => {
    expect(mapModel(zai, undefined)).toBe('glm-4.6');
  });

  it('id que não é da Anthropic passa direto (usuário digitou o nativo)', () => {
    expect(mapModel(zai, 'glm-4.5-flash')).toBe('glm-4.5-flash');
  });
});

describe('slotOf e isNativeAnthropic', () => {
  it('reconhece o slot pelo nome', () => {
    expect(slotOf('claude-opus-4-5')).toBe('opus');
    expect(slotOf('HAIKU')).toBe('haiku');
    expect(slotOf('claude-sonnet-4-6')).toBe('sonnet');
    expect(slotOf('glm-4.6')).toBeNull();
  });

  it('só quem não tem baseUrl é nativo', () => {
    expect(isNativeAnthropic(findProvider(PLAN_PROVIDER_ID)!)).toBe(true);
    expect(isNativeAnthropic(findProvider('anthropic-api')!)).toBe(true);
    expect(isNativeAnthropic(findProvider('zai-glm')!)).toBe(false);
  });
});
