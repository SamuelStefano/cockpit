import { useState, useEffect, useRef, useMemo } from 'react';
import { prettyModel } from './toolbar.format';
import type { Session, Message } from '../../data/mock';
import type { PermMode, ModelInfo } from '../../../shared/protocol';

export type Phase = 'idle' | 'thinking' | 'streaming';

interface Args {
  session: Session | null;
  messages: Message[];
  phase: Phase;
  models: ModelInfo[];
  model: string;
  lastEnd?: string;
  onSend: (text: string, modeOverride?: PermMode) => void;
}

export function useChatPanel({ session, messages, phase, models, model, lastEnd, onSend }: Args) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [promptAbove, setPromptAbove] = useState(false);
  const [queued, setQueued] = useState<string[]>([]);
  const [fullLoaded, setFullLoaded] = useState(false);
  // Troca de sessão zera o estado preso à anterior. A fila (queued) é "manda
  // quando ESTA sessão liberar"; sem limpar, ao trocar pra uma sessão idle o
  // efeito de flush dispararia o texto enfileirado na sessão ERRADA.
  useEffect(() => { setFullLoaded(false); setQueued([]); }, [session?.id]);

  const enqueue = (text: string) => setQueued((q) => [...q, text]);
  const clearQueue = () => setQueued([]);
  const cancelQueueAt = (i: number) => setQueued((q) => q.filter((_, idx) => idx !== i));

  const streaming = phase === 'streaming';
  const disabled = phase !== 'idle';
  const isEmpty = messages.length === 0;

  const sentHistory = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => m.text).filter(Boolean),
    [messages],
  );
  const modelLabel = useMemo(
    () => prettyModel(model, models.find((m) => m.id === model)?.displayName),
    [models, model],
  );
  // Rótulo POR bolha: usa o modelo carimbado naquele turno (done/JSONL) e cai
  // pro modelo atual da sessão só quando a bolha não tem modelo (sessão antiga).
  const labelFor = useMemo(
    () => (id?: string) => (id ? prettyModel(id, models.find((m) => m.id === id)?.displayName) : modelLabel),
    [models, modelLabel],
  );

  // Fila stop-aware: mensagens digitadas durante o turno disparam sozinhas no
  // idle, UMA por vez e em ordem. flushingRef trava o re-disparo: setQueued(rest)
  // re-roda o efeito ainda com phase==='idle' (a prop só vira 'thinking' quando o
  // servidor emite 'started'); sem a trava, a fila inteira sairia de uma vez. O
  // ref reseta quando o turno começa, liberando o próximo no idle seguinte.
  const flushingRef = useRef(false);
  useEffect(() => {
    if (phase !== 'idle') { flushingRef.current = false; return; }
    if (flushingRef.current || queued.length === 0) return;
    flushingRef.current = true;
    const [next, ...rest] = queued;
    setQueued(rest);
    onSend(next);
  }, [phase, queued, onSend]);

  // Id do prompt mais recente do usuário — alvo do botão "voltar ao meu prompt".
  const lastUserId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return messages[i].id;
    return null;
  }, [messages]);

  const lastPromptNode = () => {
    const el = scrollRef.current;
    if (!el || !lastUserId) return null;
    return el.querySelector<HTMLElement>(`[data-mid="${CSS.escape(lastUserId)}"]`);
  };

  // Recalcula as duas afordâncias de scroll a partir da geometria atual: se o fim
  // está à vista (pin) e se o prompt do usuário rolou pra cima da janela (mostra o
  // botão de voltar — vale tanto rolando pra baixo quanto preso no fim de uma
  // resposta longa).
  const recompute = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    pinnedRef.current = near;
    setAtBottom(near);
    const node = lastPromptNode();
    setPromptAbove(!!node && node.getBoundingClientRect().bottom < el.getBoundingClientRect().top + 4);
  };

  const onScroll = () => recompute();

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  };

  const scrollToLastPrompt = () => lastPromptNode()?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
    recompute();
  }, [messages, phase, lastUserId]);

  const planPending = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.blocks.some((b) => b.type === 'tool' && b.tool.name === 'ExitPlanMode');
  })();
  const failed = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.error === true;
  })();
  const retryLast = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') { onSend(m.text); return; }
    }
  };
  // Enter na composição vazia confirma o banner visível (aprovar plano / retomar
  // / reenviar) — a ação que o usuário quase sempre quer ali. Mesma precedência
  // da renderização: falha > plano > corte de teto.
  const bannerConfirm = failed
    ? retryLast
    : planPending
      ? () => onSend('Plano aprovado — prossiga com a implementação.', 'acceptEdits')
      : (phase === 'idle' && lastEnd)
        ? () => onSend('Continue de onde você parou e termine a tarefa.')
        : undefined;

  return {
    scrollRef, atBottom, promptAbove, onScroll, scrollToBottom, scrollToLastPrompt,
    queued, enqueue, clearQueue, cancelQueueAt, fullLoaded, setFullLoaded,
    streaming, disabled, isEmpty,
    sentHistory, modelLabel, labelFor,
    planPending, failed, retryLast, bannerConfirm,
  };
}
