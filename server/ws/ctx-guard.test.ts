import { describe, it, expect, beforeEach, vi } from 'vitest';

const sample = vi.hoisted(() => ({ row: null as { ctxTokens: number; ts: number; model: string | null } | null }));
vi.mock('../db', () => ({ lastUsageOf: () => sample.row }));

import {
  ctxVerdict, acquireCold, releaseCold, resetColdInflight, coldInflightCount,
  noteQuotaTransition, inResetCooldown, resetCooldownState, isBigColdStart, costFor,
  CTX_HARD, CTX_SOFT, COOLDOWN_AFTER_RESET_MS,
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
    for (const ctx of [631_342, 681_362, 779_566, CTX_HARD]) {
      setSample(ctx);
      expect(ctxVerdict({ sessionId: 's', usage: usage(10), now: NOW }).kind).toBe('hard');
    }
  });

  it('hard vence quota — o problema é o tamanho, não a janela', () => {
    setSample(779_566);
    expect(ctxVerdict({ sessionId: 's', usage: usage(99), now: NOW }).kind).toBe('hard');
  });

  it('recusa por cota quando o envio não cabe no que sobrou', () => {
    setSample(CTX_SOFT - 1);
    expect(ctxVerdict({ sessionId: 's', usage: usage(99.4), now: NOW }).kind).toBe('quota');
  });

  it('sem leitura de cota não trava', () => {
    setSample(CTX_SOFT - 1);
    expect(ctxVerdict({ sessionId: 's', usage: null, now: NOW }).kind).toBe('ok');
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
