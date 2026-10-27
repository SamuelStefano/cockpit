import { describe, expect, it } from 'vitest';
import {
  checkPreauthGrant, checkPreauthRequest, newDeviceCode, parseDeviceCode, preauthGrantMac, preauthMac,
} from './enroll';
import { fingerprint } from './channel';
import { randomBytes } from './bytes';

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

  it('accepts only the device named by the code, with the right MAC and label', async () => {
    const dev = randomBytes(32), other = randomBytes(32);
    const { code, secret } = await newDeviceCode(dev);
    const parsed = parseDeviceCode(code);
    const mac = await preauthMac(secret, dev, 'Mac · Chrome');
    expect(await checkPreauthRequest(parsed, dev, 'Mac · Chrome', mac)).toBe(true);
    expect(await checkPreauthRequest(parsed, other, 'Mac · Chrome', await preauthMac(secret, other, 'Mac · Chrome'))).toBe(false);
    expect(await checkPreauthRequest(parsed, dev, 'other label', mac)).toBe(false);
    expect(await checkPreauthRequest(parsed, dev, 'Mac · Chrome', await preauthMac(randomBytes(16), dev, 'Mac · Chrome'))).toBe(false);
  });

  it('accepts a grant only for the agent key the secret holder signed', async () => {
    const dev = randomBytes(32), agent = randomBytes(32), relay = randomBytes(32);
    const { secret } = await newDeviceCode(dev);
    const mac = await preauthGrantMac(secret, agent, dev);
    expect(await checkPreauthGrant(secret, agent, dev, mac)).toBe(true);
    expect(await checkPreauthGrant(secret, relay, dev, mac)).toBe(false);
    expect(await checkPreauthGrant(randomBytes(16), agent, dev, mac)).toBe(false);
  });
});
