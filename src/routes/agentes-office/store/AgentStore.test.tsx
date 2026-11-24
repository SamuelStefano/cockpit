// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { TeamBot } from '../../../../shared/protocol';
import { AGENT_CATALOG, catalogEntry } from '../../../../shared/agent-catalog';
import { MAX_BOTS, validateBotInput } from '../../../../shared/team';
import { AgentStore } from './AgentStore';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const bot = (id: string, label: string, name = id): TeamBot => ({ id, name, label, instructions: '', mascot: { shape: 'blob', color: '#3b82f6' }, profile: 'full', createdAt: 0, updatedAt: 0 });
const skill = (id: string) => ({ id }) as never;

function setup(over: { bots?: TeamBot[]; canEdit?: boolean } = {}) {
  const onSave = vi.fn();
  const onHired = vi.fn();
  const props = { bots: over.bots ?? [], skills: [skill('spec-driven')], canEdit: over.canEdit ?? true, onSave, onHired };
  const view = render(<AgentStore {...props} />);
  return { onSave, onHired, props, view };
}

describe('AgentStore', () => {
  it('renders one section per department with a card per catalog entry', () => {
    setup();
    ['Direção', 'Engenharia', 'Growth', 'Finanças', 'Operações'].forEach((n) => expect(screen.getByRole('region', { name: n })).toBeTruthy());
    expect(screen.getAllByRole('button', { name: 'Contratar' })).toHaveLength(AGENT_CATALOG.length);
  });

  it('shows the lead and only installed skills', () => {
    setup();
    const card = screen.getByText('Tech Lead').closest('article')!;
    expect(within(card).getByText('responde a CTO')).toBeTruthy();
    expect(within(card).getByText('1 habilidade')).toBeTruthy();
    expect(within(screen.getByText('Tráfego pago').closest('article')!).queryByText(/habilidade/)).toBeNull();
  });

  it('marks an existing role and offers to hire another', () => {
    setup({ bots: [bot('ana01', 'cto')] });
    const card = screen.getByText('CTO', { selector: 'span' }).closest('article')!;
    expect(within(card).getByText('Já na equipe')).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Contratar outro' })).toBeTruthy();
  });

  it('hires a single agent: saves one valid draft, then reports it once it arrives', () => {
    const { onSave, onHired, props, view } = setup();
    const card = screen.getByText('QA', { selector: 'span' }).closest('article')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Contratar' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const draft = onSave.mock.calls[0][0];
    expect(validateBotInput(draft)).toMatchObject({ ok: true });
    expect(draft.label).toBe('QA');
    expect(onHired).not.toHaveBeenCalled();
    view.rerender(<AgentStore {...props} bots={[bot(draft.id, 'QA')]} />);
    expect(onHired).toHaveBeenCalledWith(draft.id, 1);
  });

  it('hires a whole department in lead-first order', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Contratar setor Engenharia' }));
    const drafts = onSave.mock.calls.map((c) => c[0]);
    expect(drafts).toHaveLength(AGENT_CATALOG.filter((e) => e.department === 'engineering').length);
    expect(drafts[0].label).toBe('CTO');
    const ids = new Set<string>();
    for (const d of drafts) { if (d.parentId) expect(ids.has(d.parentId)).toBe(true); ids.add(d.id); }
  });

  it('opens a modal with the full instructions and hires from it', () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByText('CEO', { selector: 'span' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(catalogEntry('ceo')!.instructions.slice(0, 40));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Contratar' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the hire button does not open the modal', () => {
    setup();
    fireEvent.click(within(screen.getByText('CEO', { selector: 'span' }).closest('article')!).getByRole('button', { name: 'Contratar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disables hiring with a reason when the user cannot edit', () => {
    const { onSave } = setup({ canEdit: false });
    screen.getAllByRole('button', { name: 'Contratar' }).forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getAllByText('Só administradores contratam agentes.').length).toBeGreaterThan(0);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('disables hiring when the team would pass MAX_BOTS', () => {
    const full = Array.from({ length: MAX_BOTS }, (_, i) => bot(`bot${String(i).padStart(4, '0')}`, `r${i}`));
    setup({ bots: full });
    screen.getAllByRole('button', { name: 'Contratar' }).forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    expect(screen.getAllByText(/limite de 50/).length).toBeGreaterThan(0);
  });

  it('tells the user when the hire never shows up', () => {
    vi.useFakeTimers();
    const { onHired } = setup();
    fireEvent.click(within(screen.getByText('QA', { selector: 'span' }).closest('article')!).getByRole('button', { name: 'Contratar' }));
    act(() => { vi.advanceTimersByTime(11_000); });
    expect(onHired).not.toHaveBeenCalled();
    expect((within(screen.getByText('QA', { selector: 'span' }).closest('article')!).getByRole('button', { name: 'Contratar' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
