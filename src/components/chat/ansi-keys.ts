// Arrow keys that arrive as TEXT instead of as a keydown.
//
// Some input bridges never fire a real ArrowUp keydown: they type the raw ANSI
// cursor sequence into the focused field (ESC [ A, the SS3 variant ESC O A, or
// the caret-notation rendering "^[[A" when the ESC byte was already flattened
// for display). Without this, the composer just stores the sequence and the user
// sees a literal `^[[A` in the message instead of recalling the previous prompt.
//
// Only the cursor keys are handled: they are the ones bound to history recall.
// Left/right are stripped too — as text they are equally garbage — but they carry
// no recall action.

export type ArrowDir = 'up' | 'down' | 'right' | 'left';

const DIRS: Record<string, ArrowDir> = { A: 'up', B: 'down', C: 'right', D: 'left' };

// ESC [ A | ESC O A | ^[[A | ^[OA. The ESC (or its caret rendering) is required on
// purpose: a bare "[A" is legitimate text — `array[A]` must survive untouched.
const ANSI_ARROW_RE = /(?:\x1b\[|\x1bO|\^\[\[|\^\[O)([ABCD])/g;

export interface StrippedArrows {
  /** Field text with every arrow sequence removed. */
  text: string;
  /** Directions found, in order of appearance. */
  arrows: ArrowDir[];
  /** Offset, inside `text`, where the first sequence was removed — the caret. */
  at: number;
}

export function stripAnsiArrows(raw: string): StrippedArrows {
  const arrows: ArrowDir[] = [];
  let removed = 0;
  let at = -1;
  const text = raw.replace(ANSI_ARROW_RE, (match: string, letter: string, offset: number) => {
    // `offset` indexes `raw`; discounting what was already dropped turns it into
    // an index into the stripped text.
    if (at < 0) at = offset - removed;
    removed += match.length;
    arrows.push(DIRS[letter]);
    return '';
  });
  return { text, arrows, at: at < 0 ? 0 : Math.min(at, text.length) };
}
