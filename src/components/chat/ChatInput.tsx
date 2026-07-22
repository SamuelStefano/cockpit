import { Button, Icon, tokens } from '../primitives';
import { ChatInputToolbar } from './ChatInputToolbar';
import { AttachmentChips } from './AttachmentChips';
import { QueuedBanner } from './QueuedBanner';
import { SlashPalette } from './SlashPalette';
import type { PermMode, Effort, ModelInfo, Caps, SkillMeta } from '../../../shared/protocol';
import type { Attachment } from '../../useCockpit';
import { useChatInput } from './useChatInput';
import { composerMaxH } from './fit-height';
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
  effort: Effort;
  setEffort: (e: Effort) => void;
  skills: SkillMeta[];
  selectedSkills: string[];
  setSelectedSkills: (ids: string[]) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
  slashCommands: string[];
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  focusSignal: number;
  queued: string[];
  onQueue: (text: string) => void;
  onCancelQueueAt: (i: number) => void;
  onMoveQueued: (i: number, dir: -1 | 1) => void;
  queueHeld?: boolean;
  onResumeQueue?: () => void;
  paused?: boolean;
  quotaResetsAt?: number | null;
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
  onShowHelp?: () => void;
}

export function ChatInput(props: ChatInputProps) {
  const { disabled, onStop, value, setValue, mode, setMode, caps, bypass, setBypass, model, setModel, models, onRefreshModels, effort, setEffort, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, attachments, onRemoveAttachment, queued, onCancelQueueAt, onMoveQueued, queueHeld = false, onResumeQueue, paused = false, quotaResetsAt } = props;
  const hasAtt = attachments.length > 0;
  const attUploading = attachments.some((a) => a.uploading);
  const resetLabel = quotaResetsAt ? new Date(quotaResetsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const { taRef, fileRef, sel, setSel, showPalette, matches, complete, submit, onKey, grow, pick, dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste, mic, ghost, ghostShown, acceptGhost } = useChatInput({ ...props, hasAtt, attUploading });
  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 py-3 backdrop-blur">
      <ChatInputToolbar
        mode={mode} setMode={setMode} disabled={disabled} caps={caps}
        bypass={bypass} setBypass={setBypass} skills={skills}
        selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills}
        mcpServers={mcpServers} selectedMcps={selectedMcps} setSelectedMcps={setSelectedMcps}
        model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels}
        effort={effort} setEffort={setEffort}
      />
      {hasAtt && <AttachmentChips attachments={attachments} onRemoveAttachment={onRemoveAttachment} />}
      {mic.error && (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.07] px-2.5 py-2 text-[12px] leading-snug text-red-200">
          <Icon name="mic" size={13} className="mt-0.5 shrink-0 text-red-400" />
          <span className="flex-1">{mic.error}</span>
          <button
            type="button"
            onClick={mic.dismissError}
            aria-label="Dispensar aviso"
            title="Dispensar aviso"
            className={`shrink-0 rounded p-0.5 text-red-300/70 transition hover:bg-red-500/15 hover:text-red-200 ${tokens.focusRing}`}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      )}
      {queued.length > 0 && <QueuedBanner queued={queued} onCancelQueueAt={onCancelQueueAt} onMove={onMoveQueued} held={queueHeld} onResume={onResumeQueue} />}
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
      <div className="elev-1 flex items-end gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 transition focus-within:border-orange-500/50 focus-within:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_3px_rgba(249,115,22,0.08),0_6px_20px_-6px_rgba(0,0,0,0.6)]">
        <Button
          variant="ghost"
          square
          icon="paperclip"
          onClick={() => fileRef.current?.click()}
          title="Anexar arquivo — ou arraste e solte / cole (Ctrl+V). Vai junto no próximo envio."
          className="mb-0.5"
        />
        <MicButton mic={mic} />
        <div className="relative min-w-0 flex-1">
          {ghost && (
            <div style={{ maxHeight: composerMaxH() }} className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words py-1 text-[15px] leading-7 text-neutral-600">
              <span aria-hidden className="invisible">{value}</span><span aria-hidden>{ghostShown}</span>
              {/* z-10 + pointer-events-auto: o chip fica clicável MESMO sob o textarea
                  (que pinta por cima do overlay) — no mobile não existe Tab. */}
              <button
                type="button" tabIndex={-1} onClick={acceptGhost} aria-label={`Completar com: ${ghostShown}`}
                onPointerDown={(e) => e.preventDefault()}
                className="pointer-events-auto relative z-10 ml-1 rounded border border-neutral-700 px-1 text-[9px] align-middle text-neutral-500 transition before:absolute before:-inset-2 before:content-[''] hover:border-orange-500/40 hover:text-orange-200"
              >
                <span className="sm:hidden">tocar</span><span className="hidden sm:inline">Tab</span>
              </button>
            </div>
          )}
          <textarea
            ref={taRef}
            rows={1}
            aria-label="Escrever mensagem"
            value={value}
            onChange={grow}
            onKeyDown={onKey}
            onPaste={onPaste}
            readOnly={mic.listening}
            placeholder={paused ? 'Tokens esgotados — digite p/ enfileirar (envia ao resetar)…' : mic.listening ? 'Ouvindo… fale agora' : disabled ? 'Próxima mensagem (envia ao terminar)…' : 'Pergunte ou peça um comando…  (↵ envia, ⇧↵ quebra linha)'}
            style={{ maxHeight: composerMaxH() }}
            className="scroll-thin relative w-full resize-none bg-transparent py-1 text-[15px] leading-7 text-neutral-100 placeholder-neutral-600 outline-none"
          />
        </div>
        {disabled ? (
          <button
            type="button"
            onClick={() => onStop()}
            title="Interromper resposta"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-200 transition hover:bg-red-500/20 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <Icon name="square" size={13} />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={attUploading || (paused ? !value.trim() : (!value.trim() && !hasAtt))}
            title={attUploading ? 'Aguarde o anexo terminar de subir' : paused ? 'Enfileirar — envia sozinho quando os tokens resetarem' : undefined}
            className={`mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40
              ${attUploading
                ? 'bg-neutral-800 text-neutral-600'
                : paused
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
