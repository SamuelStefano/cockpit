// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AssistantBlocks } from './AssistantBlocks';

afterEach(cleanup);

describe('AssistantBlocks thinking preview', () => {
  it('adds an ellipsis only when the thought was cut', () => {
    const short = render(<AssistantBlocks blocks={[{ type: 'thinking', text: 'curto' }] as never} caretOnLast={false} />);
    expect(short.getByText('curto')).toBeTruthy();
    cleanup();
    const long = render(<AssistantBlocks blocks={[{ type: 'thinking', text: 'x'.repeat(80) }] as never} caretOnLast={false} />);
    expect(long.getByText(`${'x'.repeat(60)}…`)).toBeTruthy();
  });
});
