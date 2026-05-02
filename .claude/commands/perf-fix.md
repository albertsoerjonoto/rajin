---
description: Run Lighthouse, identify the worst metric, plan and ship a fix
---

A targeted perf-improvement cycle. Steps:

1. Run `npx lhci autorun` (or `npx lighthouse http://localhost:3000/dashboard --output=json --quiet --chrome-flags="--headless"` if lhci isn't wired yet) against `/dashboard`, `/log`, and `/chat`. If the dev server isn't up, `mcp__Claude_Preview__preview_start` first.

2. Parse the report. Identify the worst-performing metric across the three pages — typically LCP, TBT, or First Load JS.

3. Plan-mode a fix targeting that single metric. Use `.claude/rules/performance.md` as the playbook. Common moves:
   - LCP slow → preload hero, reduce render-blocking JS, dynamic-import below-the-fold
   - TBT high → split a long task, defer non-critical hydration, look for sync work in `useEffect`
   - First Load JS over budget → dynamic-import the largest dep, audit `optimizePackageImports`
   - INP slow → debounce input handlers, move heavy computation off the main thread

4. ExitPlanMode. Implement the smallest reversible diff.

5. Re-run Lighthouse. Confirm the metric improved. If not, revert and try the next-best move.

6. PR with before/after numbers in the description. Auto-merge if green per Autonomous Loop Protocol.

Don't try to fix more than one metric per PR — small diffs land faster and roll back cleaner.
