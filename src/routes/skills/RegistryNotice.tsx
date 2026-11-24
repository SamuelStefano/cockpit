import { Button, EmptyState, SkeletonCards } from '../../components/primitives';

interface Props { loading: boolean; error: string | null; onRetry: () => void }

const LOCKED_RE = /ENOENT|credentials|\b40[13]\b|login|autentic/i;

export function RegistryNotice({ loading, error, onRetry }: Props) {
  if (error) {
    const locked = LOCKED_RE.test(error);
    return (
      <EmptyState
        icon={locked ? 'circle' : 'x'}
        title={locked ? 'Catálogo bloqueado por enquanto' : 'Catálogo indisponível'}
        description={locked
          ? 'Entre com sua conta DFL pra ver o catálogo completo. As skills instaladas continuam funcionando.'
          : 'Não deu pra falar com o catálogo agora. As skills instaladas continuam funcionando.'}
      >
        <Button icon="rotate" onClick={onRetry}>Tentar de novo</Button>
        <details className="text-center text-[12px] text-neutral-600">
          <summary className="cursor-pointer">Detalhes</summary>
          <span className="mt-1 block break-words font-mono">{error}</span>
        </details>
      </EmptyState>
    );
  }
  return loading ? <SkeletonCards /> : null;
}
