// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { dragTask } from './useDropZone';

function dragEvent(row: HTMLElement, target: HTMLElement) {
  const setData = vi.fn();
  const preventDefault = vi.fn();
  return { e: { currentTarget: row, target, dataTransfer: { setData, effectAllowed: '' }, preventDefault } as never, setData, preventDefault };
}

describe('dragTask', () => {
  it('drags the row from its body', () => {
    const row = document.createElement('li');
    const cell = document.createElement('span');
    row.appendChild(cell);
    document.body.appendChild(row);
    const { e, setData, preventDefault } = dragEvent(row, cell);
    dragTask(e, 't1');
    expect(setData).toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    row.remove();
  });

  it('does not start a row drag while an inline editor inside it is focused', () => {
    const row = document.createElement('li');
    const input = document.createElement('input');
    row.appendChild(input);
    document.body.appendChild(row);
    input.focus();
    const { e, setData, preventDefault } = dragEvent(row, row);
    dragTask(e, 't1');
    expect(preventDefault).toHaveBeenCalled();
    expect(setData).not.toHaveBeenCalled();
    row.remove();
  });
});
