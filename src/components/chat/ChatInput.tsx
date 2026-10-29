import { Icon } from '../primitives';
import { ComposerNotice } from './ComposerNotice';
import { ComposerActions } from './ComposerActions';
import { ComposerGhost } from './ComposerGhost';
import { GhostChip } from './GhostChip';
import { ComposerPlus } from './ComposerPlus';
import { ModelPicker } from './ModelPicker';
import { AttachmentChips } from './AttachmentChips';
import { QueuedBanner } from './QueuedBanner';
import { SlashPalette, SLASH_LIST_ID, slashOptionId } from './SlashPalette';
import type { PermMode, Effort, ModelInfo, Caps } from '../../../shared/protocol';
import type { Attachment } from '../../useCockpit';
import { useChatInput } from './useChatInput';
import { composerMaxH } from './fit-height';

export { ChatEmpty } from './ChatEmpty';

interface ChatInputProps {
  disabled: boolean;
  placeholder?: string;
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
  modelLocked?: string;
  models: ModelInfo[];
  onRefreshModels: () => void;
  effort: Effort;
  setEffort: (e: Effort) => void;
  mcpServers: string[];
  selectedMcps: string[];
  setSelectedMcps: (ids: string[]) => void;
  slashCommands: string[];
  attachments: Attachment[];
  onUpload: (file: File) => void;
  onRemoveAttachment: (path: string) => void;
  onOpenAttachment?: (path: string, name: string) => void;
  attThumbs?: Record<string, string>;
  onAttThumb?: (path: string) => void;
  focusSignal: number;
  queued: string[];
  queuedIds: string[];
  queuedAtts?: number[];
  queuedModels: string[];
  onRunQueuedBg: (i: number, model: string) => void;
  onRunQueuedNow: (i: number) => void;
  onQueue: (text: string) => void;
  onCancelQueueAt: (i: number) => void;
  onEditQueuedAt: (i: number, text: string) => void;
  onMoveQueued: (i: number, dir: -1 | 1) => void;
  queueHeld?: boolean;
  onResumeQueue?: () => void;
  queuePaused?: boolean;
  queueReleaseAt?: number;
  onToggleQueuePause?: () => void;
  paused?: boolean;
  quotaResetsAt?: number | null;
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
  onShowHelp?: () => void;
  onCall?: () => void;
}

export function ChatInput(props: ChatInputProps) {
  const { disabled, placeholder, onStop, value, setValue, mode, setMode, caps, bypass, setBypass, model, setModel, modelLocked, models, onRefreshModels, effort, setEffort, mcpServers, selectedMcps, setSelectedMcps, attachments, onRemoveAttachment, onOpenAttachment, attThumbs, onAttThumb, queued, queuedIds, queuedAtts, queuedModels, onRunQueuedBg, onRunQueuedNow, onCancelQueueAt, onEditQueuedAt, onMoveQueued, queueHeld = false, onResumeQueue, queuePaused = false, queueReleaseAt = 0, onToggleQueuePause, paused = false, quotaResetsAt, onCall } = props;
  const hasAtt = attachments.length > 0;
  const attUploading = attachments.some((a) => a.uploading);
  const resetLabel = quotaResetsAt ? new Date(quotaResetsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const { taRef, fileRef, cameraRef, sel, setSel, showPalette, matches, complete, submit, onKey, onCompositionEnd, grow, pick, dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste, mic, ghost, ghostShown, acceptGhost, touch, dismissPalette, hintSeen } = useChatInput({ ...props, hasAtt, attUploading });
  const settings = { mode, setMode, caps, bypass, setBypass, model, effort, setEffort, mcpServers, selectedMcps, setSelectedMcps };
  // `relative z-20` na casca: o header sticky do CodeBlock é z-10 no contexto
  // raiz e pintava POR CIMA dos popovers do composer (MCP/skills), cobrindo
  // itens da lista. O composer precisa de um contexto próprio acima dele.
  return (
    <div className="relative z-20 shrink-0 px-3 py-3">
      <div className="mx-auto w-full max-w-[760px]">
      {hasAtt && <AttachmentChips attachments={attachments} onRemoveAttachment={onRemoveAttachment} onOpen={onOpenAttachment} thumbs={attThumbs} onThumb={onAttThumb} />}
      {mic.error && <ComposerNotice icon="mic" onDismiss={mic.dismissError}>{mic.error}</ComposerNotice>}
      {mic.hint && <ComposerNotice icon="mic" tone="info" onDismiss={mic.dismissHint}>{mic.hint}</ComposerNotice>}
      {queued.length > 0 && <QueuedBanner queued={queued} queuedIds={queuedIds} queuedAtts={queuedAtts} queuedModels={queuedModels} models={models} onRunBg={onRunQueuedBg} onRunNow={onRunQueuedNow} onCancelQueueAt={onCancelQueueAt} onEdit={onEditQueuedAt} onMove={onMoveQueued} held={queueHeld} onResume={onResumeQueue} paused={queuePaused} releaseAt={queueReleaseAt} onTogglePause={onToggleQueuePause} quotaHeld={paused} resetLabel={resetLabel} />}
      {paused && (
        <ComposerNotice icon="clock">
          Tokens do plano esgotados — chat pausado{resetLabel ? ` até ${resetLabel}` : ''}. Nada é perdido: a fila retoma sozinha quando a janela resetar.
        </ComposerNotice>
      )}
      <input ref={fileRef} type="file" multiple onChange={pick} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />
      <div className="relative" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {dragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-orange-500/60 bg-neutral-950/85 text-[13px] font-medium text-orange-300 backdrop-blur-xs">
          <Icon name="paperclip" size={15} /> Solte os arquivos pra anexar
        </div>
      )}
      {touch && ghost && !showPalette && <GhostChip ghostShown={ghostShown} acceptGhost={acceptGhost} />}
      {showPalette && <SlashPalette matches={matches} sel={sel} setSel={setSel} complete={complete} onDismiss={touch ? dismissPalette : undefined} />}
      <div className="elev-1 flex flex-wrap items-end gap-1.5 rounded-[26px] pointer-coarse:pt-2.5 border border-neutral-700 bg-neutral-950 py-1.5 pl-1.5 pr-2 transition focus-within:border-[#3a3a42]">
        <ComposerPlus
          touch={touch} mic={mic} onCall={onCall} settings={settings}
          onAttach={() => fileRef.current?.click()}
          onPhoto={() => cameraRef.current?.click()}
        />
        <div className="relative min-w-0 flex-1 pointer-coarse:order-first pointer-coarse:basis-full pointer-coarse:px-2.5">
          {ghost && <ComposerGhost value={value} ghostShown={ghostShown} acceptGhost={acceptGhost} chip={!touch} />}
          <textarea
            ref={taRef}
            rows={1}
            aria-label="Escrever mensagem"
            aria-autocomplete="list"
            aria-controls={showPalette ? SLASH_LIST_ID : undefined}
            aria-activedescendant={showPalette && matches[sel] ? slashOptionId(sel) : undefined}
            value={value}
            onChange={grow}
            onKeyDown={onKey}
            onCompositionEnd={onCompositionEnd}
            onPaste={onPaste}
            readOnly={mic.listening}
            enterKeyHint={touch ? 'enter' : 'send'}
            placeholder={paused ? 'Enfileirar mensagem…' : mic.listening ? 'Ouvindo…' : placeholder ?? (touch && !hintSeen ? 'Mensagem · Enter quebra linha' : 'Mensagem')}
            style={{ maxHeight: composerMaxH() }}
            className="scroll-thin relative w-full resize-none bg-transparent py-1 text-[16px] leading-7 text-neutral-100 placeholder-neutral-600 outline-hidden"
          />
        </div>
        <div className="flex shrink-0 items-center pointer-coarse:ml-auto">
          <ModelPicker compact model={model} setModel={setModel} models={models} onRefreshModels={onRefreshModels} canManage={caps?.role === 'admin' || caps?.role === 'root'} locked={modelLocked} />
        </div>
        <ComposerActions
          mic={mic}
          busy={disabled}
          paused={paused}
          hasText={!!value.trim()}
          hasAtt={hasAtt}
          attUploading={attUploading}
          onSubmit={submit}
          onStop={onStop}
        />
      </div>
      </div>
      </div>
    </div>
  );
}
