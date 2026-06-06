import { describe, it, expect } from 'vitest';
import { metaForId } from './index';

const VALID = '12345678-1234-1234-1234-123456789abc';

describe('metaForId slug guard', () => {
  it('rejects ids that are not a canonical UUID before touching disk', async () => {
    const bad = [
      '../etc/passwd',
      'a/b',
      '123456789012345678901234567890123456',
      'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      `${VALID}.jsonl`,
      '',
    ];
    for (const id of bad) expect(await metaForId(id)).toBeNull();
  });

  it('returns null for a canonical UUID that has no file', async () => {
    expect(await metaForId(VALID)).toBeNull();
  });
});
