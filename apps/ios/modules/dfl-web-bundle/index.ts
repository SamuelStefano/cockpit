// The JS binding of the local Expo module `DflWebBundle`. `null` when the binary has no such module
// (Expo Go, or a build before the bundle variant). The shell passes the status to
// `resolveShellOrigin` (src/origin.ts), which falls back to the public https origin unless the scheme
// is configured, the handler is installed and the bundle is there.
import { requireOptionalNativeModule } from 'expo';
import type { WebBundleStatus } from '../../src/origin';

interface NativeWebBundleModule {
  status(): WebBundleStatus;
}

export function loadWebBundleStatus(): WebBundleStatus | null {
  const native = requireOptionalNativeModule<NativeWebBundleModule>('DflWebBundle');
  if (!native) return null;
  try {
    return native.status();
  } catch (e) {
    return { scheme: null, installed: false, bundlePresent: false, detail: `status() threw: ${String(e)}` };
  }
}
