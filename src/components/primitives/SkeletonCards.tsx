import { Skeleton } from './Skeleton';

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="stagger-fade grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3.5">
          <Skeleton className="mb-2.5 h-4 w-2/3" />
          <Skeleton className="mb-1.5 h-3 w-full" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
