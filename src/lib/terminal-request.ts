let pending = false;

// Settings asks for the terminal panel, then navigates to the chat: the panel
// mounts later and takes the request once.
export function requestTerminal(): void { pending = true; }

export function takeTerminalRequest(): boolean {
  const p = pending;
  pending = false;
  return p;
}
