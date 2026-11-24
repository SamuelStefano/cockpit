// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EMPTY_BUILDER_DRAFT } from '../../../shared/agent-builder';
import { BotBuilder } from './BotBuilder';

const skills = [{ id: 'planilhas', name: 'Planilhas', description: 'Sabe criar planilhas. Detalhe extra.', mtime: 0 }];

function setup(initial = EMPTY_BUILDER_DRAFT) {
  const onAccept = vi.fn();
  render(<BotBuilder initial={initial} skills={skills} result={null} onBuild={() => true} onAccept={onAccept} onClose={() => {}} />);
  return onAccept;
}

describe('BotBuilder', () => {
  it('shows plain-language toggles and never the word skill', () => {
    setup();
    expect(screen.getByText('Sabe criar planilhas.')).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain('skill');
  });

  it('blocks accepting an empty preview and hands over the draft once it has a name', () => {
    const empty = setup();
    const accept = screen.getByRole('button', { name: /Aceitar prévia/ });
    expect((accept as HTMLButtonElement).disabled).toBe(true);
    expect(empty).not.toHaveBeenCalled();
  });

  it('accepts a preview that has been toggled, keeping the edit data', () => {
    const onAccept = setup({ ...EMPTY_BUILDER_DRAFT, name: 'ana' });
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: /Aceitar prévia/ }));
    expect(onAccept).toHaveBeenCalledWith({ ...EMPTY_BUILDER_DRAFT, name: 'ana', skills: ['planilhas'] });
  });
});
