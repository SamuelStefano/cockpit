import { useCallback, useState } from 'react';
import type { ToolCall } from '../../data/types';
import { LETTERS } from './letter-shortcut';
import { useLetterShortcut } from './useLetterShortcut';

// The lettered card handles the common shape only: one single-choice question
// with up to four options. Anything else keeps the regular multi-pick card.
export function isLetterQuestion(tool: ToolCall): boolean {
  const qs = tool.questions ?? [];
  return qs.length === 1 && !qs[0].multiSelect && qs[0].options.length >= 1 && qs[0].options.length <= LETTERS.length;
}

export function useBotQuestionCard(tool: ToolCall, answerable: boolean, onAnswer?: (text: string) => boolean | void) {
  const q = tool.questions?.[0];
  const [picked, setPicked] = useState<number | null>(null);
  const open = answerable && picked === null && !!onAnswer;
  const pick = useCallback((i: number) => {
    const opt = q?.options[i];
    if (!open || !opt || !onAnswer) return;
    // Offline the frame does not leave: the card stays answerable.
    if (onAnswer(opt.label) !== false) setPicked(i);
  }, [open, q, onAnswer]);
  useLetterShortcut(open, q?.options.length ?? 0, pick);
  return { question: q, open, picked, pick };
}
