// Display-only: the CLI already sent its final result, so the "thinking"
// indicators hide while the process is still closing. Phase itself stays put.
export function showsWorking(phase: string, settled: boolean | undefined): boolean {
  return phase !== 'idle' && !settled;
}
