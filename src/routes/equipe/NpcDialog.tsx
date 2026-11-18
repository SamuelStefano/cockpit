import { useEffect, useRef, useState } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import type { TalkState } from './world/talk-state';

interface NpcDialogProps {
  bot: TeamBot;
  talk: TalkState;
  recording: boolean;
  following: boolean;
  onSend: (text: string) => void;
  onOpenPc: () => void;
  onFollow: () => void;
  onClose: () => void;
}

const STATE_LABEL: Record<string, { text: string; dot: string }> = {
  working: { text: 'Trabalhando', dot: 'bg-emerald-400' },
  waiting: { text: 'Esperando você', dot: 'bg-amber-400' },
  idle: { text: 'Livre', dot: 'bg-neutral-400' },
  'no-session': { text: 'Sem sessão', dot: 'bg-neutral-600' },
};

const btn = 'rounded-md border px-3 py-1.5 text-xs font-medium pointer-coarse:min-h-11 pointer-coarse:px-4 disabled:cursor-not-allowed disabled:opacity-40';
const btnOff = 'border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10';
const btnOn = 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30';

export function NpcDialog({ bot, talk, recording, following, onSend, onOpenPc, onFollow, onClose }: NpcDialogProps) {
  const [chatting, setChatting] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const snap = talk.botId === bot.id ? talk.snapshot : null;
  const state = STATE_LABEL[snap?.state ?? 'idle'] ?? STATE_LABEL.idle!;
  const task = snap && !snap.redacted && !recording ? snap.task : undefined;
  const canChat = !recording && snap?.state !== 'no-session';

  useEffect(() => { if (chatting) input.current?.focus(); }, [chatting]);
  useEffect(() => { if (recording) setChatting(false); }, [recording]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    const t = text.trim();
    if (!t || talk.sending || !canChat) return;
    onSend(t);
    setText('');
  };

  return (
    <div role="dialog" aria-label={`Conversa com ${bot.name}`} data-npc-dialog={bot.id} className="absolute inset-x-2 bottom-2 z-10 mx-auto max-w-xl rounded-xl border border-white/15 bg-neutral-950/92 p-3 text-neutral-100 shadow-xl backdrop-blur sm:bottom-4">
      <div className="flex items-start gap-3">
        <div aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border-2 border-white/20 text-xl font-bold text-neutral-950" style={{ backgroundColor: bot.mascot.color }}>{bot.name.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{bot.name}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-neutral-300"><span className={`h-2 w-2 rounded-full ${state.dot}`} />{state.text}</span>
          </div>
          {bot.label && <p className="truncate text-xs text-neutral-400">{bot.label}</p>}
          {task && <p data-npc-task className="mt-1 line-clamp-2 text-xs text-neutral-200">{task}</p>}
          {snap?.redacted && <p className="mt-1 text-[11px] text-neutral-500">{snap.openPrs} PRs abertas · {snap.mergedPrs} mergeadas · {snap.needs} pendências</p>}
        </div>
        <button type="button" aria-label="Fechar" className="h-7 w-7 rounded-full text-neutral-400 hover:bg-white/10 hover:text-white" onClick={onClose}>×</button>
      </div>
      {(talk.reply || talk.sending || talk.notice) && !recording && (
        <div data-npc-reply className="scroll-thin mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white/5 p-2 text-xs text-neutral-100">
          {talk.reply || (talk.sending ? 'Pensando...' : '')}
          {talk.notice && <span className="block text-amber-300">{talk.notice}</span>}
        </div>
      )}
      {chatting && canChat && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <textarea ref={input} value={text} rows={1} maxLength={4000} placeholder={`Diga algo para ${bot.name}`} className="min-h-8 flex-1 resize-none rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:border-emerald-400/50 focus:outline-none" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          <button type="submit" className={`${btn} ${btnOn}`} disabled={!text.trim() || talk.sending}>Enviar</button>
        </form>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button type="button" className={`${btn} ${chatting ? btnOn : btnOff}`} aria-pressed={chatting} disabled={!canChat} title={recording ? 'Indisponível na gravação' : undefined} onClick={() => setChatting((v) => !v)}>Conversar</button>
        <button type="button" className={`${btn} ${btnOff}`} onClick={onOpenPc}>Ver o PC</button>
        <button type="button" className={`${btn} ${following ? btnOn : btnOff}`} aria-pressed={following} onClick={onFollow}>{following ? 'Seguindo' : 'Seguir'}</button>
      </div>
    </div>
  );
}
