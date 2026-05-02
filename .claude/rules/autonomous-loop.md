---
paths: "**/*"
---

# Autonomous Loop Rules

The full protocol lives in `CLAUDE.md` under "Autonomous Loop Protocol". This file expands on the edge cases.

## When to start the loop

If the user's last message is closing-ish ("nothing else", "done for today", "looks good"), or the working tree is clean with no active task — read `.claude/queue.md` and start a cycle. Otherwise, finish the user's current request first.

## Vertical slices, not horizontal layers

Pick the smallest user-visible improvement (DB → API → UI tracer bullet) over a horizontal refactor that ships nothing on its own. A 50-line vertical slice that lights up a feature beats a 200-line "phase 1 of refactor" that ships no value.

## Write the failing test first (for bug fixes)

When the task is a bug fix:
1. Reproduce in a Vitest test that fails.
2. Make the test pass with the minimum diff.
3. Commit `test:` and `fix:` separately if useful, or together as `fix:` with the test in the same diff.

## Cross-model review for risky diffs

If the diff touches auth, RLS, payments, or a migration that changes data: run `Skill(review)` AND request a `Codex` second-opinion review (different context window catches different bugs).

## Stuck recovery

If 3 consecutive iterations on the same task fail to make a metric move:
- Post a status comment on the PR with what was tried.
- Move the task to `.claude/queue.md` under a `## Stuck` section with a one-line summary.
- Pick the next task. Don't thrash.

## What "green" means

CI green + `Skill(review)` no blockers + no Hard-Stop trigger. Anything less = pause, summarize, ask.

## Auto-merge etiquette

After `gh pr merge --squash --auto --delete-branch` succeeds:
- Pull `main` locally.
- Trigger the `nightly-perf` workflow on the new SHA.
- Wait for the result; if regressed, prepend a follow-up task to `.claude/queue.md`.
- Don't open a follow-up PR immediately — let the next cycle pick it up so each PR stays focused.

## Never thrash on flaky tests

If a test flakes, mark it `.skip` ONLY with a `// FLAKY:` comment AND a queue task to fix it. Don't paper over flakes silently.
