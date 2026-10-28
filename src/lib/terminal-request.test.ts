import { describe, it, expect } from 'vitest';
import { requestTerminal, takeTerminalRequest } from './terminal-request';

describe('terminal request', () => {
  it('is taken once', () => {
    expect(takeTerminalRequest()).toBe(false);
    requestTerminal();
    expect(takeTerminalRequest()).toBe(true);
    expect(takeTerminalRequest()).toBe(false);
  });
});
