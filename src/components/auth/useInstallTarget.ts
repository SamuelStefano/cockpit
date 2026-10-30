import { useState } from 'react';
import { isWindowsBrowser } from './isWindowsBrowser';

export type InstallTarget = 'windows' | 'remote';

// On a Windows browser the likely target is the PC itself; anywhere else, a server.
export function useInstallTarget() {
  const [isWindows] = useState(() => isWindowsBrowser());
  const [target, setTarget] = useState<InstallTarget>('windows');
  return { isWindows, target, setTarget, native: isWindows && target === 'windows' };
}
