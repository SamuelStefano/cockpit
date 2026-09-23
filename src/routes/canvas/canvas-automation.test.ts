import { describe, expect, it } from 'vitest';
import { isAutomationSession } from './canvas-automation';

describe('isAutomationSession', () => {
  it('flags the known cron reset-ping text (isCronPing)', () => {
    expect(isAutomationSession({ title: '.', subtitle: '' })).toBe(true);
    expect(isAutomationSession({ title: '', subtitle: '. - nao responder' })).toBe(true);
  });

  it('flags explicit memory-cleanup / housekeeping / hibernate phrasing', () => {
    expect(isAutomationSession({ title: 'limpeza de memória', subtitle: '' })).toBe(true);
    expect(isAutomationSession({ title: 'memory-gc', subtitle: '' })).toBe(true);
    expect(isAutomationSession({ title: 'rotina', subtitle: 'manutenção automática da box' })).toBe(true);
    expect(isAutomationSession({ title: 'hibernate idle sessions', subtitle: '' })).toBe(true);
  });

  it('does not flag a normal work session, even one launched by a cron', () => {
    expect(isAutomationSession({ title: 'Maratona Fable', subtitle: 'Coloquei Opus aqui pois o deck precisa de um upgrade' })).toBe(false);
    expect(isAutomationSession({ title: 'fix: bug no kanban', subtitle: 'corrige status preso' })).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isAutomationSession({ title: 'MEMÓRIA GC', subtitle: '' })).toBe(true);
  });
});
