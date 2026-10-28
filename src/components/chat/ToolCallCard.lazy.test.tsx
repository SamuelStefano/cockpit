// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ToolCallCard } from './ToolCallCard';

afterEach(cleanup);

const tool = { id: 't', name: 'Bash', input: { command: 'ls' }, output: ['a', 'b', 'c'], status: 'done' } as never;

describe('ToolCallCard output', () => {
  it('does not render the output lines until opened, then shows them', () => {
    const { container, getByText } = render(<ToolCallCard tool={tool} />);
    expect(container.querySelector('pre')).toBeNull();
    fireEvent.click(getByText(/mostrar output/));
    expect(container.querySelector('pre')?.textContent).toContain('b');
  });
});

describe('ToolCallCard command', () => {
  it('keeps each line of a multi-line command on its own line', () => {
    const multi = { id: 'm', name: 'Bash', input: { command: 'cd x\nls -la' }, command: 'cd x\nls -la', output: [], status: 'done' } as never;
    const { container } = render(<ToolCallCard tool={multi} />);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('cd x\nls -la');
    expect(code?.className).toContain('whitespace-pre');
    expect(code?.className).not.toContain('whitespace-nowrap');
  });
});
