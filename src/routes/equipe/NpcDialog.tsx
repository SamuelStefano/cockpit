import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { TeamBot } from '../../../shared/protocol';
import type { TalkState } from './world/talk-state';
import { useTypewriter } from './world/typewriter';

interface NpcDialogProps {
  bot: TeamBot;
  talk: TalkState;
  recording: boolean;
  following: boolean;
  side: 'top' | 'bottom';
  onSend: (text: string) => void;
  onOpenPc: () => void;
  onFollow: () => void;
  onClose: () => void;
}

const STATE_LABEL: Record<string, { text: string; dot: string }> = {
  working: { text: 'Trabalhando', dot: '#3fd17f' },
  waiting: { text: 'Esperando você', dot: '#ffd166' },
  idle: { text: 'Livre', dot: '#9a948c' },
  'no-session': { text: 'Sem sessão', dot: '#5c5750' },
};

const BASE = import.meta.env.BASE_URL;
const FRAME_URL = `${BASE}world/v2/ui/dialog-frame.png`;
const PIXEL: CSSProperties = { fontFamily: 'KenneyMini, monospace', imageRendering: 'pixelated' };
const SCALE = 2;

const fallbackFrame: CSSProperties = {
  background: '#14110f',
  boxShadow: '0 0 0 2px #14110f, 0 0 0 4px #e8e2d6, 0 0 0 6px #14110f',
};

function useAsset(url: string): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(false);
    const i = new Image();
    i.onload = () => setOk(true);
    i.src = url;
  }, [url]);
  return ok;
}

function Portrait({ bot }: { bot: TeamBot }) {
  const url = `${BASE}world/v2/bots/${bot.sprite ?? bot.id}.png`;
  const ok = useAsset(url);
  const box: CSSProperties = { width: 32 * SCALE, height: 48 * SCALE, flexShrink: 0 };
  if (!ok) return <div aria-hidden style={{ ...box, ...PIXEL, background: bot.mascot.color, color: '#14110f' }} className="grid place-items-center text-2xl">{bot.name.slice(0, 1).toUpperCase()}</div>;
  return <div aria-hidden data-portrait style={{ ...box, imageRendering: 'pixelated', backgroundImage: `url(${url})`, backgroundSize: `${256 * SCALE}px ${1536 * SCALE}px`, backgroundPosition: `0 -${48 * SCALE}px` }} />;
}

const btn = 'border-2 px-3 py-1 text-[11px] uppercase tracking-wide pointer-coarse:min-h-11 pointer-coarse:px-4 disabled:cursor-not-allowed disabled:opacity-40';
const btnOff = 'border-[#e8e2d6]/60 bg-[#14110f] text-[#e8e2d6] hover:bg-[#2a2420]';
const btnOn = 'border-[#3fd17f] bg-[#16301f] text-[#a8f0b8] hover:bg-[#1d3d28]';

export function NpcDialog({ bot, talk, recording, following, side, onSend, onOpenPc, onFollow, onClose }: NpcDialogProps) {
  const [chatting, setChatting] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useAsset(FRAME_URL);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const snap = talk.botId === bot.id ? talk.snapshot : null;
  const state = STATE_LABEL[snap?.state ?? 'idle'] ?? STATE_LABEL.idle!;
  const task = snap && !snap.redacted && !recording ? snap.task : undefined;
  const canChat = !recording && snap?.state !== 'no-session';
  const { shown, typing } = useTypewriter(recording ? '' : talk.reply, reduced);
  const waiting = talk.sending || typing;

  useEffect(() => { if (chatting) input.current?.focus(); }, [chatting]);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, talk.notice, talk.sending]);
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

  const skin: CSSProperties = frame
    ? { borderStyle: 'solid', borderWidth: 24, borderImage: `url(${FRAME_URL}) 8 fill / 24px / 0 stretch`, imageRendering: 'pixelated' }
    : { ...fallbackFrame, padding: 14 };
  const pos = side === 'top' ? 'top-3 max-sm:top-auto max-sm:bottom-2' : 'bottom-3 max-sm:bottom-2';

  return (
    <div role="dialog" aria-label={`Conversa com ${bot.name}`} data-npc-dialog={bot.id} data-side={side} style={{ ...PIXEL, ...skin, maxHeight: 'min(70%, 22rem)' }} className={`absolute inset-x-3 z-10 mx-auto flex max-w-2xl flex-col gap-2 overflow-hidden text-[#e8e2d6] ${pos}`}>
      <div ref={scroller} data-npc-scroll className="scroll-thin flex min-h-0 flex-1 items-start gap-3 overflow-y-auto">
        <Portrait bot={bot} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3">
            <span className="truncate text-base text-white">{bot.name}</span>
            <span className="flex items-center gap-1.5 text-[11px]"><span style={{ width: 8, height: 8, background: state.dot, display: 'inline-block' }} />{state.text}</span>
          </div>
          {bot.label && <p className="truncate text-[11px] text-[#a8f0b8]">{bot.label}</p>}
          {task && <p data-npc-task style={{ fontFamily: 'inherit' }} className="mt-1 line-clamp-2 font-sans text-xs normal-case text-[#e8e2d6]"><span style={PIXEL} className="text-[#ffd166]">Tarefa: </span><span style={{ fontFamily: 'system-ui, sans-serif' }}>{task}</span></p>}
          {snap?.redacted && <p className="mt-1 text-[10px] text-[#9a948c]">{snap.openPrs} PRs abertas · {snap.mergedPrs} mergeadas · {snap.needs} pendências</p>}
          {(talk.reply || talk.sending || talk.notice) && !recording && (
            <div data-npc-reply style={{ fontFamily: 'system-ui, sans-serif' }} className="mt-2 whitespace-pre-wrap text-xs leading-snug">
              {shown || (talk.sending ? '…' : '')}
              {waiting && <span data-npc-caret aria-hidden className="ml-1 inline-block animate-pulse text-[#3fd17f]">▼</span>}
              {talk.notice && <span className="block text-[#ffd166]">{talk.notice}</span>}
            </div>
          )}
        </div>
        <button type="button" aria-label="Fechar" className="sticky top-0 shrink-0 self-start px-1 text-[#9a948c] hover:text-white" onClick={onClose}>×</button>
      </div>
      {chatting && canChat && (
        <form className="flex shrink-0 gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <textarea ref={input} value={text} rows={1} maxLength={4000} placeholder={`Diga algo para ${bot.name}`} style={{ fontFamily: 'system-ui, sans-serif' }} className="min-h-8 flex-1 resize-none border-2 border-[#e8e2d6]/40 bg-black/50 px-2 py-1 text-xs text-white placeholder:text-neutral-500 focus:border-[#3fd17f] focus:outline-none" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
          <button type="submit" className={`${btn} ${btnOn}`} disabled={!text.trim() || talk.sending}>Enviar</button>
        </form>
      )}
      <div data-npc-actions className="flex shrink-0 flex-wrap gap-2">
        <button type="button" className={`${btn} ${chatting ? btnOn : btnOff}`} aria-pressed={chatting} disabled={!canChat} title={recording ? 'Indisponível na gravação' : undefined} onClick={() => setChatting((v) => !v)}>Conversar</button>
        <button type="button" className={`${btn} ${btnOff}`} onClick={onOpenPc}>Ver o PC</button>
        <button type="button" className={`${btn} ${following ? btnOn : btnOff}`} aria-pressed={following} onClick={onFollow}>{following ? 'Seguindo' : 'Seguir'}</button>
      </div>
    </div>
  );
}
