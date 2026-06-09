export function SessionStatusDot({ running, stalled, updated }: { running?: boolean; stalled?: boolean; updated?: boolean }) {
  if (running && !stalled) {
    return (
      <span className="relative flex h-1.5 w-1.5 shrink-0" title="Sessão trabalhando agora">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
      </span>
    );
  }
  if (running && stalled) {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Trabalhando, mas sem output há alguns minutos (tool longo, rate-limit ou travada)" />;
  }
  if (!running && updated) {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" title="Novo output desde a última vez que você abriu" />;
  }
  return null;
}
