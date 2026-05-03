'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    __perfNav?: { entries: PerfEntry[] };
    __perfNavPatched?: boolean;
    __perfNavState?: { start: number; urls: string[] };
  }
}

type PerfEntry = {
  type: 'hard' | 'spa';
  path: string;
  ts: number;
  ms?: number;
  ttfb?: number;
  responseEnd?: number;
  domContentLoaded?: number;
  fcp?: number;
  apiUrls?: string[];
  cache?: 'hit' | 'miss';
};

function getState() {
  if (!window.__perfNavState) {
    window.__perfNavState = { start: 0, urls: [] };
  }
  return window.__perfNavState;
}

function flushSpaLog() {
  if (!window.__perfNav) return;
  const s = getState();
  if (s.start === 0) return;
  const ms = Math.round(performance.now() - s.start);
  const urls = s.urls.slice();
  s.start = 0;
  s.urls = [];
  const path = window.location.pathname;
  const apiUrls = urls.filter(
    (u) => u.includes('/api/') || u.includes('.supabase.co')
  );
  const cache: 'hit' | 'miss' = apiUrls.length === 0 ? 'hit' : 'miss';
  const entry: PerfEntry = {
    type: 'spa',
    path,
    ms,
    apiUrls,
    cache,
    ts: Date.now(),
  };
  window.__perfNav.entries.push(entry);
  const annotation =
    cache === 'hit' ? 'cache: hit' : `api: ${apiUrls.join(', ')}`;
  console.log(`[NAV] ${path}: ${ms}ms (${annotation})`);
}

function patchOnce() {
  if (typeof window === 'undefined' || window.__perfNavPatched) return;
  window.__perfNavPatched = true;
  if (!window.__perfNav) window.__perfNav = { entries: [] };
  getState();

  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = function (data, unused, url) {
    const s = getState();
    if (s.start === 0) s.start = performance.now();
    const r = origPush(data, unused, url);
    flushSpaLog();
    return r;
  };
  history.replaceState = function (data, unused, url) {
    const s = getState();
    if (s.start === 0) s.start = performance.now();
    const r = origReplace(data, unused, url);
    flushSpaLog();
    return r;
  };

  window.addEventListener('popstate', () => {
    const s = getState();
    if (s.start === 0) s.start = performance.now();
    flushSpaLog();
  });

  // Capture-phase click on internal anchors — captures the earliest "start" moment
  // (before Next.js router invokes pushState) so the logged ms reflects user-perceived latency.
  document.addEventListener(
    'click',
    (e) => {
      const target = (e.target as Element | null)?.closest?.('a[href]') as
        | HTMLAnchorElement
        | null;
      if (!target) return;
      try {
        const url = new URL(target.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
        const s = getState();
        s.start = performance.now();
        s.urls = [];
      } catch {
        // ignore
      }
    },
    { capture: true }
  );

  const origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      getState().urls.push(url);
    } catch {
      // ignore
    }
    return origFetch(input as Parameters<typeof origFetch>[0], init);
  };
}

function logHardLoad() {
  if (typeof window === 'undefined' || !window.__perfNav) return;
  const navs = performance.getEntriesByType(
    'navigation'
  ) as PerformanceNavigationTiming[];
  const nav = navs[0];
  if (!nav) return;
  const path = window.location.pathname;
  const ttfb = Math.round(nav.responseStart - nav.requestStart);
  const responseEnd = Math.round(nav.responseEnd - nav.requestStart);
  const dcl = Math.round(nav.domContentLoadedEventEnd);
  const paint = performance
    .getEntriesByType('paint')
    .find((p) => p.name === 'first-contentful-paint');
  const fcp = paint ? Math.round(paint.startTime) : -1;
  const entry: PerfEntry = {
    type: 'hard',
    path,
    ttfb,
    responseEnd,
    domContentLoaded: dcl,
    fcp,
    ts: Date.now(),
  };
  window.__perfNav.entries.push(entry);
  console.log(
    `[NAV] ${path}: TTFB=${ttfb}ms responseEnd=${responseEnd}ms DCL=${dcl}ms FCP=${fcp}ms`
  );
}

export function PerfTracker() {
  useEffect(() => {
    patchOnce();

    let logged = false;
    const tryLog = () => {
      if (logged) return;
      logged = true;
      logHardLoad();
    };

    try {
      const po = new PerformanceObserver((list) => {
        const fcp = list
          .getEntries()
          .find((e) => e.name === 'first-contentful-paint');
        if (fcp) {
          tryLog();
          po.disconnect();
        }
      });
      po.observe({ type: 'paint', buffered: true });
    } catch {
      tryLog();
    }

    const fallback = window.setTimeout(tryLog, 5000);
    return () => window.clearTimeout(fallback);
  }, []);

  return null;
}
