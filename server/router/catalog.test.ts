import { describe, it, expect } from 'vitest';
import { CATALOG, PLAN_PROVIDER_ID, buildCustomProvider, findProvider, isNativeAnthropic, isSafeCustom, mapModel, slotOf, validateBaseUrl } from './catalog';

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

  // Loopback disfarçado: o WHATWG normaliza decimal/octal/curto pra 127.0.0.1, mas
  // o mapeado ::ffff: e o IPv6 link-local/ULA escapariam de um regex só de IPv4.
  it('recusa loopback e privado disfarçado de IPv6, CGNAT e ponto final', () => {
    for (const u of [
      'https://[::1]/x', 'https://[::]/x', 'https://[::ffff:127.0.0.1]/x',
      'https://[fd00::1]/x', 'https://[fe80::1]/x',
      'https://100.64.0.1/x', 'https://198.18.0.1/x', 'https://192.0.0.1/x',
      'https://localhost./x', 'https://2130706433/x', 'https://0x7f000001/x', 'https://127.1/x',
    ]) {
      expect(validateBaseUrl(u).ok, u).toBe(false);
    }
  });

  it('segue aceitando IPv6 global', () => {
    expect(validateBaseUrl('https://[2606:4700::1111]/x').ok).toBe(true);
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

  // authEnv vira header Authorization pro endpoint do usuário: um nome livre
  // deixaria escolher QUALQUER variável do processo como valor a exfiltrar.
  it('recusa nome de env fora do formato de env', () => {
    for (const authEnv of ['minha-key', 'PATH;rm', 'a', 'x'.repeat(70)]) {
      expect(buildCustomProvider({ ...base, authEnv }), authEnv).toEqual({ error: 'nome de env inválido' });
    }
    expect('id' in buildCustomProvider({ ...base, authEnv: 'MEU_PROXY_KEY' })).toBe(true);
  });
});

// O routes.json é gravável pelo agente: o que volta do disco passa pelo MESMO
// gate da entrada, senão um baseUrl plantado receberia todo prompt sem nunca ter
// passado pelo WS.
describe('isSafeCustom', () => {
  const built = buildCustomProvider({ id: 'meu-proxy', baseUrl: 'https://proxy.exemplo.com/anthropic', model: 'glm-4.6' });
  if ('error' in built) throw new Error(built.error);
  const good = built;

  it('aceita o que o próprio builder produziu', () => {
    expect(isSafeCustom(good)).toBe(true);
  });

  it('recusa entrada plantada com destino inseguro ou campo faltando', () => {
    expect(isSafeCustom({ ...good, baseUrl: 'http://attacker.test' })).toBe(false);
    expect(isSafeCustom({ ...good, baseUrl: 'https://127.0.0.1' })).toBe(false);
    expect(isSafeCustom({ ...good, authEnv: 'SUPABASE_SERVICE_ROLE_KEY;x' })).toBe(false);
    expect(isSafeCustom({ ...good, id: 'zai-glm' })).toBe(false);
    expect(isSafeCustom({ ...good, models: undefined as never })).toBe(false);
    expect(isSafeCustom(undefined)).toBe(false);
    expect(isSafeCustom(null as never)).toBe(false);
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
