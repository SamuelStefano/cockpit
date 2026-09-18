import { Button, EmptyState, SkeletonCards } from '../../components/primitives';

interface Props { loading: boolean; error: string | null; onRetry: () => void }

export function RegistryNotice({ loading, error, onRetry }: Props) {
  if (error) {
    return (
      <EmptyState icon="x" title="Registro indisponível" description={error}>
        <Button icon="rotate" onClick={onRetry}>Tentar de novo</Button>
      </EmptyState>
    );
  }
  return loading ? <SkeletonCards /> : null;
}
