'use client';

export function CardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <div className="h-3.5 rounded-full w-1/3 mb-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
      <div className="h-2.5 rounded-full w-2/3 mb-2" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="h-2.5 rounded-full w-1/2" style={{ background: 'rgba(255,255,255,0.05)' }} />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-3">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}
