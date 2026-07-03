import { useState, useEffect, useRef, useMemo } from 'react';
import { usePersisted } from '../../lib/persist';
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
  paused?: boolean;
  onSend: (text: string, modeOverride?: PermMode, force?: 'priority') => void;
}

export function useChatPanel({ session, messages, phase, models, model, lastEnd, paused = false, onSend }: Args) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const flushingRef = useRef(false);
  const [atBottom, setAtBottom] = useState(true);
  const [promptAbove, setPromptAbove] = useState(false);
  const [queuedMap, setQueuedMap] = usePersisted<Record<string, string[]>>('queued', {});
  const [fullLoaded, setFullLoaded] = useState(false);
  const sid = session?.id ?? null;
  // Fila POR SESSÃO e persistida em localStorage: "manda quando ESTA sessão
  // liberar". Sair da sessão ou fechar o site NÃO pode perder o que foi digitado;
  // só trocamos qual fila está ativa. flushingRef reseta na troca pra não travar a
  // próxima sessão com a trava herdada da anterior.
  const queued = useMemo(() => (sid ? queuedMap[sid] ?? [] : []), [queuedMap, sid]);
  useEffect(() => { setFullLoaded(false); flushingRef.current = false; pinnedRef.current = true; setAtBottom(true); }, [sid]);

  const setQueuedFor = (updater: (q: string[]) => string[]) => {
    if (!sid) return;
    setQueuedMap((m) => {
      const next = updater(m[sid] ?? []);
      if (next.length === 0) { const { [sid]: _drop, ...rest } = m; return rest; }
      return { ...m, [sid]: next };
    });
  };
  const enqueue = (text: string) => setQueuedFor((q) => [...q, text]);
  const clearQueue = () => setQueuedFor(() => []);
  const cancelQueueAt = (i: number) => setQueuedFor((q) => q.filter((_, idx) => idx !== i));
  // "Corrigir agora": tira da fila local e MANDA JÁ com force='priority' — o servidor
  // interrompe o turno em andamento e retoma com esta correção (pula o triador). É a
  // válvula pro caso aba-única, em que a fila do cliente nunca chega ao triador.
  const prioritizeAt = (i: number) => {
    const text = queued[i];
    if (text == null) return;
    setQueuedFor((q) => q.filter((_, idx) => idx !== i));
    onSend(text, undefined, 'priority');
  };
  // Reordenar: -1 sobe, +1 desce. A fila drena sempre do topo, então a ordem aqui
  // é a ordem de envio.
  const moveQueuedItem = (i: number, dir: -1 | 1) => setQueuedFor((q) => {
    const j = i + dir;
    if (j < 0 || j >= q.length) return q;
    const copy = [...q];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });

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

  // AskUserQuestion encerra o turno (kill no backend) e devolve phase pra idle — o
  // mesmo idle que drena a fila. Sem esta trava o flush mandava a próxima mensagem
  // e roubava o card de escolha (sumia o "Enviar resposta") antes de o usuário
  // responder. Segura a fila enquanto a pergunta for a última mensagem; responder
  // cria um novo turno e a retomada corre de carona no ciclo de fase seguinte.
  const pendingQuestion = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.blocks.some(
      (b) => b.type === 'tool' && b.tool.name === 'AskUserQuestion' && (b.tool.questions?.length ?? 0) > 0,
    );
  })();

  // Fila stop-aware: mensagens digitadas durante o turno disparam sozinhas no
  // idle, UMA por vez e em ordem. flushingRef trava o re-disparo: setQueued(rest)
  // re-roda o efeito ainda com phase==='idle' (a prop só vira 'thinking' quando o
  // servidor emite 'started'); sem a trava, a fila inteira sairia de uma vez. O
  // ref reseta quando o turno começa, liberando o próximo no idle seguinte.
  useEffect(() => {
    if (!sid) return;
    // Teto do plano atingido: NÃO drena a fila (senão dispara tudo e falha sem
    // resposta). Quando a janela reseta, `paused` cai e o flush retoma sozinho.
    if (paused) return;
    // Pergunta de escolha aguardando resposta: segura a fila pra não roubar o card.
    if (pendingQuestion) return;
    if (phase !== 'idle') { flushingRef.current = false; return; }
    if (flushingRef.current || queued.length === 0) return;
    flushingRef.current = true;
    const [next, ...rest] = queued;
    setQueuedFor(() => rest);
    onSend(next);
  }, [phase, queued, onSend, sid, paused]);

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
    let raf = 0;
    if (el && pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
      // Code block/imagem que expande após o paint deixava o scroll um pouco
      // acima do fim — repete no próximo frame com a altura final.
      raf = requestAnimationFrame(() => { if (scrollRef.current && pinnedRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
    }
    recompute();
    return () => { if (raf) cancelAnimationFrame(raf); };
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
    queued, enqueue, clearQueue, cancelQueueAt, prioritizeAt, moveQueuedItem, fullLoaded, setFullLoaded,
    streaming, disabled, isEmpty,
    sentHistory, modelLabel, labelFor,
    planPending, pendingQuestion, failed, retryLast, bannerConfirm,
  };
}
