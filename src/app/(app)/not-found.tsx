import Link from 'next/link';

export default function AppNotFound() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-20 text-center">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Page not found</h2>
        <p className="text-sm text-gray-500 mb-6">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
