import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../primitives';
import { useCopied } from '../../lib/useCopied';
import { relayHttpBase } from '../../cockpit/session';

// Dashboard de pareamento (DR-023): mostrado quando o usuário está logado mas a VPS
// dele ainda não está atendendo (sem agente pareado/online). Pede um código de
// pareamento ao relay e mostra o comando de 1 linha pra rodar na VPS. Quando o
// agente conecta, o relay manda 'agent-online' e o App troca pra o app de verdade.
export function Dashboard({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, copy] = useCopied();

  const fetchCode = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch(`${relayHttpBase()}/pair/new`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('falha ao gerar código');
      const data = (await res.json()) as { code: string };
      setCode(data.code);
    } catch (e) {
      setErr((e as Error).message ?? 'erro');
    } finally {
      setBusy(false);
    }
  }, [token]);

  useEffect(() => { void fetchCode(); }, [fetchCode]);

  const cmd = code ? `curl -fsSL https://raw.githubusercontent.com/SamuelStefano/cockpit/main/scripts/agent-setup.sh | bash -s -- ${code}` : '';

  return (
    <div className="flex h-full flex-1 items-center justify-center bg-neutral-950 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900/60 p-7 shadow-2xl">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-neutral-950 shadow-[0_0_12px_-1px_rgba(249,115,22,0.55)]">
            <Icon name="terminal" size={16} stroke={2.4} />
          </span>
          <div>
            <div className="font-mono text-[15px] font-semibold lowercase tracking-tight text-neutral-100">conectar sua VPS</div>
            <div className="text-[11px] text-neutral-500">rode um comando na sua máquina pra começar</div>
          </div>
        </div>

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
              <button
                onClick={() => copy(cmd)}
                className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 transition hover:border-orange-500/40 hover:text-orange-300"
              >
                {copied ? 'copiado' : 'copiar'}
              </button>
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
            gerar novo código
          </button>
          <button onClick={onSignOut} className="text-[11.5px] text-neutral-500 transition hover:text-neutral-300">sair</button>
        </div>
      </div>
    </div>
  );
}
