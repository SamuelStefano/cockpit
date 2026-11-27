// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MeetingsTab } from './MeetingsTab';
import { bots, meeting } from './meetings.fixtures';

afterEach(cleanup);

const props = { bots, connected: true, canEdit: true, onGet: vi.fn(), onStart: vi.fn() };

describe('MeetingsTab', () => {
  it('requests the list when it opens, for admins only', () => {
    const onGet = vi.fn();
    render(<MeetingsTab {...props} meetings={[]} onGet={onGet} />);
    expect(onGet).toHaveBeenCalledTimes(1);
    cleanup();
    const other = vi.fn();
    render(<MeetingsTab {...props} meetings={[]} canEdit={false} onGet={other} />);
    expect(other).not.toHaveBeenCalled();
  });

  it('lists newest first with a status chip and mascots, and opens one', () => {
    const list = [meeting({ id: 'old', question: 'Older one', createdAt: 1 }), meeting({ id: 'new', question: 'Newer one', createdAt: 9, status: 'done', minutes: 'ata' })];
    render(<MeetingsTab {...props} meetings={list} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Newer one');
    expect(items[0].textContent).toContain('Concluída');
    expect(items[0].querySelectorAll('svg[role="img"]')).toHaveLength(2);
    fireEvent.click(items[1].querySelector('button')!);
    expect(screen.getByRole('heading', { name: 'Older one' })).toBeTruthy();
  });

  it('starts a meeting and jumps to it when it appears', () => {
    const onStart = vi.fn();
    const { rerender } = render(<MeetingsTab {...props} meetings={[]} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /Nova reunião/ }));
    fireEvent.change(screen.getByLabelText(/Pergunta da reunião/), { target: { value: 'Contratar?' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Ana/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Caio/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir reunião' }));
    expect(onStart).toHaveBeenCalledWith({ question: 'Contratar?', participantIds: ['a1', 'c3'], moderatorId: 'b2' });
    rerender(<MeetingsTab {...props} meetings={[meeting({ id: 'mx', question: 'Contratar?', participantIds: ['a1', 'c3'] })]} onStart={onStart} />);
    expect(screen.getByRole('heading', { name: 'Contratar?' })).toBeTruthy();
  });
});
