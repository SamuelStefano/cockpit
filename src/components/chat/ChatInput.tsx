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
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
  onShowHelp?: () => void;
}

export function ChatInput(props: ChatInputProps) {
  const { disabled, onStop, value, setValue, mode, setMode, caps, bypass, setBypass, model, setModel, models, skills, selectedSkills, setSelectedSkills, attachments, onRemoveAttachment, queued, onCancelQueueAt } = props;
  const hasAtt = attachments.length > 0;
  const { taRef, fileRef, sel, setSel, showPalette, matches, complete, submit, onKey, grow, pick, dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste, mic } = useChatInput({ ...props, hasAtt });
  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 py-3 backdrop-blur">
      <ChatInputToolbar
        mode={mode} setMode={setMode} disabled={disabled} caps={caps}
        bypass={bypass} setBypass={setBypass} skills={skills}
        selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills}
        model={model} setModel={setModel} models={models}
      />
      {hasAtt && <AttachmentChips attachments={attachments} onRemoveAttachment={onRemoveAttachment} />}
      {queued.length > 0 && <QueuedBanner queued={queued} onCancelQueueAt={onCancelQueueAt} />}
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
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={grow}
          onKeyDown={onKey}
          onPaste={onPaste}
          readOnly={mic.listening}
          placeholder={mic.listening ? 'Ouvindo… fale agora' : disabled ? 'Próxima mensagem (envia ao terminar)…' : 'Pergunte ou peça um comando…  (↵ envia, ⇧↵ quebra linha)'}
          className="scroll-thin max-h-[140px] w-full resize-none bg-transparent py-1 text-[14px] leading-relaxed text-neutral-100 placeholder-neutral-600 outline-none"
        />
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
            disabled={!value.trim() && !hasAtt}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
              ${value.trim() || hasAtt
                ? 'bg-orange-500 text-neutral-950 hover:bg-orange-400'
                : 'bg-neutral-800 text-neutral-600'}`}
          >
            <Icon name="arrowUp" size={16} />
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
