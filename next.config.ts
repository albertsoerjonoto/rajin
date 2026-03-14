import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow service worker to be served from root
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
