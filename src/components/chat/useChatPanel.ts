import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { prettyModel } from './toolbar-format';
import { pendingQuestionIdx } from '../../cockpit/pending-question';
import type { Session, Message } from '../../data/types';
import type { PermMode, ModelInfo, ParkedView } from '../../../shared/protocol';
import { parseAttachments, replaceBody } from '../../lib/parse-attachments';

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
  queueEdit: (sessionKey: string, id: string, text: string) => void;
  queueMove: (sessionKey: string, id: string, dir: -1 | 1) => void;
  queueClear: (sessionKey: string) => void;
  queueRetry: (sessionKey: string, id: string) => void;
  queueRunBg: (sessionKey: string, id: string, model?: string) => void;
  queueRunNow: (sessionKey: string, id: string) => void;
}

export function useChatPanel({ session, messages, phase, models, model, lastEnd, onSend, queue, queueAdd, queueRemove, queueEdit, queueMove, queueClear, queueRetry, queueRunBg, queueRunNow }: Args) {
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
  // Modelo com que cada item foi enfileirado: é daí que o seletor do disparo em
  // background parte, pra não sugerir um modelo diferente do que o item já tinha.
  const queuedModels = useMemo(() => parked.map((p) => p.model ?? model), [parked, model]);
  useEffect(() => { setFullLoaded(false); pinnedRef.current = true; setAtBottom(true); }, [sid]);

  const enqueue = (text: string) => queueAdd(text);
  const clearQueue = () => { if (sid) queueClear(sid); };
  const cancelQueueAt = (i: number) => { const it = parked[i]; if (it) queueRemove(it.sessionKey, it.id); };
  // Editar reescreve SÓ o corpo do item: os marcadores de anexo do wire original
  // seguem amarrados a ele (o banner mostra o corpo limpo, não o wire).
  const editQueuedAt = (i: number, body: string) => {
    const it = parked[i];
    if (it && body.trim()) queueEdit(it.sessionKey, it.id, replaceBody(it.text, body.trim()));
  };
  // Reordenar: -1 sobe, +1 desce.
  const moveQueuedItem = (i: number, dir: -1 | 1) => { const it = parked[i]; if (it) queueMove(it.sessionKey, it.id, dir); };
  // Item segurado pelo teto de tentativas: o drainer não o dispara mais até o
  // usuário mandar retomar. Como a fila drena do topo, segurar o 1º trava esta
  // sessão — é o que o banner precisa anunciar.
  const queueHeld = parked.length > 0 && parked[0].held === true;
  const resumeQueue = () => { const it = parked[0]; if (it) queueRetry(it.sessionKey, it.id); };
  // Roda o item AGORA num chat paralelo com o contexto deste chat, sem esperar a
  // vez dele na fila nem interromper o turno em andamento.
  const runQueuedInBgAt = (i: number, modelOverride?: string) => {
    const it = parked[i];
    if (it) queueRunBg(it.sessionKey, it.id, modelOverride);
  };
  // Fura a fila: o item vai pro topo e o turno em andamento é interrompido pra ele
  // subir no lugar (neste mesmo chat, não num paralelo como o disparo em bg).
  const runQueuedNowAt = (i: number) => {
    const it = parked[i];
    if (it) queueRunNow(it.sessionKey, it.id);
  };

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

  // Pergunta de escolha (AskUserQuestion) pendente. Mesma régua do clamp de render
  // (pendingQuestionIdx): a última pergunta DEPOIS do último prompt do usuário, não
  // a última mensagem crua — se a continuação auto-resolvida vazar pra uma bolha
  // nova, o check por "última msg" dava false e o banner oferecia retomada por cima
  // do card. E não gateia por `idle`: durante o kill do `claude -p` a phase segue
  // não-idle, mas a pergunta já está pendente e precisa ser respondível.
  const pendingQuestion = useMemo(() => pendingQuestionIdx(messages) !== -1, [messages]);

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

  // Carregar mensagens antigas insere conteúdo ACIMA do que está à vista. O
  // container mantém o scrollTop numérico, então a leitura pulava pro topo.
  // Guardamos a linha do topo da viewport e sua distância pro topo; depois do
  // paint reposicionamos por ela. Solta o pin no ato: senão o efeito de pin
  // (que roda DEPOIS deste layout effect) jogaria tudo pro fim.
  const anchorRef = useRef<{ id: string; top: number } | null>(null);

  const captureAnchor = () => {
    const el = scrollRef.current;
    if (!el) return;
    const base = el.getBoundingClientRect().top;
    for (const node of el.querySelectorAll<HTMLElement>('[data-mid]')) {
      const top = node.getBoundingClientRect().top - base;
      if (top >= 0) { anchorRef.current = { id: node.dataset.mid!, top }; break; }
    }
    pinnedRef.current = false;
  };

  useLayoutEffect(() => {
    const a = anchorRef.current;
    const el = scrollRef.current;
    if (!a || !el) return;
    anchorRef.current = null;
    const node = el.querySelector<HTMLElement>(`[data-mid="${CSS.escape(a.id)}"]`);
    if (!node) return;
    el.scrollTop += node.getBoundingClientRect().top - el.getBoundingClientRect().top - a.top;
  }, [messages]);

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
    scrollRef, atBottom, promptAbove, onScroll, scrollToBottom, scrollToLastPrompt, captureAnchor,
    queued, queuedAtts, queuedModels, enqueue, clearQueue, cancelQueueAt, editQueuedAt, moveQueuedItem, queueHeld, resumeQueue, runQueuedInBgAt, runQueuedNowAt, fullLoaded, setFullLoaded,
    streaming, disabled, isEmpty,
    sentHistory, modelLabel, labelFor,
    planPending, pendingQuestion, failed, retryLast, bannerConfirm,
  };
}
