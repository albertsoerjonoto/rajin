import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tree-shake heavy packages so we only ship the symbols we actually use.
  experimental: {
    optimizePackageImports: [
      'recharts',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      // Long-lived cache for hashed Next assets — they're content-addressed.
      {
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
