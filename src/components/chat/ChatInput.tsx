import { Icon } from '../primitives';
import { ChatInputToolbar } from './ChatInputToolbar';
import { AttachmentChips } from './AttachmentChips';
import { QueuedBanner } from './QueuedBanner';
import { SlashPalette } from './SlashPalette';
import type { PermMode, ModelInfo, Caps, SkillMeta } from '../../../shared/protocol';
import type { Attachment } from '../../useCockpit';
import { useChatInput } from './useChatInput';
import { MicButton } from './MicButton';

export { ChatEmpty } from './ChatEmpty';
export { classifySlash, type SlashAction } from './slash';

interface ChatInputProps {
  disabled: boolean;
  onSend: (text: string, modeOverride?: PermMode) => void;
  onStop: () => void;
  value: string;
  setValue: (v: string) => void;
  mode: PermMode;
  setMode: (m: PermMode) => void;
  caps: Caps | null;
  bypass: boolean;
  setBypass: (b: boolean) => void;
  model: string;
  setModel: (m: string) => void;
  models: ModelInfo[];
  onRefreshModels: () => void;
  skills: SkillMeta[];
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  slashCommands: string[];
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  focusSignal: number;
  queued: string[];
  onQueue: (text: string) => void;
  onCancelQueueAt: (i: number) => void;
  onMoveQueued: (i: number, dir: -1 | 1) => void;
  paused?: boolean;
  quotaResetsAt?: number | null;
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
  onShowHelp?: () => void;
}

export function ChatInput(props: ChatInputProps) {
  const { disabled, onStop, value, setValue, mode, setMode, caps, bypass, setBypass, model, setModel, models, onRefreshModels, skills, selectedSkills, setSelectedSkills, attachments, onRemoveAttachment, queued, onCancelQueueAt, onMoveQueued, paused = false, quotaResetsAt } = props;
  const hasAtt = attachments.length > 0;
  const resetLabel = quotaResetsAt ? new Date(quotaResetsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const { taRef, fileRef, sel, setSel, showPalette, matches, complete, submit, onKey, grow, pick, dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste, mic, ghost } = useChatInput({ ...props, hasAtt });
  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 py-3 backdrop-blur">
      <ChatInputToolbar
        mode={mode} setMode={setMode} disabled={disabled} caps={caps}
        bypass={bypass} setBypass={setBypass} skills={skills}
        selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills}
        model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels}
      />
      {hasAtt && <AttachmentChips attachments={attachments} onRemoveAttachment={onRemoveAttachment} />}
      {queued.length > 0 && <QueuedBanner queued={queued} onCancelQueueAt={onCancelQueueAt} onMove={onMoveQueued} />}
      {paused && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-2.5 py-2 text-[12px] leading-snug text-red-200">
          <Icon name="clock" size={13} className="mt-0.5 shrink-0 text-red-400" />
          <span>Tokens do plano esgotados — chat pausado{resetLabel ? ` até ${resetLabel}` : ''}. Nada é perdido: a fila retoma sozinha quando a janela resetar.</span>
        </div>
      )}
      <input ref={fileRef} type="file" multiple onChange={pick} className="hidden" />
      <div className="relative" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {dragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-500/60 bg-neutral-950/85 text-[13px] font-medium text-orange-300 backdrop-blur-sm">
          <Icon name="paperclip" size={15} /> Solte os arquivos pra anexar
        </div>
      )}
      {showPalette && <SlashPalette matches={matches} sel={sel} setSel={setSel} complete={complete} />}
      <div className="flex items-end gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 transition focus-within:border-orange-500/50">
        <button
          onClick={() => fileRef.current?.click()}
          title="Anexar arquivo — ou arraste e solte / cole (Ctrl+V). Vai junto no próximo envio."
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
        >
          <Icon name="paperclip" size={15} />
        </button>
        <MicButton mic={mic} />
        <div className="relative min-w-0 flex-1">
          {ghost && (
            <div aria-hidden className="pointer-events-none absolute inset-0 max-h-[140px] overflow-hidden whitespace-pre-wrap break-words py-1 text-[14px] leading-relaxed text-neutral-600">
              <span className="invisible">{value}</span>{ghost}<span className="ml-1 rounded border border-neutral-700 px-1 text-[9px] align-middle text-neutral-500">Tab</span>
            </div>
          )}
          <textarea
            ref={taRef}
            rows={1}
            value={value}
            onChange={grow}
            onKeyDown={onKey}
            onPaste={onPaste}
            readOnly={mic.listening}
            placeholder={paused ? 'Tokens esgotados — digite p/ enfileirar (envia ao resetar)…' : mic.listening ? 'Ouvindo… fale agora' : disabled ? 'Próxima mensagem (envia ao terminar)…' : 'Pergunte ou peça um comando…  (↵ envia, ⇧↵ quebra linha)'}
            className="scroll-thin relative max-h-[140px] w-full resize-none bg-transparent py-1 text-[14px] leading-relaxed text-neutral-100 placeholder-neutral-600 outline-none"
          />
        </div>
        {disabled ? (
          <button
            type="button"
            onClick={onStop}
            title="Interromper resposta"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-200 transition hover:bg-red-500/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Icon name="square" size={13} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={paused ? !value.trim() : (!value.trim() && !hasAtt)}
            title={paused ? 'Enfileirar — envia sozinho quando os tokens resetarem' : undefined}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
              ${paused
                ? (value.trim() ? 'bg-amber-500/80 text-neutral-950 hover:bg-amber-400' : 'bg-neutral-800 text-neutral-600')
                : (value.trim() || hasAtt) ? 'bg-orange-500 text-neutral-950 hover:bg-orange-400' : 'bg-neutral-800 text-neutral-600'}`}
          >
            <Icon name={paused ? 'clock' : 'arrowUp'} size={paused ? 14 : 16} />
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
