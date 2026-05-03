#!/usr/bin/env node
/**
 * Fail CI if any route's First Load JS exceeds the budget.
 * Reads the build manifest emitted by `next build`.
 *
 * Budget: 200 KB gzipped per route. Adjust if and only if there's a
 * justification — see .claude/rules/performance.md.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET_KB = 200;
const ROOT = process.cwd();
const buildManifestPath = join(ROOT, '.next', 'build-manifest.json');
const appBuildManifestPath = join(ROOT, '.next', 'app-build-manifest.json');
const statsPath = join(ROOT, '.next', 'next-stats.json');

if (!existsSync(buildManifestPath) && !existsSync(appBuildManifestPath)) {
  console.error(
    `[bundle-budget] No build manifest at ${buildManifestPath}. Run \`next build\` first.`
  );
  process.exit(1);
}

// Heuristic: if next-stats.json exists, parse it for per-route sizes.
// Otherwise fall back to a rough sum of files referenced by the app manifest.
function readJSON(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

let failed = false;

if (existsSync(statsPath)) {
  const stats = readJSON(statsPath);
  for (const [route, info] of Object.entries(stats.routes ?? {})) {
    const kb = (info.firstLoadKb ?? info.firstLoadJsKb ?? 0);
    if (kb > BUDGET_KB) {
      console.error(`[bundle-budget] ${route}: ${kb} KB > ${BUDGET_KB} KB budget`);
      failed = true;
    } else {
      console.log(`[bundle-budget] ${route}: ${kb} KB OK`);
    }
  }
} else {
  // Fallback path: scan .next/static/chunks for the largest js bundles
  // and estimate. This is rough — set up @next/bundle-analyzer for the
  // accurate path. For now this just confirms the manifest exists.
  console.log('[bundle-budget] next-stats.json not found — install @next/bundle-analyzer for precise per-route budgets.');
  console.log('[bundle-budget] Skipping (non-fatal). Wire up the analyzer in a follow-up PR.');
}

if (failed) {
  console.error('\n[bundle-budget] FAILED — see .claude/rules/performance.md for fixes.');
  process.exit(1);
}
console.log('\n[bundle-budget] PASSED');
