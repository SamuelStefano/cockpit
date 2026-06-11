import { EmptyState } from '../../components/primitives';

export function Empty() {
  return (
    // Wrapper de altura auto: o EmptyState usa h-full e, solto no fluxo abaixo
    // dos stats, esticaria até a altura do scroll container.
    <div className="py-10">
      <EmptyState icon="zap" title="Sem dados de uso ainda" description="Os tokens são registrados conforme você conversa com o agente." />
    </div>
  );
}
