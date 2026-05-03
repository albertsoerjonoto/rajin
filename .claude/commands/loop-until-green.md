---
description: Run loop cycles until all perf gates green or 5 attempts exhausted
---

Run `/loop-once` repeatedly until ALL of these are true:
- `.claude/queue.md` "Next up" is empty
- Latest `nightly-perf` run on `main` shows zero regressions
- All Performance Budgets from `CLAUDE.md` are green

Hard cap: 5 cycles. After the 5th, stop and post a status summary with what was shipped and what's still in the queue, regardless of state.

Between cycles:
- `git switch main && git pull --ff-only`
- Re-read `.claude/queue.md` (it may have new items from `nightly-perf` regressions)
- Sleep 30s to let any pending CI jobs settle

If a cycle hits a Hard-Stop trigger, the loop pauses — post a status comment on the PR and stop. Do not bypass.

Report after the run: cycles completed, PRs merged, queue items remaining, perf trend.
