import { Icon } from '../primitives';
import { ModeToggle, ModelPicker, BypassToggle } from './Toolbar';
import type { PermMode, ModelInfo, Caps, SkillMeta } from '../../../shared/protocol';
import type { Attachment } from '../../useCockpit';
import { useChatInput } from './useChatInput';
import { isLocalSlash, slashHint } from './slash';
import { MicButton } from './MicButton';
import { SkillPicker } from './SkillPicker';

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
  queued: string;
  onQueue: (text: string) => void;
  onCancelQueue: () => void;
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
  onShowHelp?: () => void;
}

export function ChatInput(props: ChatInputProps) {
  const { disabled, onStop, value, setValue, mode, setMode, caps, bypass, setBypass, model, setModel, models, skills, selectedSkills, setSelectedSkills, attachments, onRemoveAttachment, queued, onCancelQueue } = props;
  const hasAtt = attachments.length > 0;
  const { taRef, fileRef, sel, setSel, showPalette, matches, complete, submit, onKey, grow, pick, dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste, mic } = useChatInput({ ...props, hasAtt });
  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 py-3 backdrop-blur">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ModeToggle mode={mode} setMode={setMode} disabled={disabled} />
        {caps?.canBypass && (
          <BypassToggle on={bypass} setOn={setBypass} disabled={disabled} />
        )}
        {mode === 'auto' && (
          <span className="hidden items-center gap-1 text-[10.5px] text-amber-400/70 sm:flex">
            <Icon name="zap" size={11} /> edita sozinho, sem shell
          </span>
        )}
        {mode === 'acceptEdits' && (
          <span className="hidden items-center gap-1 text-[10.5px] text-orange-400/70 sm:flex">
            <Icon name="zap" size={11} /> executa de verdade
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <SkillPicker skills={skills} selected={selectedSkills} setSelected={setSelectedSkills} />
          <ModelPicker model={model} setModel={setModel} models={models} disabled={false} />
        </div>
      </div>
      {hasAtt && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span key={a.path} className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 py-1 pl-2 pr-1 text-[11px] text-neutral-300">
              <Icon name="paperclip" size={11} />
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button
                onClick={() => onRemoveAttachment(a.path)}
                title="Remover anexo"
                className="flex h-4 w-4 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-700 hover:text-neutral-200"
              >
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      {queued && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] px-2.5 py-1.5">
          <Icon name="clock" size={12} className="mt-0.5 shrink-0 text-orange-400/80" />
          <span className="flex-1 text-[11.5px] leading-snug text-neutral-300">
            <span className="font-medium text-orange-300/90">na fila</span> · {queued}
          </span>
          <button
            onClick={onCancelQueue}
            title="Cancelar mensagem na fila"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200"
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" multiple onChange={pick} className="hidden" />
      <div className="relative" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {dragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-500/60 bg-neutral-950/85 text-[13px] font-medium text-orange-300 backdrop-blur-sm">
          <Icon name="paperclip" size={15} /> Solte os arquivos pra anexar
        </div>
      )}
      {showPalette && (
        <div className="scroll-thin absolute bottom-full left-0 z-30 mb-2 max-h-60 w-full overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 py-1 shadow-xl shadow-black/50">
          {matches.map((c, i) => {
            const local = isLocalSlash(c);
            return (
              <button
                key={c}
                onMouseDown={(e) => { e.preventDefault(); complete(c); }}
                onMouseEnter={() => setSel(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${i === sel ? 'bg-orange-500/15' : ''}`}
              >
                <span className={`font-mono text-[12.5px] ${i === sel ? 'text-orange-200' : 'text-neutral-300'}`}>
                  <span className="text-neutral-600">/</span>{c}
                </span>
                {local && (
                  <span className="rounded bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-300/90">app</span>
                )}
                <span className="ml-auto truncate text-[10.5px] text-neutral-500">{slashHint(c)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 transition focus-within:border-orange-500/50">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Anexar arquivo — ou arraste e solte / cole (Ctrl+V)"
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
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
