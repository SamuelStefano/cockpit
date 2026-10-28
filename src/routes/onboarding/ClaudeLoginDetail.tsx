import type { ClaudeLoginView } from '../../../shared/protocol';
import { Button, Input } from '../../components/primitives';
import { useClaudeLogin } from '../../components/chat/useClaudeLogin';

interface ClaudeLoginDetailProps {
  login?: ClaudeLoginView;
  onStart?: () => void;
  onCode?: (code: string) => void;
  onCancel?: () => void;
}

export function ClaudeLoginDetail(props: ClaudeLoginDetailProps) {
  const l = useClaudeLogin(props);
  const showCode = l.state === 'url' || l.state === 'verifying';
  return (
    <>
      <p className="text-[13px] leading-relaxed text-neutral-400">
        1. Abra o login da Anthropic &nbsp;2. Copie o código que ela mostrar &nbsp;3. Cole aqui e conclua.
      </p>
      {showCode && l.url && (
        <>
          <Button className="w-fit" size="sm" variant="secondary" icon="external" iconRight onClick={() => window.open(l.url, '_blank', 'noopener,noreferrer')}>
            Abrir login da Anthropic
          </Button>
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); l.submit(); }}>
            <div className="min-w-48 flex-1">
              <Input
                value={l.code} onChange={(e) => l.setCode(e.target.value)} placeholder="Cole aqui o código"
                autoComplete="off" spellCheck={false} mono disabled={l.busy} aria-label="Código da Anthropic"
              />
            </div>
            <Button type="submit" size="sm" loading={l.busy} disabled={!l.canSubmit}>Concluir</Button>
          </form>
        </>
      )}
      {l.state === 'waiting-url' && <p className="text-[13px] text-neutral-400">Pedindo o link de login…</p>}
    </>
  );
}
