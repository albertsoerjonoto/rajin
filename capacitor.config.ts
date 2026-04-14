import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rajin.app',
  appName: 'Rajin',
  webDir: 'ios-webdir',
  // Remote mode: the iOS shell loads the deployed Next.js app from the
  // rajin.ai custom domain on Vercel. This keeps API routes (/api/chat for
  // Gemini), Supabase SSR, and middleware working unchanged. Override
  // RAJIN_REMOTE_URL at build time if needed (e.g. for staging).
  server: {
    url: process.env.RAJIN_REMOTE_URL ?? 'https://rajin.ai',
    cleartext: false,
    // Allow the WebView to navigate within these hosts without falling back
    // to Safari. Add any custom domains here.
    allowNavigation: [
      'rajin.ai',
      '*.rajin.ai',
      '*.vercel.app',
      '*.supabase.co',
      'generativelanguage.googleapis.com',
      'accounts.google.com',
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
  plugins: {
    SplashScreen: {
      // Hold the splash for up to 2s while the remote app loads, then fade
      // out. The web app calls SplashScreen.hide() itself once mounted (see
      // src/components/CapacitorBoot.tsx) so the splash always disappears
      // promptly even on a fast network.
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#ffffff',
      iosSpinnerStyle: 'small',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Match the white app shell. The web app flips this to dark content on
      // dark mode via CapacitorBoot.
      style: 'LIGHT',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
  },
};

export default config;
