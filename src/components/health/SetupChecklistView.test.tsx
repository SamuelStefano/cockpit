// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { SetupChecklistView } from './SetupChecklistView';
import { setupChecklist, type ChecklistInput } from '../../cockpit/setup-watch';

const NEW = '22222222-2222-4222-8222-222222222222';
const base: ChecklistInput = {
  watch: { startedAt: 0, known: [], label: 'vps', boxId: null, smokeAsked: true },
  boxes: [{ id: NEW, label: 'vps', online: true, lastSeen: null }],
  active: null, seal: 'connecting', health: null, smoke: null, now: 0,
};

afterEach(cleanup);

describe('SetupChecklistView', () => {
  it('offers to open the new machine when this tab is on another one', () => {
    const onSwitch = vi.fn();
    render(<SetupChecklistView c={setupChecklist(base)} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByRole('button', { name: /Abrir e testar/ }));
    expect(onSwitch).toHaveBeenCalled();
  });

  it('shows the failing check with its command as code', () => {
    const c = setupChecklist({
      ...base, active: NEW, seal: 'sealed',
      health: { at: 1, items: [{ id: 'claude-cli', label: 'Claude Code CLI', level: 'error', detail: 'antigo', hint: 'Atualize: `claude update`' }] },
    });
    render(<SetupChecklistView c={c} onRetry={() => {}} />);
    expect(screen.getByText(/tem um problema a resolver/)).toBeTruthy();
    expect(screen.getByText('claude update').tagName).toBe('CODE');
    expect(screen.getByRole('button', { name: /Testar de novo/ })).toBeTruthy();
  });

  it('says the machine is ready by name', () => {
    const c = setupChecklist({ ...base, active: NEW, seal: 'sealed', health: { at: 1, items: [] }, smoke: { state: 'done', ok: true, ms: 1200 } });
    render(<SetupChecklistView c={c} onDismiss={() => {}} />);
    expect(screen.getByText('vps está pronta para usar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy();
  });
});
