<!-- Per CLAUDE.md > Performance Budgets, every PR touching src/app/** or src/components/** must clear the gates. CI enforces, but humans/agents should pre-fill the table below. -->

## Why
<!-- Link the queue item or user request. One sentence on the motivation. -->

## What changed
<!-- One short list. Surgical diffs only — every line should trace to "Why". -->

## Verification
- [ ] `npm run verify` passes locally (lint + typecheck + test + build + bundle)
- [ ] `Skill(review)` returns no severity ≥ "high"
- [ ] No Hard-Stop trigger touched (auth / middleware / RLS / service_role / migration DROP / env rotation / billing)

### Performance (required for src/app/** or src/components/** changes)

| Metric | Before | After | Budget | Pass? |
|---|---|---|---|---|
| Lighthouse Performance | | | ≥ 95 | |
| LCP (ms) | | | < 1500 | |
| TBT (ms) | | | < 200 | |
| First Load JS (KB) | | | < 200 | |

### UI proof (if user-facing)
<!-- Paste before/after screenshots from preview_screenshot. Never ask reviewers to verify manually. -->
