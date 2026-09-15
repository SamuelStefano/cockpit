import { describe, it, expect, beforeEach, vi } from 'vitest';

const sample = vi.hoisted(() => ({ row: null as { ctxTokens: number; ts: number; model: string | null } | null }));
vi.mock('../db', () => ({ lastUsageOf: () => sample.row }));

import {
  ctxVerdict, acquireCold, releaseCold, resetColdInflight, coldInflightCount,
  noteQuotaTransition, inResetCooldown, resetCooldownState, isBigColdStart, costFor,
  blocksAuto, noteCeilingWarned, clearCeilingWarn, resetCeilingWarns,
  CTX_HARD, CTX_SOFT, CTX_CEILING, CEILING_CONFIRM_MS, COOLDOWN_AFTER_RESET_MS,
} from './ctx-guard';
import type { PlanUsage } from '../../shared/protocol';

const NOW = 1_788_500_000_000;
const H3 = 3 * 60 * 60_000;

function usage(fiveHour: number): PlanUsage {
  return { fiveHour, sevenDay: 0, resetsAt: NOW + 3_600_000, sevenDayResetsAt: NOW + 86_400_000, limits: [] };
}
function setSample(ctxTokens: number, ageMs = H3) {
  sample.row = { ctxTokens, ts: NOW - ageMs, model: 'claude-opus-5' };
}

beforeEach(() => {
  sample.row = null;
  resetColdInflight();
  resetCooldownState();
  resetCeilingWarns();
});

describe('ctxVerdict', () => {
  it('sessão nova passa', () => {
    expect(ctxVerdict({ usage: usage(10), now: NOW }).kind).toBe('ok');
  });

  it('abaixo do soft passa', () => {
    setSample(CTX_SOFT - 1);
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('ok');
  });

  it('entre soft e hard oferece handoff mas deixa passar', () => {
    setSample(CTX_SOFT + 1);
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('soft');
  });

  it('no hard recusa — é o estado das 4 sessões de 04/09', () => {
    for (const ctx of [CTX_HARD, CTX_CEILING - 1]) {
      setSample(ctx);
      expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('hard');
    }
  });

  it('as 3 maiores sessões de 04/09 agora batem no teto, não no hard', () => {
    for (const ctx of [631_342, 681_362, 779_566]) {
      setSample(ctx);
      expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('ceiling');
    }
  });

  it('hard vence quota — o problema é o tamanho, não a janela', () => {
    setSample(CTX_CEILING - 1);
    expect(ctxVerdict({ sessionId: 's', usage: usage(99), now: NOW }).kind).toBe('hard');
  });

  it('recusa por cota quando o envio não cabe no que sobrou', () => {
    setSample(CTX_SOFT - 1);
    expect(ctxVerdict({ sessionId: 's', usage: usage(99.4), now: NOW }).kind).toBe('quota');
  });

  it('leitura de uma janela que já virou não segura a fila', () => {
    setSample(CTX_SOFT - 1);
    const stale = { ...usage(99.4), resetsAt: NOW - 60_000 };
    expect(ctxVerdict({ sessionId: 's', usage: stale, now: NOW }).kind).toBe('ok');
  });

  it('sem leitura de cota não trava', () => {
    setSample(CTX_SOFT - 1);
    expect(ctxVerdict({ sessionId: 's', usage: null, now: NOW }).kind).toBe('ok');
  });
});

describe('teto de contexto (ceiling)', () => {
  it('recusa o primeiro envio acima do teto', () => {
    setSample(CTX_CEILING);
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'k', usage: usage(10), now: NOW }).kind).toBe('ceiling');
  });

  it('reenvio dentro da validade passa — não é porta trancada', () => {
    setSample(500_000);
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'k', usage: usage(10), now: NOW }).kind).toBe('ceiling');
    noteCeilingWarned('k', NOW);
    // Cai no hard, que deixa passar o envio intencional — é o que runs.ts avalia.
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'k', usage: usage(10), now: NOW }).kind).toBe('hard');
  });

  it('confirmação expira', () => {
    setSample(500_000);
    noteCeilingWarned('k', NOW);
    const later = NOW + CEILING_CONFIRM_MS + 1;
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'k', usage: usage(10), now: later }).kind).toBe('ceiling');
  });

  it('confirmação é por sessão, não global', () => {
    setSample(500_000);
    noteCeilingWarned('k', NOW);
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'outra', usage: usage(10), now: NOW }).kind).toBe('ceiling');
  });

  it('consumir a confirmação faz o próximo envio ver o aviso de novo', () => {
    setSample(500_000);
    noteCeilingWarned('k', NOW);
    clearCeilingWarn('k');
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'k', usage: usage(10), now: NOW }).kind).toBe('ceiling');
  });

  it('sem sessionKey nunca confirma — turno da máquina não se autoriza sozinho', () => {
    setSample(500_000);
    noteCeilingWarned('k', NOW);
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('ceiling');
  });

  it('blocksAuto pega hard E ceiling — senão a retomada automática escaparia', () => {
    expect(blocksAuto('hard')).toBe(true);
    expect(blocksAuto('ceiling')).toBe(true);
    expect(blocksAuto('ok')).toBe(false);
    expect(blocksAuto('soft')).toBe(false);
    expect(blocksAuto('quota')).toBe(false);
    expect(blocksAuto('cold-busy')).toBe(false);
  });

  it('abaixo do teto o veredito continua sendo o de antes', () => {
    setSample(CTX_CEILING - 1);
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'k', usage: usage(10), now: NOW }).kind).toBe('hard');
    setSample(CTX_SOFT + 1);
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'k', usage: usage(10), now: NOW }).kind).toBe('soft');
  });
});

describe('semáforo de cold-start', () => {
  it('segura o segundo cold-start grande', () => {
    setSample(120_000);
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('ok');
    acquireCold('outra');
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('cold-busy');
  });

  it('não segura envio de cache QUENTE, mesmo em sessão grande', () => {
    setSample(120_000, 30_000);
    acquireCold('outra');
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('ok');
  });

  it('não segura cold-start pequeno', () => {
    setSample(50_000);
    acquireCold('outra');
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('ok');
  });

  it('release libera e é idempotente (onClose sem acquire não vaza)', () => {
    acquireCold('a');
    releaseCold('a');
    releaseCold('a');
    expect(coldInflightCount()).toBe(0);
  });

  it('acquire do mesmo key duas vezes conta uma (o replacing do startRun)', () => {
    acquireCold('a');
    acquireCold('a');
    expect(coldInflightCount()).toBe(1);
  });
});

describe('isBigColdStart', () => {
  it('exige frio E grande', () => {
    setSample(700_000, 30_000);
    expect(isBigColdStart(costFor('s', NOW))).toBe(false);
    setSample(700_000, H3);
    expect(isBigColdStart(costFor('s', NOW))).toBe(true);
  });
});

describe('cooldown pós-reset', () => {
  it('só arma na transição segurado -> livre', () => {
    noteQuotaTransition(0, NOW);
    expect(inResetCooldown(NOW)).toBe(false);
    noteQuotaTransition(NOW + 1000, NOW);
    noteQuotaTransition(0, NOW);
    expect(inResetCooldown(NOW)).toBe(true);
  });

  it('expira no teto (o auto-resume de 04/09 caiu 1min após o reset)', () => {
    noteQuotaTransition(1, NOW);
    noteQuotaTransition(0, NOW);
    expect(inResetCooldown(NOW + 60_000)).toBe(true);
    expect(inResetCooldown(NOW + COOLDOWN_AFTER_RESET_MS + 1)).toBe(false);
  });

  it('hold contínuo não re-arma o cooldown a cada chamada', () => {
    noteQuotaTransition(1, NOW);
    noteQuotaTransition(0, NOW);
    noteQuotaTransition(0, NOW + COOLDOWN_AFTER_RESET_MS + 1);
    expect(inResetCooldown(NOW + COOLDOWN_AFTER_RESET_MS + 2)).toBe(false);
  });
});

// Interromper o próprio turno (triagem 'priority') passa pelo startRun de novo. Se
// o semáforo contasse a própria sessão, o usuário levava 'cold-busy' tentando
// redirecionar o trabalho dele — nos primeiros segundos, antes da primeira amostra
// de uso, a sessão ainda parece fria.
describe('semáforo não bloqueia a própria sessão', () => {
  it('deixa a sessão que já segura o semáforo subir turno novo', () => {
    setSample(700_000);
    acquireCold('minha');
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'minha', usage: usage(10), now: NOW }).kind).toBe('hard');
    setSample(120_000);
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'minha', usage: usage(10), now: NOW }).kind).toBe('ok');
  });

  it('mas continua bloqueando uma sessão diferente', () => {
    setSample(120_000);
    acquireCold('outra');
    expect(ctxVerdict({ sessionId: 's', sessionKey: 'minha', usage: usage(10), now: NOW }).kind).toBe('cold-busy');
  });

  it('sem sessionKey o comportamento não muda', () => {
    setSample(120_000);
    acquireCold('outra');
    expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('cold-busy');
  });
});
