import { describe, it, expect } from 'vitest';
import type { DflEpicNode, DflTaskNode } from '../../../shared/protocol';
import { epicCap, EPIC_CAP_CENTS } from './epic-cap';

const task = (status: DflTaskNode['status'], points: number, amountCents = 0): DflTaskNode => ({
  id: `t${Math.random()}`, name: 't', points, status, rawStatus: 'done', amountCents,
});

const epic = (deliveries: { id: string; tasks: DflTaskNode[] }[]): DflEpicNode => ({
  id: 'e', name: 'E', status: 'in_progress', points: 0, amountCents: 0,
  deliveries: deliveries.map((d) => ({ ...d, name: d.id, status: 'pending', pricePerPoint: 75, points: 0, amountCents: 0 })),
});

describe('epicCap', () => {
  it('épico abaixo do teto não segura nada', () => {
    const cap = epicCap(epic([{ id: 'd1', tasks: [task('open', 20)] }]), { pointValue: 75 });
    expect(cap.openCents).toBe(150_000);
    expect(cap.heldCents).toBe(0);
    expect(cap.billableCents).toBe(150_000);
    expect(cap.state).toBe('ok');
  });

  it('segura só o excedente, não o épico inteiro', () => {
    // 80 pts × R$75 = R$6.000 → R$5.000 faturável, R$1.000 em espera.
    const cap = epicCap(epic([{ id: 'd1', tasks: [task('open', 80)] }]), { pointValue: 75 });
    expect(cap.valueCents).toBe(600_000);
    expect(cap.billableCents).toBe(EPIC_CAP_CENTS);
    expect(cap.heldCents).toBe(100_000);
    expect(cap.state).toBe('held');
  });

  it('o que já foi pago consome o teto do épico', () => {
    const cap = epicCap(epic([{ id: 'd1', tasks: [task('paid', 60, 450_000), task('open', 20)] }]), { pointValue: 75 });
    expect(cap.paidCents).toBe(450_000);
    expect(cap.openCents).toBe(150_000);
    expect(cap.billableCents).toBe(50_000);
    expect(cap.heldCents).toBe(100_000);
  });

  it('épico quitado acima do teto não vira espera retroativa', () => {
    const cap = epicCap(epic([{ id: 'd1', tasks: [task('paid', 100, 750_000)] }]), { pointValue: 75 });
    expect(cap.valueCents).toBe(750_000);
    expect(cap.heldCents).toBe(0);
    expect(cap.state).toBe('ok');
  });

  it('a-fazer não entra na conta do teto', () => {
    const cap = epicCap(epic([{ id: 'd1', tasks: [task('todo', 200)] }]), { pointValue: 75 });
    expect(cap.valueCents).toBe(0);
    expect(cap.state).toBe('ok');
  });

  it('delivery fora do recebível é ignorada', () => {
    const e = epic([{ id: 'd1', tasks: [task('open', 80)] }, { id: 'd2', tasks: [task('open', 40)] }]);
    const cap = epicCap(e, { pointValue: 75, excluded: new Set(['d2']) });
    expect(cap.openCents).toBe(600_000);
    expect(cap.heldCents).toBe(100_000);
  });

  it('valor do ponto e teto são parametrizáveis', () => {
    const cap = epicCap(epic([{ id: 'd1', tasks: [task('open', 10)] }]), { pointValue: 100, capCents: 80_000 });
    expect(cap.openCents).toBe(100_000);
    expect(cap.billableCents).toBe(80_000);
    expect(cap.heldCents).toBe(20_000);
  });
});
