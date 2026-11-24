// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { Skills } from './Skills';
import type { SkillMeta } from '../../shared/protocol';

afterEach(cleanup);

window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;

const skills: SkillMeta[] = [
  { id: 'resumir-pdf', name: 'Resumir PDF', description: 'Extrai texto de PDF', mtime: 0, usedBy: [] },
  { id: 'agendar', name: 'Agendar post', description: 'Fila de posts', mtime: 0, risk: ['write', 'net'], source: 'dfl-campaigns', usedBy: [] },
];

function setup(over: Partial<Parameters<typeof Skills>[0]> = {}) {
  const props: Parameters<typeof Skills>[0] = {
    connected: true, skills, loaded: true, openSkill: null, bots: [], skillId: '',
    registry: null, registryLoading: false, registryError: null, installing: new Set(),
    onNavigate: vi.fn(), onSkillList: vi.fn(), onSkillOpen: vi.fn(), onSkillClose: vi.fn(), onRegistryGet: vi.fn(), onRegistryInstall: vi.fn(),
    ...over,
  };
  render(<Skills {...props} />);
  return props;
}

describe('Skills catalog', () => {
  it('lists installed skills with risk badges and source filter chips', () => {
    setup();
    expect(screen.getByText('Resumir PDF')).toBeTruthy();
    expect(screen.getAllByText('escreve')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'dfl-campaigns' }));
    expect(screen.queryByText('Resumir PDF')).toBeNull();
    expect(screen.getByText('Agendar post')).toBeTruthy();
  });

  it('keeps the local skills and shows a calm locked state when the registry fails on a missing credentials file', () => {
    setup({ registryError: "ENOENT: no such file or directory, open '/home/deck/.dfl-mcp/credentials.json'" });
    expect(screen.getByText('Resumir PDF')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Descobrir/ }));
    expect(screen.getByText('Catálogo bloqueado por enquanto')).toBeTruthy();
    expect(screen.queryByText('Registro indisponível')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Instaladas/ }));
    expect(screen.getByText('Resumir PDF')).toBeTruthy();
  });

  it('opens the skill page and requests the SKILL.md', () => {
    const p = setup({ skillId: 'resumir-pdf' });
    expect(p.onSkillOpen).toHaveBeenCalledWith('resumir-pdf');
  });

  it('renders the SKILL.md of the open skill without frontmatter', () => {
    setup({ skillId: 'resumir-pdf', openSkill: { id: 'resumir-pdf', name: 'Resumir PDF', body: '---\nname: x\n---\n\nPasso a passo.' } });
    expect(screen.getByText('Passo a passo.')).toBeTruthy();
    expect(screen.queryByText(/name: x/)).toBeNull();
  });
});
