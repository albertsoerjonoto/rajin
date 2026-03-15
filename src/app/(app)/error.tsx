'use client';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-20 text-center">
      <div className="bg-surface rounded-2xl p-8 border border-border">
        <div className="text-4xl mb-4">😵</div>
        <h2 className="text-lg font-bold text-text-primary mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
