import type { ClaudeLoginView } from '../../../shared/protocol';
import { Badge, Button, CodeBlock, Icon, Input } from '../primitives';
import { useClaudeLogin } from './useClaudeLogin';

interface ClaudeAuthBannerProps {
  login?: ClaudeLoginView;
  onStart?: () => void;
  onCode?: (code: string) => void;
  onCancel?: () => void;
}

const UPDATE_ISOLATED = 'sudo -u deck git -C /home/deck/.deck-src pull && sudo systemctl restart deck-agent';
const UPDATE_PLAIN = 'git -C ~/.deck-src pull && sudo systemctl restart deck-agent';

const MONO = 'rounded-sm bg-black/30 px-1 py-0.5 font-mono text-amber-200';

export function ClaudeAuthBanner(props: ClaudeAuthBannerProps) {
  const l = useClaudeLogin(props);
  const showCode = l.state === 'url' || l.state === 'verifying';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
            <Icon name="shield" size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-amber-200">Conecte sua conta Claude</p>
              <Badge tone="yellow">Pendente</Badge>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-100/80">
              O Deck usa o Claude da sua VPS. Faça login uma vez, direto daqui.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {(l.state === 'idle' || l.state === 'waiting-url' || l.state === 'error') && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button icon="link" loading={l.busy} onClick={l.start}>
                    {l.state === 'error' ? 'Tentar de novo' : 'Conectar conta Claude'}
                  </Button>
                </div>
              )}
              {l.noReply && (
                <div role="alert" className="flex flex-col gap-2">
                  <p className="text-[12.5px] text-red-400">
                    A VPS não respondeu. O agente pode estar desatualizado — atualize e tente de novo:
                  </p>
                  <CodeBlock code={UPDATE_ISOLATED} lang="bash" />
                  <p className="text-[12px] text-amber-100/70">Instalação não isolada:</p>
                  <CodeBlock code={UPDATE_PLAIN} lang="bash" />
                </div>
              )}
              {l.stalled && (
                <p role="alert" className="text-[12.5px] text-red-400">
                  O login demorou demais. Abra a aba Shell e rode <code className={MONO}>claude auth login</code>.
                </p>
              )}
              {l.error && !l.noReply && !l.stalled && (l.state === 'error' || l.state === 'url') && (
                <p role="alert" className="text-[12.5px] text-red-400">{l.error}</p>
              )}
              {showCode && l.url && (
                <>
                  <Button className="w-fit" icon="external" iconRight onClick={() => window.open(l.url, '_blank', 'noopener,noreferrer')}>
                    Abrir login da Anthropic
                  </Button>
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => { e.preventDefault(); l.submit(); }}
                  >
                    <div className="min-w-56 flex-1">
                      <Input
                        value={l.code}
                        onChange={(e) => l.setCode(e.target.value)}
                        placeholder="Cole aqui o código que a Anthropic mostrar"
                        autoComplete="off"
                        spellCheck={false}
                        mono
                        disabled={l.busy}
                      />
                    </div>
                    <Button type="submit" loading={l.busy} disabled={!l.canSubmit}>Concluir</Button>
                    <Button type="button" variant="ghost" onClick={l.reset}>Cancelar</Button>
                  </form>
                </>
              )}
            </div>

            <details className="mt-3 text-[12px] text-amber-100/70">
              <summary className="cursor-pointer text-amber-200/90">Outras opções</summary>
              <ul className="mt-2 space-y-1.5 leading-relaxed">
                <li>Pelo terminal da VPS: <code className={MONO}>claude auth login</code></li>
                <li>Se a instalação é isolada: <code className={MONO}>sudo -iu deck claude auth login</code></li>
                <li>Ou um admin adiciona <code className={MONO}>ANTHROPIC_API_KEY</code> em Admin → Tokens.</li>
              </ul>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
