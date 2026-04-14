# Rajin iOS App (Capacitor)

The iOS app is a thin Capacitor shell that loads the deployed Next.js web app
in a `WKWebView`. This keeps 100% of the Next.js code — App Router, API routes
(`/api/chat` for Gemini), Supabase SSR, and middleware — working unchanged.

Config lives in [`capacitor.config.ts`](../capacitor.config.ts).

## Prerequisites (Mac only)

The `npx cap add ios` step and everything downstream of it requires macOS.
There is no way around this; Apple only ships the iOS toolchain for macOS.

- macOS with Xcode 15+ installed (`xcode-select --install`)
- CocoaPods: `sudo gem install cocoapods` (or `brew install cocoapods`)
- An Apple Developer account ($99/yr) for App Store submission. Sideloading
  to a personal device only requires a free Apple ID.

## First-time setup (Mac)

From the repo root, on the `claude/webapp-to-ios-conversion-WrfAs` branch:

```bash
npm install
npx cap add ios          # creates the ios/ native project
npm run ios:assets       # generates icon + splash from assets/ → ios/App/App/Assets.xcassets
npm run ios:sync         # copies capacitor.config.ts into the native project
npm run ios:open         # opens ios/App/App.xcworkspace in Xcode
```

The `ios:assets` step uses [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets)
to generate every iOS icon size and launch image from the source PNGs in
[`assets/`](../assets). The source files are committed to git, so the generated
asset catalog inside `ios/` stays reproducible.

In Xcode:
1. Select the **App** target → **Signing & Capabilities**.
2. Pick your Apple Developer team. Xcode will auto-provision a bundle ID
   matching `appId` in `capacitor.config.ts` (`com.rajin.app`). Change both
   if you want a different bundle ID.
3. Plug in an iPhone (or pick a simulator) and hit **Run** (⌘R).

The app launches, the WebView loads `https://rajin.ai`, and you should
see the dashboard exactly as in mobile Safari.

## Day-to-day workflow

Because we run in remote mode, **you do not need to rebuild the iOS app to
ship web changes**. Push to `main` → Vercel deploys → next time the user
opens the app it loads the new code.

You only need to rebuild + resubmit the iOS app when:
- `capacitor.config.ts` changes (e.g. new allowed navigation host)
- You add/update a Capacitor plugin
- You change app icons or splash screen (re-run `npm run ios:assets`)
- You change `Info.plist`
- Apple requires a new minimum SDK

After any of those, run:

```bash
npm run ios:assets   # only if you changed assets/icon.png or assets/splash*.png
npm run ios:sync
npm run ios:open
# In Xcode: Product → Archive → Distribute App → App Store Connect
```

## Pointing at a different backend

Override the remote URL at build time (e.g. for staging):

```bash
RAJIN_REMOTE_URL=https://rajin-staging.vercel.app npm run ios:sync
```

## App icon and splash

Source files live in [`assets/`](../assets):
- `icon.png` (1024×1024, opaque white background, no alpha — Apple requires this)
- `icon-foreground.png` + `icon-background.png` (used for Android adaptive icons; harmless on iOS)
- `splash.png` (2732×2732, white background with the R logo centered)
- `splash-dark.png` (2732×2732, dark variant for iOS dark-mode splash)

To change the icon, replace `assets/icon.png` and rerun `npm run ios:assets`.
The capacitor-assets tool will regenerate the entire `AppIcon.appiconset` and
launch image set inside the iOS project.

Splash behavior at runtime is controlled by the `SplashScreen` plugin block
in [`capacitor.config.ts`](../capacitor.config.ts) and by
[`src/components/CapacitorBoot.tsx`](../src/components/CapacitorBoot.tsx),
which calls `SplashScreen.hide()` as soon as React mounts so the splash never
lingers on a fast network. CapacitorBoot is a no-op outside the Capacitor
runtime, so it adds nothing to the regular web bundle.

## App Store submission checklist

- [ ] Bundle ID matches the one registered in App Store Connect
- [ ] Ran `npm run ios:assets` after the latest icon change
- [ ] Launch screen colors match `#ffffff` background
- [ ] `NSCameraUsageDescription` etc. added to `Info.plist` only if you
      actually call those APIs (Rajin currently doesn't)
- [ ] Privacy policy URL filled in App Store Connect (Supabase + Gemini
      means you process user data; required by Apple)
- [ ] Test with airplane mode → confirm the `ios-webdir/index.html` fallback
      shows instead of a blank screen

## Known iOS gotchas

The rules in [`.claude/rules/ios-pwa-gotchas.md`](../.claude/rules/ios-pwa-gotchas.md)
all apply to the Capacitor WebView too, since it is `WKWebView`. In
particular: keep using `dvh`, the dedicated scroll container, and avoid
`position: fixed` on main content. Test keyboard open/close on the Chat and
Log forms before each release.
