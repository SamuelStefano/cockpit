import { Icon } from '../primitives';
import { ChatInputToolbar } from './ChatInputToolbar';
import { ComposerNotice } from './ComposerNotice';
import { ComposerActions } from './ComposerActions';
import { ComposerGhost } from './ComposerGhost';
import { ComposerTools } from './ComposerTools';
import { ComposerSettingsSheet } from './ComposerSettingsSheet';
import { AttachmentChips } from './AttachmentChips';
import { QueuedBanner } from './QueuedBanner';
import { SlashPalette } from './SlashPalette';
import type { PermMode, Effort, ModelInfo, Caps, SkillMeta } from '../../../shared/protocol';
import type { Attachment } from '../../useCockpit';
import { useChatInput } from './useChatInput';
import { composerMaxH } from './fit-height';

export { ChatEmpty } from './ChatEmpty';

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
  onToggleQueuePause?: () => void;
  paused?: boolean;
  quotaResetsAt?: number | null;
  history: string[];
  pendingConfirm?: () => void;
  onNew: () => void;
  onShowHelp?: () => void;
  keyboardOpen?: boolean;
}

export function ChatInput(props: ChatInputProps) {
  const { disabled, onStop, value, setValue, mode, setMode, caps, bypass, setBypass, model, setModel, models, onRefreshModels, effort, setEffort, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, attachments, onRemoveAttachment, queued, queuedAtts, queuedModels, onRunQueuedBg, onRunQueuedNow, onCancelQueueAt, onEditQueuedAt, onMoveQueued, queueHeld = false, onResumeQueue, queuePaused = false, onToggleQueuePause, paused = false, quotaResetsAt, keyboardOpen = false } = props;
  const hasAtt = attachments.length > 0;
  const attUploading = attachments.some((a) => a.uploading);
  const resetLabel = quotaResetsAt ? new Date(quotaResetsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const { taRef, fileRef, cameraRef, sel, setSel, showPalette, matches, complete, submit, onKey, grow, pick, dragging, onDragEnter, onDragOver, onDragLeave, onDrop, onPaste, mic, ghost, ghostShown, acceptGhost, touch, settingsOpen, openSettings, closeSettings } = useChatInput({ ...props, hasAtt, attUploading });
  const settings = { caps, bypass, setBypass, skills, selectedSkills, setSelectedSkills, mcpServers, selectedMcps, setSelectedMcps, model, setModel, models, onRefreshModels, effort, setEffort };
  // Com o teclado aberto o thread cabe em ~150px: a barra sai de cena e os ajustes
  // passam a morar nos sliders do ComposerTools. Exige `touch` porque o sheet só
  // existe abaixo de `sm` — janela de desktop baixa dispara o keyboardOpen e ficaria
  // sem barra E sem sheet.
  const compact = keyboardOpen && touch;
  return (
    <div className="shrink-0 border-t border-neutral-800 bg-neutral-900/60 px-3 py-3 backdrop-blur-sm">
      {!compact && <ChatInputToolbar mode={mode} setMode={setMode} onOpenSettings={openSettings} {...settings} />}
      {settingsOpen && <ComposerSettingsSheet onClose={closeSettings} {...settings} />}
      {hasAtt &&<AttachmentChips attachments={attachments} onRemoveAttachment={onRemoveAttachment} />}
      {mic.error && <ComposerNotice icon="mic" onDismiss={mic.dismissError}>{mic.error}</ComposerNotice>}
      {queued.length > 0 && <QueuedBanner queued={queued} queuedAtts={queuedAtts} queuedModels={queuedModels} models={models} onRunBg={onRunQueuedBg} onRunNow={onRunQueuedNow} onCancelQueueAt={onCancelQueueAt} onEdit={onEditQueuedAt} onMove={onMoveQueued} held={queueHeld} onResume={onResumeQueue} paused={queuePaused} onTogglePause={onToggleQueuePause} quotaHeld={paused} resetLabel={resetLabel} />}
      {paused && (
        <ComposerNotice icon="clock">
          Tokens do plano esgotados — chat pausado{resetLabel ? ` até ${resetLabel}` : ''}. Nada é perdido: a fila retoma sozinha quando a janela resetar.
        </ComposerNotice>
      )}
      <input ref={fileRef} type="file" multiple onChange={pick} className="hidden" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />
      <div className="relative" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {dragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-orange-500/60 bg-neutral-950/85 text-[13px] font-medium text-orange-300 backdrop-blur-xs">
          <Icon name="paperclip" size={15} /> Solte os arquivos pra anexar
        </div>
      )}
      {showPalette && <SlashPalette matches={matches} sel={sel} setSel={setSel} complete={complete} />}
      <div className="elev-1 flex items-end gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 transition focus-within:border-orange-500/50 focus-within:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_3px_rgba(249,115,22,0.08),0_6px_20px_-6px_rgba(0,0,0,0.6)]">
        <ComposerTools
          touch={touch} compact={compact} mic={mic}
          onAttach={() => fileRef.current?.click()}
          onPhoto={() => cameraRef.current?.click()}
          onOpenSettings={openSettings}
        />
        <div className="relative min-w-0 flex-1">
          {ghost && <ComposerGhost value={value} ghostShown={ghostShown} acceptGhost={acceptGhost} />}
          <textarea
            ref={taRef}
            rows={1}
            aria-label="Escrever mensagem"
            value={value}
            onChange={grow}
            onKeyDown={onKey}
            onPaste={onPaste}
            readOnly={mic.listening}
            enterKeyHint={touch ? 'enter' : 'send'}
            // A 390px o placeholder longo quebrava em 2 linhas e o composer vazio
            // já nascia com o dobro da altura.
            placeholder={paused ? 'Tokens esgotados — digite p/ enfileirar (envia ao resetar)…' : mic.listening ? 'Ouvindo… fale agora' : disabled ? 'Próxima mensagem (envia ao terminar)…' : touch ? 'Mensagem…' : 'Pergunte ou peça um comando…  (↵ envia, ⇧↵ quebra linha)'}
            style={{ maxHeight: composerMaxH() }}
            className="scroll-thin relative w-full resize-none bg-transparent py-1 text-[15px] leading-7 text-neutral-100 placeholder-neutral-600 outline-hidden"
          />
        </div>
        <ComposerActions
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
  );
}
