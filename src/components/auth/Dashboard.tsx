import { BrandMark, Button, Badge } from '../primitives';
import { useCopied } from '../../lib/useCopied';
import { usePairing } from './usePairing';
import { PairingStatus } from './PairingStatus';

// Dashboard de pareamento (DR-023): mostrado quando o usuário está logado mas a VPS
// dele ainda não está atendendo (sem agente pareado/online). Pede um código de
// pareamento ao relay e mostra o comando de 1 linha pra rodar na VPS. Quando o
// agente conecta, o relay manda 'agent-online' e o App troca pra o app de verdade.
export function Dashboard({ token, onSignOut }: { token: string; onSignOut: () => void }) {
  const p = usePairing(token);
  const [copied, copy, copyFailed] = useCopied();

  return (
    <div className="flex h-full flex-1 items-center justify-center overflow-y-auto bg-neutral-950 px-4 py-6">
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

        <div className={`rounded-xl border bg-neutral-950 p-3 ${p.expired ? 'border-yellow-500/40' : 'border-neutral-800'}`}>
          {p.code ? (
            <div className="flex items-center gap-2">
              <code className={`flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12.5px] ${p.expired ? 'text-neutral-600 line-through' : 'text-orange-200'}`}>{p.cmd}</code>
              <Button variant="outline" size="sm" disabled={p.expired} onClick={() => copy(p.cmd)}>
                {copied ? 'copiado' : copyFailed ? 'falhou — copie à mão' : 'copiar'}
              </Button>
            </div>
          ) : (
            <div className="text-[12.5px] text-neutral-500">{p.busy ? 'gerando código…' : '—'}</div>
          )}
          {/* Contagem regressiva do código: ele morre em minutos no relay, e sem
              isto o usuário colava um comando morto meia hora depois. */}
          {p.countdown !== null && (
            <div className="mt-2 flex items-center gap-2">
              <Badge tone={p.expired ? 'red' : 'neutral'} dot>
                {p.expired ? 'código expirado' : `válido por ${p.countdown}`}
              </Badge>
            </div>
          )}
        </div>

        {/* Um só lugar pro erro: com o código já na tela, a falha de "gerar novo
            código" não aparecia em lugar nenhum e o código velho seguia exibido. */}
        {p.err && <p className="mt-3 text-[11.5px] text-red-300">{p.err}</p>}

        <PairingStatus diagnosis={p.diagnosis} probe={p.probe} onTest={p.testConnection} />

        <p className="mt-4 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
          <span className="font-medium text-neutral-400">Beta · relay confiável.</span> Por enquanto o relay é
          operado pela DevFellowship — ele encaminha sua sessão pra sua VPS, mas tecnicamente vê o tráfego.
          A verificação ponta-a-ponta (relay sem poder forjar comandos) entra antes de abrir pra VPSs de terceiros.
        </p>

        <div className="mt-4 flex items-center justify-between border-t border-neutral-800 pt-4">
          <Button variant="ghost" size="sm" onClick={p.fetchCode} disabled={p.busy} loading={p.busy}>
            {p.busy ? 'gerando…' : 'gerar novo código'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onSignOut}>sair</Button>
        </div>
      </div>
    </div>
  );
}
