'use client';

export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl p-5">
      <div className="h-4 rounded w-1/3 mb-3 animate-shimmer" />
      <div className="h-3 rounded w-2/3 mb-2 animate-shimmer" />
      <div className="h-3 rounded w-1/2 animate-shimmer" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
