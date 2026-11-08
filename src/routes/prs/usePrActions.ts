import { useCallback } from 'react';
import type { PrDetail, PrSummary } from '../../../shared/prs';
import { toast } from '../../components/primitives/toast-bus';
import { fixCiPrompt, reviewPrompt } from './prs-prompts';

export interface PrActionDeps {
  onOpenSession: (id: string) => void;
  onSendTo: (sessionId: string, text: string) => boolean;
  onLaunchAgent: (prompt: string, title: string) => string | null;
}

export function usePrActions(pr: PrSummary, detail: PrDetail | null, deps: PrActionDeps) {
  const { onOpenSession, onSendTo, onLaunchAgent } = deps;

  const launch = useCallback((prompt: string, title: string) => {
    const id = onLaunchAgent(prompt, title);
    if (!id) {
      toast('Não deu pra disparar o agente: sem conexão com o servidor.', { tone: 'error' });
      return;
    }
    toast(`Agente disparado: ${title}`, { action: { label: 'Abrir', onClick: () => onOpenSession(id) } });
  }, [onLaunchAgent, onOpenSession]);

  const openSession = useCallback(() => { if (pr.sessionId) onOpenSession(pr.sessionId); }, [pr.sessionId, onOpenSession]);

  const fixCi = useCallback(() => {
    const failing = (detail?.checkRuns ?? []).filter((c) => c.state === 'failure').map((c) => c.name);
    const prompt = fixCiPrompt(pr, failing);
    if (pr.sessionId) {
      if (!onSendTo(pr.sessionId, prompt)) {
        toast('Não deu pra enviar: sem conexão com o servidor.', { tone: 'error' });
        return;
      }
      onOpenSession(pr.sessionId);
      return;
    }
    launch(prompt, `CI #${pr.number}`);
  }, [pr, detail, onSendTo, onOpenSession, launch]);

  const review = useCallback(() => launch(reviewPrompt(pr), `Review #${pr.number}`), [pr, launch]);

  return { openSession, fixCi, review };
}
