import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Providers from './providers';
import './globals.css';

// Preconnect target for the Supabase origin so the browser can begin the
// TCP + TLS handshake during HTML parse, before any JS runs. Saves
// ~100–300ms on the first browser → Supabase query on cold loads (most
// notably the dashboard's data fetch). Falls back to null if the env var
// is misshaped, so the link is omitted rather than rendered broken.
const SUPABASE_ORIGIN: string | null = (() => {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

export const metadata: Metadata = {
  title: 'Rajin.AI',
  description: 'Track your daily habits, food intake, and exercise with AI-powered Indonesian food knowledge.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rajin.AI',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f8f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0b' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        {SUPABASE_ORIGIN && (
          <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
        )}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${GeistSans.variable} font-sans antialiased bg-bg text-text-primary`}>
        <Providers>{children}</Providers>
        {/* Real-user Core Web Vitals reporting on Vercel deploys.
            Gated on NEXT_PUBLIC_VERCEL_ENV so the script doesn't 404
            in non-Vercel environments (Playwright CI, localhost) —
            its loader fetches /_vercel/speed-insights/script.js which
            only exists when served by Vercel. */}
        {process.env.NEXT_PUBLIC_VERCEL_ENV && <SpeedInsights />}
      </body>
    </html>
  );
}
