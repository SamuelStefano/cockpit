import { Skeleton } from '../components/primitives';

export function AdminHealthSkeleton() {
  return (
    <>
      <Skeleton className="mb-5 h-28 w-full rounded-xl" />
      <div className="stagger-fade grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
            <Skeleton className="mb-2 h-3 w-14" />
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    </>
  );
}
