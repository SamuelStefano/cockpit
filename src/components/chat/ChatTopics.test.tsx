// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { ChatTopics } from './ChatTopics';

afterEach(cleanup);

const topics = [
  { id: 'u1', title: 'vagas dev junior' },
  { id: 'u2', title: 'sobre mim' },
  { id: 'u3', title: 'influência do inglês' },
];

describe('ChatTopics', () => {
  it('renders nothing without topics', () => {
    const { container } = render(<ChatTopics topics={[]} activeId={null} open={false} setOpen={() => {}} onJump={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('closed: only the rail, one tick per topic, active tick in orange', () => {
    const { container } = render(<ChatTopics topics={topics} activeId="u2" open={false} setOpen={() => {}} onJump={() => {}} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    const ticks = container.querySelectorAll('button > span');
    expect(ticks.length).toBe(3);
    expect(ticks[1].className).toContain('bg-orange-400');
    expect(ticks[0].className).not.toContain('bg-orange-400');
  });

  it('open: lists titles and jumps on click', () => {
    const onJump = vi.fn();
    render(<ChatTopics topics={topics} activeId="u1" open setOpen={() => {}} onJump={onJump} />);
    fireEvent.click(screen.getByText('influência do inglês'));
    expect(onJump).toHaveBeenCalledWith('u3');
    expect(screen.getByText('vagas dev junior').closest('button')?.getAttribute('aria-current')).toBe('true');
  });

  it('tapping the rail toggles the list', () => {
    const setOpen = vi.fn();
    render(<ChatTopics topics={topics} activeId="u1" open={false} setOpen={setOpen} onJump={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Tópicos da conversa/));
    expect(setOpen).toHaveBeenCalledWith(true);
  });
});
