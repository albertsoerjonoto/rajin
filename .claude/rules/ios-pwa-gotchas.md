---
description: iOS PWA layout and scroll pitfalls learned from production bugs
globs: ["**/*.tsx", "**/*.css"]
---

# iOS PWA Gotchas

These are hard-won lessons from production bugs. Follow these rules when touching layout or scroll-related code.

## Viewport Height
- Use `dvh` (dynamic viewport height) instead of `vh`
- `vh` does not account for the iOS Safari toolbar, causing content to be hidden behind it

## Fixed Positioning
- Avoid `position: fixed` on main content areas
- Fixed positioning causes the page to jump when the iOS keyboard opens
- Use a dedicated scroll container within the viewport instead

## Body Overflow
- Never set `overflow: hidden` on `<body>` to prevent scroll
- This breaks native iOS scroll behavior and causes lag
- Instead, use a wrapper div with `overflow-y-auto` as the scroll container

## Scroll Containers
- Use a dedicated scroll container div rather than relying on body scroll
- This prevents scroll "leaking" between pages and the shell
- The app layout already uses this pattern — maintain it

## Keyboard Behavior
- When modifying pages with text inputs (Chat, Log forms), test iOS keyboard open/close
- The keyboard can push content up and cause layout shifts if not handled properly
- Avoid `resize` event listeners for keyboard detection — they're unreliable on iOS
