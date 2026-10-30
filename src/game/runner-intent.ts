// "Jogar Bit Runner" in the palette navigates to /arcade, whose page is not
// mounted yet: the intent waits here until the page consumes it.
let pending = false;

export const requestRunner = (): void => { pending = true; };

export function takeRunnerIntent(): boolean {
  const v = pending;
  pending = false;
  return v;
}
