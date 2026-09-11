// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { SkillPicker } from './SkillPicker';

afterEach(cleanup);

const skills = Array.from({ length: 12 }, (_, i) => ({
  id: `s${i}`, name: `Skill ${i}`, mtime: 0, description: `Uma descrição bem longa da skill número ${i} que não cabe numa linha só`,
}));

function setup(selected: string[] = []) {
  const setSelected = vi.fn();
  render(<SkillPicker skills={skills} selected={selected} setSelected={setSelected} />);
  fireEvent.click(screen.getAllByText('skills')[0]);
  return { setSelected };
}

describe('SkillPicker', () => {
  it('toggles a skill and reports which ones are selected', () => {
    const { setSelected } = setup(['s1']);
    expect(screen.getByRole('button', { name: /^Skill 1(?!\d)/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Skill 11(?!\d)/ }));
    expect(setSelected).toHaveBeenCalledWith(['s1', 's11']);
  });

  it('shows only the skill names, without descriptions', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Escolher skills' });
    expect(dialog.textContent).toContain('Skill 0');
    expect(dialog.textContent).not.toContain('Uma descrição bem longa');
  });

  it('has a close button and a "Pronto" button so the sheet can be left on mobile', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Escolher skills' })).toBeTruthy();
    fireEvent.click(screen.getByText('Pronto'));
    expect(screen.queryByRole('dialog')).toBeNull();
    setup();
    fireEvent.click(screen.getByLabelText('Fechar escolher skills'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the list in a flex column that scrolls instead of a vh-capped box', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: 'Escolher skills' });
    expect(dialog.className).toContain('flex-col');
    const list = dialog.querySelector('.overflow-y-auto');
    expect(list?.className).toContain('min-h-0');
    expect(list?.className).not.toMatch(/70vh/);
  });
});
