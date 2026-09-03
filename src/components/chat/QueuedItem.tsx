import { useEffect, useRef } from 'react';
import type { ModelInfo } from '../../../shared/protocol';
import { Icon, tokens } from '../primitives';
import { QueuedBgLauncher } from './QueuedBgLauncher';

// Seis ações lado a lado: no dedo a caixa real vira 40px (`touchBox`) e a barra
// desce pra própria linha — as seis não cabem ao lado do texto em 390px, e a
// área invisível do `touchTarget` roubaria o toque do botão vizinho.
const iconBtn = `flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-30 ${tokens.focusRing} ${tokens.touchBox}`;

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
  const bgId = `fila-bg-${index}`;
  useEffect(() => { if (editing) taRef.current?.focus(); }, [editing]);
  return (
    <li className={`rounded-md transition-colors duration-500 ${flash ? 'bg-orange-500/20' : ''}`}>
      <div className="flex items-start gap-1 pointer-coarse:flex-wrap">
        <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-orange-400/50">{index + 1}.</span>
        {atts > 0 && (
          <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-orange-300/80" title={`${atts} anexo${atts > 1 ? 's' : ''} amarrado${atts > 1 ? 's' : ''} a este prompt`}>
            <Icon name="paperclip" size={10} />{atts > 1 ? atts : ''}
          </span>
        )}
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onCancelEdit(); }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCommit(); }
            }}
            className={`flex-1 resize-none rounded-sm border border-orange-500/40 bg-neutral-900 px-1.5 py-1 text-[11.5px] leading-snug text-neutral-200 ${tokens.focusRing}`}
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            title={expanded ? 'Recolher' : 'Ver completo'}
            className={`flex-1 rounded-sm text-left text-[11.5px] leading-snug ${tokens.focusRing} ${text ? 'text-neutral-300' : 'italic text-neutral-500'} ${expanded ? 'whitespace-pre-wrap wrap-break-word' : 'truncate'}`}
          >
            {text || (atts > 0 ? 'anexo sem texto' : '')}
          </button>
        )}
        <div className="flex shrink-0 items-center pointer-coarse:w-full pointer-coarse:justify-end">
          {editing ? (
            <>
              <button type="button" onClick={onCommit} title="Salvar (Enter)" className={iconBtn}>
                <Icon name="check" size={12} />
              </button>
              <button type="button" onClick={onCancelEdit} title="Descartar a edição (Esc)" className={iconBtn}>
                <Icon name="x" size={12} />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onStartEdit} title="Editar esta mensagem na fila" className={iconBtn}>
                <Icon name="pencil" size={12} />
              </button>
              <button type="button" onClick={onRunNow} disabled={nowBlocked} title="Rodar agora neste chat, interrompendo o turno em andamento" className={iconBtn}>
                <Icon name="play" size={11} />
              </button>
              <button type="button" onClick={onToggleBg} aria-expanded={bgOpen} aria-controls={bgId} title="Rodar agora em paralelo, com o contexto deste chat" className={`${iconBtn} ${bgOpen ? 'text-orange-300' : ''}`}>
                <Icon name="zap" size={12} />
              </button>
              <button type="button" onClick={() => onMove(-1)} disabled={first} title="Subir na fila" className={iconBtn}>
                <Icon name="chevronUp" size={12} />
              </button>
              <button type="button" onClick={() => onMove(1)} disabled={last} title="Descer na fila" className={iconBtn}>
                <Icon name="chevronDown" size={12} />
              </button>
              <button type="button" onClick={onRemove} title="Cancelar esta mensagem na fila" className={iconBtn}>
                <Icon name="x" size={12} />
              </button>
            </>
          )}
        </div>
      </div>
      {bgOpen && !editing && (
        <QueuedBgLauncher id={bgId} model={bgModel} models={models} onRun={onRunBg} onCancel={onToggleBg} />
      )}
    </li>
  );
}
