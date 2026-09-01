import { useState, useEffect, useCallback, useRef } from 'react';
import { BrandMark, Button } from '../primitives';
import { useCopied } from '../../lib/useCopied';
import { relayHttpBase } from '../../cockpit/session';

// Erros com mensagem própria pro usuário; o resto (TypeError de rede, SyntaxError
// de JSON) vira uma mensagem genérica em vez de vazar "Unexpected token" cru.
class PairError extends Error {}

// Dashboard de pareamento (DR-023): mostrado quando o usuário está logado mas a VPS
// dele ainda não está atendendo (sem agente pareado/online). Pede um código de
// pareamento ao relay e mostra o comando de 1 linha pra rodar na VPS. Quando o
// agente conecta, o relay manda 'agent-online' e o App troca pra o app de verdade.
export function Dashboard({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, copy, copyFailed] = useCopied();

  const abortRef = useRef<AbortController | null>(null);

  const fetchCode = useCallback(async () => {
    // Sem timeout/abort o relay travado deixava "gerando código…" girando pra sempre,
    // e um unmount no meio do fetch (agente conectou) setava estado em componente morto.
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, 15_000);
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${relayHttpBase()}/pair/new`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new PairError('falha ao gerar código');
      const data = (await res.json().catch(() => null)) as { code?: string } | null;
      if (!data?.code) throw new PairError('resposta inválida do relay — tente de novo');
      setCode(data.code);
    } catch (e) {
      if (timedOut) setErr('o relay demorou pra responder — gere um novo código');
      else if (!ctrl.signal.aborted) setErr(e instanceof PairError ? e.message : 'não deu pra falar com o relay — verifique sua conexão');
    } finally {
      clearTimeout(timer);
      if (abortRef.current === ctrl) setBusy(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchCode();
    return () => abortRef.current?.abort();
  }, [fetchCode]);

  const cmd = code ? `curl -fsSL https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh | bash -s -- ${code}` : '';

  return (
    <div className="flex h-full flex-1 items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 shadow-2xl">
        <BrandMark title="conectar sua VPS" subtitle="rode um comando na sua máquina pra começar" className="mb-1" />

        <p className="mb-4 mt-4 text-[13px] leading-relaxed text-neutral-400">
          O Deck que você vê é a tela; o cérebro roda na sua VPS. Cole o comando abaixo no terminal da sua
          VPS e aguarde — a tela troca sozinha quando conectar. Funciona em VPS zerada: o script instala o que
          faltar (Node, build tools, <span className="font-mono text-neutral-300">claude</span> CLI), clona o repo, pareia e deixa o agente como serviço.
          Se o <span className="font-mono text-neutral-300">claude</span> nunca foi logado nessa máquina, rode <span className="font-mono text-neutral-300">claude</span> uma
          vez depois pra fazer o login. Pra controle total na sua própria box (terminais e admin),
          rode com <span className="font-mono text-neutral-300">DECK_AGENT_ROLE=admin</span> antes do <span className="font-mono text-neutral-300">bash</span>.
        </p>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
          {code ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12.5px] text-orange-200">{cmd}</code>
              <Button variant="outline" size="sm" onClick={() => copy(cmd)}>
                {copied ? 'copiado' : copyFailed ? 'falhou — copie à mão' : 'copiar'}
              </Button>
            </div>
          ) : (
            <div className="text-[12.5px] text-neutral-500">{busy ? 'gerando código…' : err || '—'}</div>
          )}
        </div>

        {err && code === '' && (
          <p className="mt-3 text-[11.5px] text-red-300">{err}</p>
        )}

        <div className="mt-4 flex items-center gap-2 text-[11.5px] text-neutral-500">
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          aguardando o agente conectar…
        </div>

        <p className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
          <span className="font-medium text-neutral-400">Beta · relay confiável.</span> Por enquanto o relay é
          operado pela DevFellowship — ele encaminha sua sessão pra sua VPS, mas tecnicamente vê o tráfego.
          A verificação ponta-a-ponta (relay sem poder forjar comandos) entra antes de abrir pra VPSs de terceiros.
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-4">
          <button onClick={fetchCode} disabled={busy} className="text-[11.5px] text-neutral-500 transition hover:text-neutral-300 disabled:opacity-50">
            {busy ? 'gerando…' : 'gerar novo código'}
          </button>
          <button onClick={onSignOut} className="text-[11.5px] text-neutral-500 transition hover:text-neutral-300">sair</button>
        </div>
      </div>
    </div>
  );
}
