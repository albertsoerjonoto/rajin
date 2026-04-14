import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rajin.app',
  appName: 'Rajin',
  webDir: 'ios-webdir',
  // Remote mode: the iOS shell loads the deployed Next.js app from Vercel.
  // This keeps API routes (/api/chat for Gemini), Supabase SSR, and middleware
  // working unchanged. Override RAJIN_REMOTE_URL at build time if needed.
  server: {
    url: process.env.RAJIN_REMOTE_URL ?? 'https://rajin.vercel.app',
    cleartext: false,
    // Allow the WebView to navigate within these hosts without falling back
    // to Safari. Add any custom domains here.
    allowNavigation: [
      'rajin.vercel.app',
      '*.supabase.co',
      'generativelanguage.googleapis.com',
    ],
  },
  ios: {
    // Use the system content inset so the status bar / home indicator behave
    // the same as Mobile Safari. Pairs with the dvh + scroll-container rules
    // in .claude/rules/ios-pwa-gotchas.md.
    contentInset: 'always',
    // Disable the bounce/rubber-band scroll on the root WebView. Inner scroll
    // containers (the app's scroll wrapper) keep their native bounce.
    scrollEnabled: true,
    backgroundColor: '#ffffff',
  },
};

export default config;
