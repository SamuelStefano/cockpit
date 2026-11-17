// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { VilaButton } from './VilaButton';
import { navRole } from './nav-routes';

afterEach(cleanup);

const admin = (role: 'root' | 'admin' | 'student' | undefined) => navRole(role as never) !== 'student';

describe('VilaButton', () => {
  it('is hidden for a student and before caps are known', () => {
    const { container, rerender } = render(<VilaButton route="/" isAdmin={admin('student')} onGo={() => {}} />);
    expect(container.innerHTML).toBe('');
    rerender(<VilaButton route="/" isAdmin={admin(undefined)} onGo={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it.each(['admin', 'root'] as const)('is visible for %s', (role) => {
    render(<VilaButton route="/" isAdmin={admin(role)} onGo={() => {}} />);
    expect(screen.getByRole('button', { name: 'Vila' })).toBeTruthy();
  });

  it('hides the label on small screens', () => {
    render(<VilaButton route="/" isAdmin onGo={() => {}} />);
    expect(screen.getByText('Vila').className).toContain('max-md:hidden');
  });

  it('navigates to /equipe/mundo on click', () => {
    const onGo = vi.fn();
    render(<VilaButton route="/" isAdmin onGo={onGo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vila' }));
    expect(onGo).toHaveBeenCalledWith('/equipe/mundo');
  });

  it('marks the active route', () => {
    const { rerender } = render(<VilaButton route="/equipe/mundo" isAdmin onGo={() => {}} />);
    expect(screen.getByRole('button', { name: 'Vila' }).getAttribute('aria-current')).toBe('page');
    rerender(<VilaButton route="/" isAdmin onGo={() => {}} />);
    expect(screen.getByRole('button', { name: 'Vila' }).getAttribute('aria-current')).toBeNull();
  });
});
