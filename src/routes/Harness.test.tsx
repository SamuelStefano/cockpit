// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { Harness } from './Harness';
import type { HarnessConfig } from '../../shared/protocol';

afterEach(cleanup);

const config: HarnessConfig = { hasApiKey: true, nativeModels: [{ id: 'claude-sonnet-5', label: 'Sonnet 5', tier: 'medium' }] };

describe('Harness', () => {
  it('keeps the prompt being written across a disconnect', () => {
    const props = { config, tasks: [], events: {}, onHarnessGet: vi.fn(), onHarnessRun: vi.fn(() => true) };
    const { container, rerender } = render(<Harness connected {...props} />);
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'half a prompt' } });
    rerender(<Harness connected={false} {...props} />);
    expect(container.querySelector('textarea')).toBeNull();
    rerender(<Harness connected {...props} />);
    expect(container.querySelector('textarea')!.value).toBe('half a prompt');
  });
});
