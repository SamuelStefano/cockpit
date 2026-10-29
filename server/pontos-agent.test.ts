import { describe, it, expect } from 'vitest';
import { buildAgentTasksPrompt, agentSessionKey, MAX_NOTE_BYTES } from './pontos-agent';

const req = { note: '', epicCapCents: 500_000, monthCapCents: 400_000, pointValue: 75 };

describe('buildAgentTasksPrompt', () => {
  it('carrega as duas regras de teto com os valores vigentes', () => {
    const p = buildAgentTasksPrompt(req);
    expect(p).toContain('um épico rende no máximo R$ 5.000,00');
    expect(p).toContain('teto mensal (hoje R$ 4.000,00)');
    expect(p).toContain('QUEBRE em vários épicos');
  });

  it('reflete um teto diferente sem tocar no texto', () => {
    const p = buildAgentTasksPrompt({ ...req, epicCapCents: 900_000, monthCapCents: 1_200_000 });
    expect(p).toContain('R$ 9.000,00');
    expect(p).toContain('R$ 12.000,00');
  });

  it('proíbe faturar — isso é clique do Samuel', () => {
    expect(buildAgentTasksPrompt(req)).toContain('NÃO gere fatura');
  });

  it('usa a nota do Samuel como escopo', () => {
    expect(buildAgentTasksPrompt({ ...req, note: '  lesson studio, semana passada  ' }))
      .toContain('lesson studio, semana passada');
  });

  it('sem nota, manda o agente descobrir o escopo pelas PRs', () => {
    expect(buildAgentTasksPrompt(req)).toContain('varra as PRs mergeadas');
  });

  it('manda sincronizar o Deck no fim, senão a árvore não mostra nada', () => {
    expect(buildAgentTasksPrompt(req)).toContain('server/dfl-sync.ts');
  });
});

describe('agentSessionKey', () => {
  it('cabe no formato de sessão aceito pelo startRun', () => {
    expect(agentSessionKey(1_789_570_249_351)).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
  });

  it('muda a cada disparo pra não colidir com um turno em andamento', () => {
    expect(agentSessionKey(1)).not.toBe(agentSessionKey(2));
  });
});

describe('MAX_NOTE_BYTES', () => {
  it('limita a nota bem abaixo do teto de prompt do backend', () => {
    expect(MAX_NOTE_BYTES).toBeLessThan(64_000);
  });
});
