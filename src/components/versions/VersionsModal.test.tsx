// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { VersionsModal } from './VersionsModal';
import type { VersionsApi } from '../../cockpit/useVersions';

afterEach(cleanup);

const mk = (over: Partial<VersionsApi> = {}): VersionsApi => ({
  id: 'gem', loading: false, restoring: false, diff: null, open: vi.fn(), close: vi.fn(), showDiff: vi.fn(), restore: vi.fn(),
  items: [
    { version: '1700000000002-bbbbbbbb', ts: 1_700_000_000_002, bytes: 5, deleted: false },
    { version: '1700000000001-aaaaaaaa', ts: 1_700_000_000_001, bytes: 5, deleted: false, note: 'primeira' },
  ],
  ...over,
});

describe('VersionsModal', () => {
  it('compares and restores an older version against the latest', () => {
    const api = mk();
    render(<VersionsModal api={api} title="Gem" canRestore />);
    fireEvent.click(screen.getByRole('button', { name: 'Comparar com atual' }));
    expect(api.showDiff).toHaveBeenCalledWith('1700000000001-aaaaaaaa', '1700000000002-bbbbbbbb');
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(api.restore).toHaveBeenCalledWith('1700000000001-aaaaaaaa');
  });

  it('hides Restaurar when the caller cannot restore', () => {
    render(<VersionsModal api={mk()} title="Gem" canRestore={false} />);
    expect(screen.queryByRole('button', { name: 'Restaurar' })).toBeNull();
    expect(screen.getByText(/conta root/)).toBeTruthy();
  });

  it('colors the diff lines', () => {
    render(<VersionsModal api={mk({ diff: { from: 'a', to: 'b', text: '@@ -1 +1 @@\n-old\n+new' } })} title="Gem" canRestore />);
    expect(screen.getByText('+new').className).toContain('emerald');
    expect(screen.getByText('-old').className).toContain('red');
  });

  it('renders nothing while closed', () => {
    const { container } = render(<VersionsModal api={mk({ id: null })} title="Gem" canRestore />);
    expect(container.textContent).toBe('');
  });
});
