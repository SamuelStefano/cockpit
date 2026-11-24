import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dataUrlToFile, inShell, onShellEvent, postToShell, screenshotsOptedIn, screenshotsPromptDismissed,
  setScreenshotsOptedIn, setScreenshotsPromptDismissed, type ShellAccess,
} from '../../lib/shell';

export interface ScreenshotOffer { id: string; thumbnail: string }

// The "paste my latest screenshot" offer of the iOS shell. In a browser this does nothing: the state
// stays idle and no listener or message exists. A print becomes a PENDING attachment through the same
// upload path as a paste (`onUpload`); it is never sent by itself.
export function useScreenshotOffer(onUpload: (file: File) => void) {
  const shell = inShell();
  const [optedIn, setOptedIn] = useState(() => shell && screenshotsOptedIn());
  const [promptDismissed, setPromptDismissed] = useState(() => screenshotsPromptDismissed());
  const [access, setAccess] = useState<ShellAccess | null>(null);
  const [offer, setOffer] = useState<ScreenshotOffer | null>(null);
  const accepting = useRef<string | null>(null);
  const upload = useRef(onUpload);
  upload.current = onUpload;

  useEffect(() => {
    if (!shell || !optedIn) return;
    // Re-sent on every load: the shell keeps the opt-in only in memory, so Photos stay untouched
    // until this device's user has opted in at least once.
    postToShell({ type: 'screenshots-enable' });
    return onShellEvent((e) => {
      if (e.type === 'screenshots-status') setAccess(e.status);
      else if (e.type === 'screenshot-available') setOffer({ id: e.id, thumbnail: e.thumbnail });
      else if (accepting.current === e.id) {
        accepting.current = null;
        const file = dataUrlToFile(e.dataUrl, `print-${Date.now()}.jpg`);
        if (file) upload.current(file);
        setOffer((o) => (o?.id === e.id ? null : o));
      }
    });
  }, [shell, optedIn]);

  const enable = useCallback(() => {
    setScreenshotsOptedIn(true);
    setOptedIn(true);
  }, []);
  const disable = useCallback(() => {
    setScreenshotsOptedIn(false);
    setOptedIn(false);
    setOffer(null);
    setAccess(null);
    postToShell({ type: 'screenshots-disable' });
  }, []);
  const dismissOptIn = useCallback(() => {
    setScreenshotsPromptDismissed(true);
    setPromptDismissed(true);
  }, []);
  const accept = useCallback(() => {
    if (!offer) return;
    accepting.current = offer.id;
    postToShell({ type: 'screenshot-accept', id: offer.id });
  }, [offer]);
  const clearAccess = useCallback(() => setAccess(null), []);
  const dismissOffer = useCallback(() => { accepting.current = null; setOffer(null); }, []);

  return {
    shell, optedIn, access, offer,
    showOptIn: shell && !optedIn && !promptDismissed,
    enable, disable, dismissOptIn, accept, dismissOffer, clearAccess,
  };
}
