---
paths: "src/**, supabase/**, vitest.config.*, playwright.config.*"
---

# Testing Rules

Two tiers; both must be green before merge.

## Tier 1 — `gate` tests (CI-blocking, fast, deterministic)

- Vitest unit tests for pure functions in `src/lib/**` and component logic in `src/components/**`.
- Playwright smoke for the golden path: signup → onboarding → log a food → log a habit → confirm dashboard renders.
- Lint + typecheck.
- Bundle budget script.
- Run on every PR. Must finish < 3 min total.

## Tier 2 — `periodic` tests (nightly, paid OK)

- Full Playwright matrix (mobile + desktop, light + dark).
- Lighthouse CI against production on `main`.
- Visual regression (when wired).
- LLM-judge skill evals (chat parsing accuracy).
- Run on cron in `.github/workflows/nightly-perf.yml`. Failures open an issue — they don't block PRs.

## Patterns

- **Bug fix → write the failing test first.** No exceptions. The test reproduces the bug, then the diff makes it pass.
- **Don't mock Supabase** for tests that exercise RLS — use a seeded test project. Mocks have masked migration bugs in real prod incidents.
- **Use the test factory** at `tests/factories/*.ts` (when added) for consistent test data.
- **Tests live next to source**: `foo.ts` ↔ `foo.test.ts`. E2E flows live in `tests/e2e/`.
- **Snapshot tests are last resort** — they break on every minor refactor and teach nothing.

## Flaky tests

If a test flakes:
1. Reproduce locally with `--repeat-each 20`.
2. If reproducible — fix the root cause.
3. If not reproducible — skip with `// FLAKY: <date> <hypothesis>` AND add a task to `.claude/queue.md` to fix within a week.
4. Never silently disable. The skip is a debt; track it.
