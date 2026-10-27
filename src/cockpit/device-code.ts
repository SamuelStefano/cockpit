import { newDeviceCode } from '../../shared/e2e/enroll';
import { passkeyDevice } from './device-store';
import { savePreauth } from './preauth-store';

// DECK_DEVICE_CODE for the setup command: only a passkey key is worth
// pre-authorizing (it is the one every synced browser will use). Empty when
// this browser has none, which leaves the command as it always was. Kept per
// pair code, so two pairing screens never overwrite each other's secret.
export async function issueDeviceCode(pairCode: string): Promise<string> {
  const d = await passkeyDevice().catch(() => null);
  if (!d) return '';
  const { code, secret } = await newDeviceCode(d.pub);
  try { savePreauth(pairCode, secret); } finally { secret.fill(0); }
  return code;
}
