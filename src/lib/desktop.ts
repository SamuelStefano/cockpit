import type { DeckDesktopBridge, DeckDesktopLink } from '../../shared/desktop-bridge';

function bridge(): Partial<DeckDesktopBridge> | undefined {
  return (globalThis as { deckDesktop?: Partial<DeckDesktopBridge> }).deckDesktop;
}

export function inDesktopApp(): boolean {
  return bridge() !== undefined;
}

// Shells before apiVersion 3 draw the native title bar: a second one would stack on it.
export function hasCustomTitlebar(): boolean {
  return (bridge()?.apiVersion ?? 0) >= 3;
}

export function desktopVersion(): string | null {
  return bridge()?.appVersion ?? null;
}

// The web deploys ahead of the installed shell, so each method may be missing.
export function focusDesktopWindow(): boolean {
  const fn = bridge()?.focusWindow;
  if (!fn) return false;
  fn();
  return true;
}

export function setDesktopBadge(count: number): boolean {
  const fn = bridge()?.setBadge;
  if (!fn) return false;
  fn(count);
  return true;
}

export function onDesktopLink(cb: (link: DeckDesktopLink) => void): void {
  bridge()?.onLink?.(cb);
}
