import { Badge, Button } from '../primitives';
import { useCopied } from '../../lib/useCopied';
import type { InstallMode } from './pairing';

interface PairCommandProps {
  code: string;
  cmd: string;
  busy: boolean;
  expired: boolean;
  countdown: string | null;
  mode: InstallMode;
}

const mono = 'font-mono text-neutral-400';

export function PairCommand({ code, cmd, busy, expired, countdown, mode }: PairCommandProps) {
  const [copied, copy, copyFailed] = useCopied();
  return (
    <div>
      <div className={`rounded-xl border bg-neutral-950 p-3.5 ${expired ? 'border-yellow-500/40' : 'border-neutral-800'}`}>
        {code ? (
          <code className={`block break-all font-mono text-[13px] leading-relaxed ${expired ? 'text-neutral-600 line-through' : 'text-orange-200'}`}>{cmd}</code>
        ) : (
          <div className="text-[13px] text-neutral-500">{busy ? 'gerando código…' : '—'}</div>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* O código morre em minutos no relay; sem a contagem o usuário colava um comando morto. */}
        {countdown !== null ? (
          <Badge tone={expired ? 'red' : 'neutral'} dot>
            {expired ? 'código expirado' : `válido por ${countdown}`}
          </Badge>
        ) : <span />}
        <Button size="md" icon={copied ? 'check' : 'copy'} disabled={expired || !code} onClick={() => copy(cmd)}>
          {copied ? 'copiado ✓' : copyFailed ? 'falhou — copie à mão' : 'copiar'}
        </Button>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">
        Quer ver antes? Troque <span className={mono}>DECK_PAIR_CODE=…</span> por <span className={mono}>DECK_DRY_RUN=1</span> — mostra o plano sem instalar nada.
        {mode === 'dedicated' && <> Pra controle total (terminais e admin), use <span className={mono}>DECK_AGENT_ROLE=admin</span>.</>}
      </p>
    </div>
  );
}
