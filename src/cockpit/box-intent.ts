// "Nova sessão" on another box: the switch remounts the cockpit, so the request
// crosses the remount here and the new tree takes it once, for that box only.
let pendingNew: string | null = null;

export function requestNewOn(box: string): void {
  pendingNew = box;
}

export function takeNewIntent(box: string | null): boolean {
  const hit = pendingNew !== null && pendingNew === box;
  pendingNew = null;
  return hit;
}
