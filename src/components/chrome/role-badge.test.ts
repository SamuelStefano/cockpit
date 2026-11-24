import { describe, it, expect } from 'vitest';
import { roleBadge } from './role-badge';

describe('roleBadge', () => {
  it('names root and admin, with a tooltip', () => {
    expect(roleBadge('root')?.label).toBe('root');
    expect(roleBadge('admin')?.label).toBe('admin');
    expect(roleBadge('root')?.title).toMatch(/root/);
    expect(roleBadge('admin')?.title).toMatch(/admin/);
  });

  it('shows nothing for a student', () => {
    expect(roleBadge('student')).toBeNull();
  });
});
