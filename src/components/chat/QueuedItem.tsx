import { useEffect, useMemo, useRef, useState } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { Icon, tokens } from '../primitives';
import { QueuedItemActions } from './QueuedItemActions';
import { useLongPress } from '../sessions/useLongPress';
import { QueuedBgLauncher } from './QueuedBgLauncher';
import { isVirtualKeyboardOnly } from './touch';

interface Props {
  index: number;
  text: string;
  atts: number;
  expanded: boolean;
  flash: boolean;
  first: boolean;
  last: boolean;
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onToggle: () => void;
  onStartEdit: () => void;
  onCommit: () => void;
  onCancelEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  // Disparo em background: modelo com que o item foi enfileirado (semente do
  // seletor) + lista pra escolher outro só neste disparo.
  bgModel: string;
  models: ModelInfo[];
  bgOpen: boolean;
  onToggleBg: () => void;
  onRunBg: (model: string) => void;
  onRunNow: () => void;
  // Fila pausada / sem quota / item segurado: o servidor recusaria o disparo, e
  // aceitar o clique mataria o turno em andamento à toa.
  nowBlocked: boolean;
}

// Uma linha da fila: ver completo, editar no lugar, reordenar e cancelar. Editar
// mexe só no texto — o item mantém posição e os anexos amarrados a ele.
export function QueuedItem({ index, text, atts, expanded, flash, first, last, editing, draft, setDraft, onToggle, onStartEdit, onCommit, onCancelEdit, onMove, onRemove, bgModel, models, bgOpen, onToggleBg, onRunBg, onRunNow, nowBlocked }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const liRef = useRef<HTMLLIElement>(null);
  const bgId = `fila-bg-${index}`;
  // Teclado virtual não tem Shift+Enter: no toque o Enter quebra linha e salvar é
  // só pelo botão — mesma regra do composer.
  const touch = useMemo(isVirtualKeyboardOnly, []);
  const [more, setMore] = useState(false);
  const press = useLongPress(() => setMore(true));
  useEffect(() => { if (editing) taRef.current?.focus(); }, [editing]);
  // The list scrolls (QueuedBanner caps its height): a moved item flashes where
  // it landed, which may be outside the visible part.
  useEffect(() => { if (flash) liRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [flash]);
  return (
    <li ref={liRef} className={`rounded-md transition-colors duration-500 ${flash ? 'bg-orange-500/20' : ''}`}>
      <div className="flex items-start gap-1 pointer-coarse:flex-wrap">
        <span className="mt-0.5 shrink-0 text-[12px] tabular-nums text-orange-400/50">{index + 1}.</span>
        {atts > 0 && (
          <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-[12px] tabular-nums text-orange-300/80" title={`${atts} anexo${atts > 1 ? 's' : ''} amarrado${atts > 1 ? 's' : ''} a este prompt`}>
            <Icon name="paperclip" size={10} />{atts > 1 ? atts : ''}
          </span>
        )}
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            rows={3}
            aria-label="Editar mensagem na fila"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
              // isComposing: the Enter that confirms an IME/dead-key candidate must not commit mid-word.
              if (e.key === 'Enter' && !e.shiftKey && !touch && !e.nativeEvent.isComposing) { e.preventDefault(); onCommit(); }
            }}
            className={`flex-1 resize-none rounded-sm border border-orange-500/40 bg-neutral-900 px-1.5 py-1 text-[12px] leading-snug text-neutral-200 ${tokens.focusRing}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => { if (!press.consumeTap()) onToggle(); }}
            {...(touch ? press.handlers : {})}
            title={expanded ? 'Recolher' : 'Ver completo'}
            className={`flex-1 rounded-sm text-left text-[12px] leading-snug ${tokens.focusRing} ${text ? 'text-neutral-300' : 'italic text-neutral-500'} ${expanded ? 'whitespace-pre-wrap wrap-break-word' : 'truncate'}`}
          >
            {text || (atts > 0 ? 'anexo sem texto' : '')}
          </button>
        )}
        <QueuedItemActions
          editing={editing} first={first} last={last} nowBlocked={nowBlocked} bgOpen={bgOpen} bgId={bgId} extended={!touch || more}
          onCommit={onCommit} onCancelEdit={onCancelEdit} onStartEdit={onStartEdit} onRunNow={onRunNow} onToggleBg={onToggleBg} onMove={onMove} onRemove={onRemove}
        />
      </div>
      {bgOpen && !editing && (
        <QueuedBgLauncher id={bgId} model={bgModel} models={models} onRun={onRunBg} onCancel={onToggleBg} />
      )}
    </li>
  );
}
