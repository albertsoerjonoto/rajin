'use client';

/**
 * CapacitorBoot is mounted once at the root of the app. It is a no-op when
 * the web app is loaded in a regular browser; inside the Capacitor iOS shell
 * it hides the splash screen as soon as React has mounted and keeps the
 * native status bar style in sync with the user's color scheme.
 *
 * The plugins are imported lazily so they don't affect the web bundle on
 * desktop / mobile Safari (where Capacitor.isNativePlatform() is false).
 */

import { useEffect } from 'react';

export default function CapacitorBoot() {
  useEffect(() => {
    let cancelled = false;
    let mediaQuery: MediaQueryList | null = null;
    let onColorSchemeChange: ((e: MediaQueryListEvent) => void) | null = null;

    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      if (cancelled) return;

      const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
        import('@capacitor/splash-screen'),
        import('@capacitor/status-bar'),
      ]);

      // The splash screen has launchAutoHide=true with a 2s cap, but we
      // hide it as soon as React has mounted so fast loads don't linger.
      try {
        await SplashScreen.hide({ fadeOutDuration: 200 });
      } catch {
        // No-op: the splash may already be hidden by the auto-hide timer.
      }

      const applyStatusBar = async (isDark: boolean) => {
        try {
          await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
          await StatusBar.setBackgroundColor({ color: isDark ? '#0a0a0b' : '#ffffff' });
        } catch {
          // setBackgroundColor is a no-op on iOS but still safe to call.
        }
      };

      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      await applyStatusBar(mediaQuery.matches);
      onColorSchemeChange = (e) => {
        void applyStatusBar(e.matches);
      };
      mediaQuery.addEventListener('change', onColorSchemeChange);
    })();

    return () => {
      cancelled = true;
      if (mediaQuery && onColorSchemeChange) {
        mediaQuery.removeEventListener('change', onColorSchemeChange);
      }
    };
  }, []);

  return null;
}
