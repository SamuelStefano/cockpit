// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AgentForm } from './AgentForm';

afterEach(cleanup);

const base = { bot: null, bots: [], models: [], skills: [], onSave: vi.fn(), onSaved: vi.fn(), onCancel: vi.fn() };

describe('AgentForm build by chat', () => {
  it('opens the chat builder without submitting the form', () => {
    const onSave = vi.fn();
    render(<AgentForm {...base} locked={false} onSave={onSave} onAgentBuild={vi.fn(() => true)} />);
    fireEvent.click(screen.getByText('Criar conversando'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('is hidden when the form is locked or the builder is not wired', () => {
    render(<AgentForm {...base} locked onAgentBuild={vi.fn(() => true)} />);
    expect(screen.queryByText('Criar conversando')).toBeNull();
    cleanup();
    render(<AgentForm {...base} locked={false} />);
    expect(screen.queryByText('Criar conversando')).toBeNull();
  });
});
