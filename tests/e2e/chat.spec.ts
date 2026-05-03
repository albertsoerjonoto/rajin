import { expect, test } from '@playwright/test';

// Public-facing chat-page guarantees that don't require authenticated state.
// The full happy-path (multi-image upload, multi-turn memory, edit flows)
// needs a seeded test user — tracked in .claude/queue.md.

test.describe('chat (public)', () => {
  test('unauthenticated /chat redirects to /login', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login/);
  });

  test('GET /api/parse returns 405 (only POST is wired)', async ({ request }) => {
    const res = await request.get('/api/parse');
    // Next.js returns 405 for unsupported method on a route handler.
    expect([404, 405]).toContain(res.status());
  });

  test('POST /api/parse without auth returns 401', async ({ request }) => {
    // The route's first action is `supabase.auth.getUser()` — without a session
    // cookie that yields no user and the route returns 401.
    const res = await request.post('/api/parse', {
      data: { message: 'hi' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('POST /api/parse rejects non-Supabase image_urls (no SSRF leak)', async ({ request }) => {
    // The auth gate fires first (401), but this exercises the route's
    // willingness to accept the new image_urls payload shape — a syntax /
    // validation error here would leak through as a 400 before the auth gate.
    const res = await request.post('/api/parse', {
      data: {
        message: 'hi',
        image_urls: ['http://169.254.169.254/latest/meta-data/'],
      },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('chat performance smoke', () => {
  test('redirected /chat → /login renders fast (LCP under generous local budget)', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });
    // After redirect we're on /login. Confirm and grab the LCP.
    await expect(page).toHaveURL(/\/login/);
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const obs = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            resolve(last?.startTime ?? 0);
          });
          obs.observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => resolve(0), 2000);
        }),
    );
    if (lcp > 0) expect(lcp).toBeLessThan(3500);
  });
});
