import { useState, type ReactNode } from 'react';
import { COARSE_QUERY } from '../primitives/useCoarse';
import { useCopied } from '../../lib/useCopied';
import { haptic } from '../../lib/haptics';
import { useLongPress } from '../sessions/useLongPress';
import { MessageActionsSheet, type MessageAction } from './MessageActionsSheet';

export interface MessageActionsSpec {
  text: string;
  speak?: boolean;
  onRegenerate?: () => void;
  onQuote?: (text: string) => void;
  onMemorize?: (text: string) => void;
  onEdit?: () => void;
}

function speakText(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  if (synth.speaking) { synth.cancel(); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR';
  synth.speak(u);
}

export function buildActions(spec: MessageActionsSpec, copy: (t: string) => void): MessageAction[] {
  const list: MessageAction[] = [{ id: 'copy', label: 'Copiar', icon: 'copy', run: () => copy(spec.text) }];
  if (spec.speak && typeof window !== 'undefined' && 'speechSynthesis' in window) list.push({ id: 'speak', label: 'Ler em voz alta', icon: 'volume', run: () => speakText(spec.text) });
  if (spec.onEdit) list.push({ id: 'edit', label: 'Editar e reenviar', icon: 'pencil', run: spec.onEdit });
  if (spec.onRegenerate) list.push({ id: 'regen', label: 'Gerar de novo', icon: 'rotate', run: spec.onRegenerate });
  if (spec.onQuote) list.push({ id: 'quote', label: 'Citar no compositor', icon: 'message', run: () => spec.onQuote?.(spec.text) });
  if (spec.onMemorize) list.push({ id: 'memorize', label: 'Memorizar', icon: 'sparkles', run: () => spec.onMemorize?.(spec.text) });
  return list;
}

interface MessageActionsHostProps {
  spec: MessageActionsSpec;
  className?: string;
  mid?: string;
  children: ReactNode;
}

// On touch the per-message buttons are replaced by a long-press sheet. The query
// is read at press time so hundreds of rows share no media-query listeners.
export function MessageActionsHost({ spec, className, mid, children }: MessageActionsHostProps) {
  const [open, setOpen] = useState(false);
  const [, copy] = useCopied();
  const { handlers: press } = useLongPress(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia(COARSE_QUERY).matches) return;
    haptic('tap');
    setOpen(true);
  });
  return (
    <div data-mid={mid} className={className} {...press}>
      {children}
      {open && <MessageActionsSheet open onClose={() => setOpen(false)} actions={buildActions(spec, copy)} />}
    </div>
  );
}
