# Portable Prompt — Drop into any Claude Code session/project

Copy the block below into a new session's first message (or paste into another project's CLAUDE.md). It seeds the same autonomous-loop workflow without needing the full Rajin scaffold.

---

> **Adopt the Autonomous Loop workflow.**
>
> **Cadence.** Every cycle: plan-mode → ExitPlanMode → implement smallest reversible diff → `npm run lint && npx tsc --noEmit && npm run test && npm run build` (all four must pass) → commit (Conventional Commits) → push → `gh pr create` (with before/after perf numbers if relevant) → `gh pr checks --watch` → `Skill(review)` against the diff → if zero blockers AND CI green AND no Hard-Stop trigger → `gh pr merge --squash --auto --delete-branch`. Pull main. Loop.
>
> **Performance budgets are mandatory.** Lighthouse Performance ≥ 95 mobile, LCP < 1500 ms, TBT < 200 ms, First Load JS per route < 200 KB gzipped, 100% unit + E2E tests pass. Regressions block merge.
>
> **Hard-Stops** (pause and ask the user, never auto-merge): changes touching auth, middleware, RLS, service_role refs, schema migrations that DROP columns/tables or change PKs, env-var rotation, billing, or anything `Skill(review)` flags ≥ "high".
>
> **Doctrine** (apply on every diff):
> - **Surgical changes** — every diff line traces to the request. No drive-by refactors. (Karpathy.)
> - **Boil the lake** — when the delta is small, prefer the complete fix over the 90% shortcut. (gstack.)
> - **Search before building** — grep for existing utils first; reuse > write.
> - **Plan-mode first** for non-trivial work; AskUserQuestion to disambiguate.
> - **Squash-merge**, PRs ≤ 150 lines, commit hourly.
> - **Default to no comments**; document only the non-obvious *why*.
> - **Vertical slices** (DB → API → UI tracer bullet), not horizontal layer-by-layer refactors.
> - **Bug fix → write the failing test first**, then make it pass.
> - **Cross-model review** for risky diffs (auth, RLS, migrations, payments).
>
> **Tooling preference** for ops: dedicated MCP > CLI > Chrome MCP > Computer Use. Never `--no-verify`, `--no-gpg-sign`, `git push --force` to main, or `git reset --hard` on shared refs.
>
> **Queue.** Maintain `.claude/queue.md` as the source of truth for "what next." When the working tree is clean and there is no active user request, pop the top item and start a cycle. If 3 consecutive iterations on the same task fail to make a metric move, post a status comment and stop — don't thrash.
>
> **Stuck recovery.** Move the task to a `## Stuck` section in the queue with a one-line summary of what was tried. Pick the next task.
>
> **Verification before claiming done.** For UI: `preview_start` → reload → `preview_console_logs` (errors) → `preview_snapshot` (content) → `preview_screenshot` for the PR. Never ask the user to verify manually — verify and ship proof.
>
> Run continuously until the queue is empty AND all gates green. Then `/retro` to refill the queue.

---

## How to apply this in a brand-new project

1. Copy the block above into the project's `CLAUDE.md` (or paste as the first message of a session).
2. Add `.claude/rules/autonomous-loop.md`, `.claude/rules/performance.md`, `.claude/rules/testing.md`, `.claude/rules/ci-gates.md`, `.claude/rules/skills.md` (copy from this repo or reference its structure).
3. Add `.claude/queue.md` with an initial seed of follow-up tasks.
4. Add `.claude/commands/{loop-once,loop-until-green,perf-fix,queue}.md` (copy from this repo).
5. Configure `.claude/settings.json` with the deny-list (force-push, --no-verify, reset --hard) and the Stop hook reminding about uncommitted work.
6. Generate Vercel + Supabase tokens, drop them in `~/.config/<project>/secrets.env` plus GitHub Actions secrets.
7. Wire CI: `ci.yml` (lint/typecheck/test/build/lhci/playwright), `deploy.yml` (Vercel push-to-deploy + post-deploy smoke), `nightly-perf.yml` (cron Lighthouse + Playwright).
8. Open the first PR. Watch the loop run.

The whole bundle is ~15 small files. You can lift it wholesale.
