import Link from 'next/link';

export default function AppNotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-20 text-center">
      <div className="bg-surface rounded-2xl p-8">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-lg font-bold text-text-primary mb-2">Page not found</h2>
        <p className="text-sm text-text-secondary mb-6">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-accent hover:bg-accent-hover text-accent-fg font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
        >
          Go to Overview
        </Link>
      </div>
    </div>
  );
}
