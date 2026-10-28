import { describe, expect, it } from 'vitest';
import { parseEmailList, parseEnvFile } from './config.ts';

describe('parseEnvFile', () => {
  it('reads KEY=VALUE, quotes and export, skips comments', () => {
    expect(parseEnvFile('# c\nexport A=1\nB="two words"\nlower=x\nC=\'q\'\n')).toEqual({ A: '1', B: 'two words', C: 'q' });
  });
});

describe('parseEmailList', () => {
  it('normalizes and drops junk', () => {
    expect([...parseEmailList(' Samuel@Gmail.com, taigfs@gmail.com ,,nope')]).toEqual(['samuel@gmail.com', 'taigfs@gmail.com']);
    expect(parseEmailList(undefined).size).toBe(0);
  });
});
