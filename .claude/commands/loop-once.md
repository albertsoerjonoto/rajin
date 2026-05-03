---
description: Run one cycle of the Autonomous Loop Protocol from CLAUDE.md and exit
---

You are running ONE cycle of the Autonomous Loop Protocol. The protocol lives in `CLAUDE.md` and `.claude/rules/autonomous-loop.md`. Follow it exactly.

Steps:
1. Read `.claude/queue.md`. Pop the top "Next up" item. If empty, run `/retro` to find a gap and add it to the queue, then continue.
2. Plan-mode the task. ExitPlanMode when ready.
3. Create a fresh branch (never main): `git switch -c claude/loop-$(date +%s)`.
4. Implement the smallest reversible diff that ships value.
5. Verify locally — all four must pass:
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm run test` (skip if not yet wired and noted in queue)
   - `npm run build`
6. Commit with a Conventional Commit message. Push.
7. `gh pr create` with a body that includes:
   - Why (the queue item, linked)
   - What changed
   - Before/after Lighthouse + bundle numbers (if perf-relevant)
   - Verification screenshots (if UI)
8. `gh pr checks --watch`. If any check fails, read the log, fix, push, repeat.
9. Run `Skill(review)` against the diff. If it returns severity ≥ "high", post the findings as a comment and STOP — don't auto-merge.
10. Check Hard-Stop triggers (auth/middleware/RLS/migration-DROPs/env-rotation/billing). If hit, STOP — don't auto-merge.
11. Otherwise: `gh pr merge --squash --auto --delete-branch`.
12. Move the queue item to `## Done` with the merged PR URL.
13. Pull `main` locally.
14. Trigger `gh workflow run nightly-perf.yml`. Wait for completion. If it regressed, prepend a follow-up task to the queue.

Done. Report a one-paragraph summary: queue item, PR URL, gate results, next-cycle suggestion.
