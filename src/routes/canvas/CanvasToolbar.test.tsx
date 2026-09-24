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
  it('labels the two orchestrator entries by what they do', () => {
    const onToggleDock = vi.fn();
    const onFocusOrchestrator = vi.fn();
    const { getByTitle, getByText } = render(
      <CanvasToolbar {...base} dockOpen={false} onToggleDock={onToggleDock} onFocusOrchestrator={onFocusOrchestrator} />,
    );
    fireEvent.click(getByTitle('mais ações'));
    fireEvent.click(getByText('abrir orchestrator'));
    expect(onToggleDock).toHaveBeenCalledOnce();
    fireEvent.click(getByTitle('mais ações'));
    fireEvent.click(getByText('ir pra janela dele'));
    expect(onFocusOrchestrator).toHaveBeenCalledOnce();
  });
});
