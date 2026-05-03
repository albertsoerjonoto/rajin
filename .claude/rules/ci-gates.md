---
paths: ".github/**, package.json, lighthouserc.*, vitest.config.*"
---

# CI / Gates Rules

## Required workflows

- `ci.yml` — runs on every PR: install (cache deps) → lint → typecheck → vitest → build → bundle-budget → playwright (smoke) → lhci. All must pass.
- `deploy.yml` — runs on push to `main`: Vercel deploy → smoke-test prod URL → Lighthouse on prod → comment results back to the merged PR.
- `nightly-perf.yml` — cron (daily 09:00 UTC): full Playwright matrix + Lighthouse + bundle trend → opens an issue if any metric regresses ≥ 10% vs the trailing 7-day median.

## Secrets

GitHub Actions secrets that must exist:
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` (CI seeding only)
- `GEMINI_API_KEY`
- `LHCI_GITHUB_APP_TOKEN` (optional, for status checks)

If a workflow run fails on missing secret, do NOT add a fallback that bypasses the gate. Add the secret.

## Branch protection (configured in GitHub UI, not in this repo)

`main` requires:
- All `ci.yml` checks green
- Linear history (squash merges only)
- Up-to-date with main before merge
- Conversation resolution

Auto-merge enabled — Claude is allowed to set `gh pr merge --squash --auto`.

## Reading failures

When CI fails:
1. Read the failed step's log. Don't assume — read.
2. If lint/typecheck failed: fix in a new commit on the same branch.
3. If a test failed: reproduce locally, fix, push.
4. If bundle budget failed: dynamic-import or remove a dep, don't raise the budget unless you have justification.
5. If lhci failed: see `.claude/rules/performance.md`.

Never skip hooks (`--no-verify`) to bypass a gate. If the gate is wrong, fix the gate in a separate PR.
