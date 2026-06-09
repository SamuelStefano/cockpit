import { Icon } from '../primitives';

interface ClaudeAuthBannerProps {
  onTerminal?: () => void;
}

// Aviso de que NADA roda até conectar uma conta Anthropic nesta VPS. Aparece só
// quando o backend manda claude-auth ready:false. Dá os dois caminhos: login pelo
// terminal (com túnel SSH, já que o callback OAuth volta pra um localhost da VPS,
// não do PC do usuário) ou ANTHROPIC_API_KEY via Admin.
export function ClaudeAuthBanner({ onTerminal }: ClaudeAuthBannerProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">
            <Icon name="shield" size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-amber-200">Conecte uma conta Anthropic</p>
            <p className="mt-1 text-[13px] leading-relaxed text-amber-100/80">
              O Claude não vai responder nesta VPS enquanto não houver login. Conecte
              pelo terminal ou peça ao admin para adicionar um token.
            </p>

            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[12px] font-medium text-amber-200/90">1. Login pelo terminal</p>
                <p className="mt-1 text-[12px] leading-relaxed text-amber-100/70">
                  Abra um terminal e rode <code className="rounded bg-black/30 px-1 py-0.5 text-amber-200">claude</code> — siga o login.
                  Como você está numa VPS, o link de autorização volta para um endereço local
                  <em> da VPS</em>. Crie um túnel SSH no seu PC encaminhando a porta que o
                  <code className="rounded bg-black/30 px-1 py-0.5 text-amber-200">claude</code> mostrar:
                </p>
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-black/40 px-3 py-2 text-[12px] text-amber-100">
ssh -L PORTA:localhost:PORTA usuario@sua-vps</pre>
                <p className="mt-1 text-[12px] leading-relaxed text-amber-100/70">
                  Depois abra a URL no navegador do seu PC. Se o <code className="rounded bg-black/30 px-1 py-0.5 text-amber-200">claude</code> oferecer
                  colar um código, esse caminho dispensa o túnel.
                </p>
              </div>
              <div>
                <p className="text-[12px] font-medium text-amber-200/90">2. Ou um token de API</p>
                <p className="mt-1 text-[12px] leading-relaxed text-amber-100/70">
                  Um admin pode adicionar <code className="rounded bg-black/30 px-1 py-0.5 text-amber-200">ANTHROPIC_API_KEY</code> em
                  Admin → Tokens. Vale na hora, sem túnel.
                </p>
              </div>
            </div>

            {onTerminal && (
              <button
                onClick={onTerminal}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[12px] font-medium text-amber-100 transition hover:bg-amber-500/25"
              >
                <Icon name="terminal" size={13} /> Abrir terminal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
