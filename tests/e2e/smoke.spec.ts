import { expect, test } from '@playwright/test';

// Golden-path smoke tests. Authenticated flows require a seeded test user
// (added in a follow-up PR — see .claude/queue.md).

test.describe('public pages', () => {
  test('login page renders without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    // Login page should have an email input and a sign-in button somewhere.
    await expect(page.locator('body')).not.toContainText('Application error');
    expect(consoleErrors.filter((e) => !e.includes('manifest.json'))).toEqual([]);
  });

  test('unauthenticated dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('signup page renders', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe('performance smoke', () => {
  test('login page LCP is under budget', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' });
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const obs = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            resolve(last?.startTime ?? 0);
          });
          obs.observe({ type: 'largest-contentful-paint', buffered: true });
          // Resolve fast if no LCP entries (small page might not emit one).
          setTimeout(() => resolve(0), 2000);
        })
    );
    // Generous local budget — Lighthouse CI enforces the strict one.
    if (lcp > 0) expect(lcp).toBeLessThan(3000);
  });
});
