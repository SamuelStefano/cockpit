import { describe, expect, it } from 'vitest';
import { createStepEndScanner, stripAnsi, typedCommand } from './agent-terminal';

describe('agent-terminal', () => {
  it('types the command, then a marker that prints the exit code, then Enter', () => {
    expect(typedCommand('npm i -g x')).toBe("\x15npm i -g x; printf '\\n[deck] passo terminou (%s)\\n' $?\r");
  });

  it('ignores the echoed input and catches the printed marker', () => {
    const scan = createStepEndScanner();
    expect(scan("$ npm i -g x; printf '\\n[deck] passo terminou (%s)\\n' $?\r\n")).toBeNull();
    expect(scan('added 1 package\r\n')).toBeNull();
    expect(scan('\r\n[deck] passo terminou (0)\r\n$ ')).toBe(0);
  });

  it('finds a marker split across chunks and wrapped in colors', () => {
    const scan = createStepEndScanner();
    expect(scan('\x1b[0m[deck] passo ter')).toBeNull();
    expect(scan('minou (\x1b[1m127\x1b[0m)\r\n')).toBe(127);
  });

  it('fires once per marker', () => {
    const scan = createStepEndScanner();
    expect(scan('[deck] passo terminou (1)\n')).toBe(1);
    expect(scan('$ ')).toBeNull();
  });

  it('strips CSI, OSC and short escapes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m \x1b]0;title\x07ok\x1b=')).toBe('red ok');
  });
});
