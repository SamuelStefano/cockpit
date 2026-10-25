interface SkeletonProps {
  className?: string;
  // `span` for a placeholder inside running text (a <div> inside <p> is invalid).
  inline?: boolean;
}

export function Skeleton({ className = '', inline = false }: SkeletonProps) {
  const cls = `shimmer rounded-sm ${className}`;
  return inline ? <span className={`block ${cls}`} /> : <div className={cls} />;
}
