import { useState } from 'react';
import { isWindowsBrowser } from './isWindowsBrowser';

export type WslTarget = 'wsl' | 'remote';

export function useWslGuide() {
  const [isWindows] = useState(() => isWindowsBrowser());
  const [target, setTarget] = useState<WslTarget>('wsl');
  return { isWindows, target, setTarget, showSteps: isWindows && target === 'wsl' };
}
