import { describe, it, expect } from 'vitest';
import { settingsSections, sectionOf } from './sections';

const ids = (r: Parameters<typeof settingsSections>[0], acc = true) => settingsSections(r, acc).map((s) => s.id);

describe('settingsSections', () => {
  it('shows a student Conta only', () => {
    expect(ids('student')).toEqual(['conta']);
  });
  it('gives an admin everything but Pessoas', () => {
    expect(ids('admin')).toEqual(['conta', 'uso', 'maquina', 'avancado']);
  });
  it('gives root all five when accounts exist', () => {
    expect(ids('root')).toEqual(['conta', 'uso', 'pessoas', 'maquina', 'avancado']);
  });
  it('hides Pessoas from root without accounts (loopback)', () => {
    expect(ids('root', false)).toEqual(['conta', 'uso', 'maquina', 'avancado']);
  });
  it('maps routes to sections and falls back to conta', () => {
    expect(sectionOf('/configuracoes/maquina')).toBe('maquina');
    expect(sectionOf('/configuracoes')).toBe('conta');
  });
});
