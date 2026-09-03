import { describe, it, expect } from 'vitest';
import { classify, nextAlert, initialAlertState, type ProbeResult } from './probe';

const res = (p: Partial<ProbeResult>): ProbeResult => ({ status: 200, body: { ok: true }, latencyMs: 10, ...p });

describe('classify', () => {
  it('sem resposta é down', () => {
    expect(classify(res({ status: null, body: null, latencyMs: null, error: 'timeout' })))
      .toEqual({ health: 'down', latencyMs: null, detail: 'timeout' });
  });

  it('http fora de 2xx é down', () => {
    expect(classify(res({ status: 502 })).health).toBe('down');
  });

  it('200 sem ok:true é down', () => {
    expect(classify(res({ body: {} })).health).toBe('down');
  });

  it('relay ok sem detalhe é up, mas não afirma nada sobre agentes', () => {
    const s = classify(res({ body: { ok: true, uptimeSec: 5 } }));
    expect(s.health).toBe('up');
    expect(s.detail).toContain('sem detalhe');
  });

  it('conta existente sem agente conectado é degraded, não down', () => {
    const s = classify(res({ body: { ok: true, accounts: 2, agents: 0 } }));
    expect(s.health).toBe('degraded');
    expect(s.detail).toContain('nenhum agente');
  });

  it('agente conectado é up', () => {
    expect(classify(res({ body: { ok: true, accounts: 2, agents: 2 } })).health).toBe('up');
  });

  it('zero conta e zero agente não é degraded (não há o que estar fora do ar)', () => {
    expect(classify(res({ body: { ok: true, accounts: 0, agents: 0 } })).health).toBe('up');
  });
});

describe('nextAlert', () => {
  const down = { health: 'down' as const, detail: 'timeout' };
  const up = { health: 'up' as const, detail: 'ok' };

  it('não alerta antes de confirmar', () => {
    const a = nextAlert(initialAlertState(), down, 3);
    expect(a.alert).toBeNull();
    const b = nextAlert(a.state, down, 3);
    expect(b.alert).toBeNull();
  });

  it('alerta na enésima leitura igual', () => {
    let st = initialAlertState();
    let alert = null;
    for (let i = 0; i < 3; i++) ({ state: st, alert } = nextAlert(st, down, 3));
    expect(alert).toEqual({ from: 'up', to: 'down', detail: 'timeout' });
  });

  it('não repete o alerta enquanto o estado não muda', () => {
    let st = initialAlertState();
    for (let i = 0; i < 3; i++) ({ state: st } = nextAlert(st, down, 3));
    const again = nextAlert(st, down, 3);
    expect(again.alert).toBeNull();
  });

  it('uma leitura boa isolada não cancela a queda em curso', () => {
    let st = initialAlertState();
    ({ state: st } = nextAlert(st, down, 3));
    ({ state: st } = nextAlert(st, down, 3));
    ({ state: st } = nextAlert(st, up, 3));       // soluço: zera a sequência
    const third = nextAlert(st, down, 3);
    expect(third.alert).toBeNull();
    expect(third.state.confirmed).toBe('up');
  });

  it('alerta a recuperação depois de confirmada', () => {
    let st = initialAlertState();
    let alert = null;
    for (let i = 0; i < 3; i++) ({ state: st } = nextAlert(st, down, 3));
    for (let i = 0; i < 3; i++) ({ state: st, alert } = nextAlert(st, up, 3));
    expect(alert).toEqual({ from: 'down', to: 'up', detail: 'ok' });
  });
});
