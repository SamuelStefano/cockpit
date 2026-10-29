// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CanvasToolbar } from './CanvasToolbar';

afterEach(cleanup);

const base = {
  zoom: 0.75, onZoom: vi.fn(), onFit: vi.fn(), onResetLayout: vi.fn(), onNewTerminal: vi.fn(), onOpenRecent: vi.fn(),
  analysisOn: false, onToggleAnalysis: vi.fn(),
};

describe('CanvasToolbar mobile menu', () => {
  it('runs the chosen action and closes', () => {
    const { getByTitle, getAllByText } = render(<CanvasToolbar {...base} />);
    fireEvent.click(getByTitle('mais ações'));
    fireEvent.click(getAllByText('terminal').at(-1)!);
    expect(base.onNewTerminal).toHaveBeenCalledOnce();
  });
});
