import { useState, useEffect, useRef, useMemo } from 'react';
import { prettyModel } from './toolbar.format';
import type { Session, Message } from '../../data/mock';
import type { PermMode, ModelInfo, ParkedView } from '../../../shared/protocol';
import { parseAttachments } from '../../lib/parse-attachments';

export type Phase = 'idle' | 'thinking' | 'streaming';

interface Args {
  session: Session | null;
  messages: Message[];
  phase: Phase;
  models: ModelInfo[];
  model: string;
  lastEnd?: string;
  onSend: (text: string, modeOverride?: PermMode) => void;
  // Fila ESTACIONADA do servidor (parked.json): drena sozinha quando a quota libera,
  // mesmo com o browser fechado — o cliente só espelha e edita, não drena mais.
  queue: ParkedView[];
  queueAdd: (text: string) => void;
  queueRemove: (sessionKey: string, id: string) => void;
  queueMove: (sessionKey: string, id: string, dir: -1 | 1) => void;
  queueClear: (sessionKey: string) => void;
}

export function useChatPanel({ session, messages, phase, models, model, lastEnd, onSend, queue, queueAdd, queueRemove, queueMove, queueClear }: Args) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [atBottom, setAtBottom] = useState(true);
  const [promptAbove, setPromptAbove] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const sid = session?.id ?? null;
  // Fila desta sessão na ORDEM DO SERVIDOR (array em parked.json = ordem de envio;
  // o drainer sempre drena do topo). NÃO reordenar por `at`: o move troca posições
  // no array sem mexer no `at`, então ordenar por `at` desfazia o reordenamento.
  const parked = useMemo(
    () => (sid ? queue.filter((q) => q.sessionKey === sid) : []),
    [queue, sid],
  );
  // O prompt estacionado carrega os anexos como linhas `[anexo:]` (amarrados a ELE).
  // No banner mostramos só o corpo limpo + a contagem de anexos como badge.
  const queuedParsed = useMemo(() => parked.map((p) => parseAttachments(p.text)), [parked]);
  const queued = useMemo(() => queuedParsed.map((q) => q.body), [queuedParsed]);
  const queuedAtts = useMemo(() => queuedParsed.map((q) => q.attachments.length), [queuedParsed]);
  useEffect(() => { setFullLoaded(false); pinnedRef.current = true; setAtBottom(true); }, [sid]);

  const enqueue = (text: string) => queueAdd(text);
  const clearQueue = () => { if (sid) queueClear(sid); };
  const cancelQueueAt = (i: number) => { const it = parked[i]; if (it) queueRemove(it.sessionKey, it.id); };
  // Reordenar: -1 sobe, +1 desce.
  const moveQueuedItem = (i: number, dir: -1 | 1) => { const it = parked[i]; if (it) queueMove(it.sessionKey, it.id, dir); };

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

  // Pergunta de escolha (AskUserQuestion) como última mensagem: o drainer do servidor
  // já segura a fila enquanto o turno tiver pergunta pendente; aqui só sinalizamos ao
  // banner pra não oferecer retomada por cima do card de escolha.
  const pendingQuestion = phase === 'idle' && (() => {
    const last = messages[messages.length - 1];
    return !!last && last.role === 'assistant' && last.blocks.some(
      (b) => b.type === 'tool' && b.tool.name === 'AskUserQuestion' && (b.tool.questions?.length ?? 0) > 0,
    );
  })();

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
    queued, queuedAtts, enqueue, clearQueue, cancelQueueAt, moveQueuedItem, fullLoaded, setFullLoaded,
    streaming, disabled, isEmpty,
    sentHistory, modelLabel, labelFor,
    planPending, pendingQuestion, failed, retryLast, bannerConfirm,
  };
}
