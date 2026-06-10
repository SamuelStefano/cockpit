import { Skeleton } from '../../components/primitives';

export function UsageSkeleton() {
  return (
    <>
      <div className="stagger-fade mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <Skeleton className="mb-2 h-3 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="mb-4 h-36 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </>
  );
}
