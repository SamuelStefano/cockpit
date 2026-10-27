import { describe, expect, it } from 'vitest';
import {
  checkPreauthGrant, checkPreauthRequest, newDeviceCode, parseDeviceCode, preauthGrantMac, preauthMac,
} from './enroll';
import { fingerprint } from './channel';
import { randomBytes } from './bytes';

const BOX = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('device code (pre-authorization at pairing)', () => {
  it('round-trips the fingerprint and the secret', async () => {
    const dev = randomBytes(32);
    const { code, secret } = await newDeviceCode(dev);
    expect(code).toMatch(/^[A-Z2-7]{52}$/);
    const parsed = parseDeviceCode(code);
    expect(parsed.secret).toEqual(secret);
    expect(parsed.deviceFp).toEqual(await fingerprint(dev));
  });

  it('rejects a malformed code', () => {
    expect(() => parseDeviceCode('ABC')).toThrow();
    expect(() => parseDeviceCode('!'.repeat(52))).toThrow();
  });

  it('accepts only the device named by the code, with the right MAC, label and box', async () => {
    const dev = randomBytes(32), other = randomBytes(32);
    const { code, secret } = await newDeviceCode(dev);
    const parsed = parseDeviceCode(code);
    const mac = await preauthMac(secret, dev, 'Mac · Chrome', BOX);
    expect(await checkPreauthRequest(parsed, dev, 'Mac · Chrome', BOX, mac)).toBe(true);
    expect(await checkPreauthRequest(parsed, dev, 'Mac · Chrome', BOX.toUpperCase(), mac)).toBe(true);
    expect(await checkPreauthRequest(parsed, other, 'Mac · Chrome', BOX, await preauthMac(secret, other, 'Mac · Chrome', BOX))).toBe(false);
    expect(await checkPreauthRequest(parsed, dev, 'other label', BOX, mac)).toBe(false);
    expect(await checkPreauthRequest(parsed, dev, 'Mac · Chrome', OTHER, mac)).toBe(false);
    expect(await checkPreauthRequest(parsed, dev, 'Mac · Chrome', BOX, await preauthMac(randomBytes(16), dev, 'Mac · Chrome', BOX))).toBe(false);
  });

  it('accepts a grant only for the agent key the secret holder signed, for the box asked for', async () => {
    const dev = randomBytes(32), agent = randomBytes(32), relay = randomBytes(32);
    const { secret } = await newDeviceCode(dev);
    const mac = await preauthGrantMac(secret, agent, dev, BOX);
    expect(await checkPreauthGrant(secret, agent, dev, BOX, mac)).toBe(true);
    expect(await checkPreauthGrant(secret, agent, dev, OTHER, mac)).toBe(false);
    expect(await checkPreauthGrant(secret, relay, dev, BOX, mac)).toBe(false);
    expect(await checkPreauthGrant(randomBytes(16), agent, dev, BOX, mac)).toBe(false);
  });
});
