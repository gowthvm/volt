const shimmer = 'animate-pulse bg-white/5 rounded-lg';

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-default bg-surface p-5 shadow-md">
      <div className={`mb-3 h-5 w-3/5 ${shimmer}`} />
      <div className={`mb-4 h-28 ${shimmer}`} />
      <div className={`h-3 w-2/5 ${shimmer}`} />
    </div>
  );
}

export function ProjectGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-default bg-base p-5">
        <div className={`mb-4 h-3 w-1/3 ${shimmer}`} />
        <div className="grid grid-cols-3 gap-2">
          <div className={`h-9 ${shimmer}`} />
          <div className={`h-9 ${shimmer}`} />
          <div className={`h-9 ${shimmer}`} />
        </div>
      </div>
      <div className="rounded-lg border border-default bg-base p-5">
        <div className={`mb-4 h-3 w-1/4 ${shimmer}`} />
        <div className={`h-9 ${shimmer}`} />
      </div>
      <div className="rounded-lg border border-default bg-base p-5">
        <div className={`mb-4 h-3 w-1/3 ${shimmer}`} />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className={`h-4 w-12 ${shimmer}`} />
            <div className={`h-4 w-16 ${shimmer}`} />
          </div>
          <div className="flex items-center justify-between">
            <div className={`h-4 w-16 ${shimmer}`} />
            <div className={`h-4 w-12 ${shimmer}`} />
          </div>
          <div className="flex items-center justify-between">
            <div className={`h-4 w-10 ${shimmer}`} />
            <div className={`h-4 w-20 ${shimmer}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
