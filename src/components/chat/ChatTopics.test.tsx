// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
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
    // each tick is a shrinkable slot (button > span) holding the 2px mark
    const ticks = container.querySelectorAll('button > span > span');
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

  it('closes the open list on Escape and on a tap outside', () => {
    const setOpen = vi.fn();
    render(<ChatTopics topics={topics} activeId="u1" open setOpen={setOpen} onJump={() => {}} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(setOpen).toHaveBeenLastCalledWith(false);
    setOpen.mockClear();
    fireEvent.mouseDown(document.body);
    expect(setOpen).toHaveBeenLastCalledWith(false);
  });

  it('a tap opens the list: the emulated mouseenter before the click does not toggle it shut', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <ChatTopics topics={topics} activeId="u1" open={open} setOpen={setOpen} onJump={() => {}} />;
    }
    render(<Harness />);
    const rail = screen.getByLabelText(/Tópicos da conversa/);
    // touch tap sequence: pointer events (touch), then the compat mouse events, then click
    fireEvent.pointerEnter(rail, { pointerType: 'touch' });
    fireEvent.mouseEnter(rail);
    fireEvent.mouseOver(rail);
    fireEvent.click(rail);
    expect(rail.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('navigation')).toBeTruthy();
  });
});
