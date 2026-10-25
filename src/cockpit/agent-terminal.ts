// "Rodar no terminal": a step's command is typed into the agent's own Deck
// terminal followed by a marker line, so the page learns the command finished
// (and with which exit code) by reading the PTY output — no server change, and
// the person sees exactly what ran.

const MARKER = '[deck] passo terminou';
// The echoed input reads "(%s)"; only the printed line carries digits.
const STEP_END_RE = /\[deck\] passo terminou \((\d{1,3})\)/;
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[^[\]]/g;
const TAIL_MAX = 400;

// Ctrl-U first: whatever was half-typed at the prompt would glue onto the command.
export function typedCommand(command: string): string {
  return `\x15${command}; printf '\\n${MARKER} (%s)\\n' $?\r`;
}

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

// Output arrives in arbitrary chunks; the marker can straddle two of them.
export function createStepEndScanner(): (chunk: string) => number | null {
  let tail = '';
  return (chunk) => {
    tail = (tail + stripAnsi(chunk).replace(/\r/g, '')).slice(-TAIL_MAX);
    const m = STEP_END_RE.exec(tail);
    if (!m) return null;
    tail = '';
    return Number(m[1]);
  };
}
