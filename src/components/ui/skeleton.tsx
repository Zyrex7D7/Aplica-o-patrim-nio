import { clsx } from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-surface-alt", className)} />;
}

/** Esqueleto genérico de página: título + alguns cartões — usado nos loading.tsx de cada rota. */
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-9 w-64 mb-2" />
      <Skeleton className="h-4 w-full max-w-md mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-lg" />
    </div>
  );
}
