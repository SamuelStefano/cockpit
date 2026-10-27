// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatInputToolbar } from './ChatInputToolbar';

afterEach(cleanup);

function setup(onCall?: () => void) {
  render(
    <ChatInputToolbar
      mode="plan" setMode={vi.fn()} caps={null} bypass={false} setBypass={vi.fn()}
      skills={[]} selectedSkills={[]} setSelectedSkills={vi.fn()}
      mcpServers={[]} selectedMcps={[]} setSelectedMcps={vi.fn()}
      model="sonnet" setModel={vi.fn()} models={[]} onRefreshModels={vi.fn()}
      effort="medium" setEffort={vi.fn()} onOpenSettings={vi.fn()} onCall={onCall}
    />,
  );
}

describe('ChatInputToolbar call button', () => {
  it('dials when the Ligar icon button is clicked', () => {
    const onCall = vi.fn();
    setup(onCall);
    fireEvent.click(screen.getByLabelText('Ligar'));
    expect(onCall).toHaveBeenCalledTimes(1);
  });

  it('hides the button when calls are unsupported', () => {
    setup();
    expect(screen.queryByLabelText('Ligar')).toBeNull();
  });
});
