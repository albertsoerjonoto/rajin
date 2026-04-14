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
    // Let the WKWebView fill the entire screen, including the area under the
    // status bar and home indicator. The web app handles safe-area insets
    // via env(safe-area-inset-*), which is enabled by viewportFit: 'cover'
    // in src/app/layout.tsx. This matches how Mobile Safari in standalone
    // PWA mode works.
    contentInset: 'never',
    scrollEnabled: true,
    // Fallback color shown for the ~200ms between the splash hiding and the
    // web content painting. Black so the transition doesn't flash bright on
    // dark mode. Once the web content is painted, bg-bg covers this entirely.
    backgroundColor: '#000000',
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
      // Overlay the status bar on top of the WebView instead of inset-ing
      // the WebView below it. Combined with contentInset: 'never' above,
      // the web content paints under the status bar and the web app's
      // bg-bg fills the notch area automatically for both light and dark
      // modes. CapacitorBoot.tsx calls setStyle() at runtime based on
      // prefers-color-scheme so the clock and battery icons stay legible.
      style: 'DEFAULT',
      overlaysWebView: true,
    },
  },
};

export default config;
