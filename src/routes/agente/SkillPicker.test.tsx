// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SkillMeta } from '../../../shared/protocol';
import { SkillPicker } from './SkillPicker';

const skills: SkillMeta[] = [
  { id: 'a', name: 'alpha', description: '', mtime: 0 },
  { id: 'b', name: 'beta', description: '', mtime: 0, risk: ['write'] },
];
const perms = { read: true, write: false, net: true };

describe('SkillPicker', () => {
  it('shows all on by default and toggles one off', () => {
    const onChange = vi.fn();
    render(<SkillPicker skills={skills} value={[]} perms={perms} onChange={onChange} />);
    expect(screen.getByText('Todas as 2 ligadas')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('beta'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });
  it('applies the reader preset, filters by search and flags blocked skills', () => {
    const onChange = vi.fn();
    render(<SkillPicker skills={skills} value={[]} perms={perms} onChange={onChange} />);
    fireEvent.click(screen.getByText('Pesquisador (só lê)'));
    expect(onChange).toHaveBeenCalledWith(['a']);
    expect(screen.getByText('bloqueada pelas permissões')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar skill'), { target: { value: 'alp' } });
    expect(screen.queryByLabelText('beta')).toBeNull();
  });
});
