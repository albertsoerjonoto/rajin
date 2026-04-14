#!/usr/bin/env node
/**
 * Post-processing step for `npm run ios:assets`.
 *
 * `@capacitor/assets` generates both light and dark splash PNGs into
 * ios/App/App/Assets.xcassets/Splash.imageset/, but it only writes the light
 * variants into the imageset's Contents.json manifest. The dark PNGs end up
 * as orphaned files, and Xcode surfaces them as "Splash has 3 unassigned
 * children" warnings.
 *
 * This script walks the imageset's Contents.json and, for every entry that
 * references a non-dark filename, adds a matching entry that references the
 * corresponding `-dark.png` file with an Apple "luminosity: dark" appearance
 * mapping. This is exactly the shape Xcode expects for automatic light/dark
 * asset selection.
 *
 * The script is idempotent: running it a second time is a no-op because it
 * skips entries that already have appearances or already have a dark twin.
 * It is safe to run even if the ios/ folder does not exist yet (it exits 0
 * with a warning).
 *
 * Usage: node scripts/fix-ios-splash-darkmode.mjs
 *        (invoked automatically by `npm run ios:assets` via postios:assets)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const IMAGESET_DIR = 'ios/App/App/Assets.xcassets/Splash.imageset';
const CONTENTS_JSON = join(IMAGESET_DIR, 'Contents.json');

if (!existsSync(CONTENTS_JSON)) {
  console.warn(
    `[fix-ios-splash-darkmode] ${CONTENTS_JSON} not found — skipping. ` +
      `Run "npx cap add ios" and "npm run ios:assets" first.`,
  );
  process.exit(0);
}

const raw = readFileSync(CONTENTS_JSON, 'utf8');
/** @type {{ images: Array<Record<string, unknown>>, info?: unknown }} */
const manifest = JSON.parse(raw);

if (!Array.isArray(manifest.images)) {
  console.error('[fix-ios-splash-darkmode] Contents.json has no images array');
  process.exit(1);
}

const filesInFolder = new Set(
  readdirSync(IMAGESET_DIR).filter((f) => f.endsWith('.png')),
);

/**
 * Derives the dark-variant filename for a light-variant filename.
 * capacitor-assets uses the convention `<basename>-dark.<ext>`, e.g.
 *   Default@2x~universal~anyany.png  →  Default@2x~universal~anyany-dark.png
 */
function toDarkFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  if (filename.includes('-dark.')) return null; // already a dark variant
  return filename.replace(/(\.[^.]+)$/, '-dark$1');
}

const existingEntriesByFilename = new Map();
for (const entry of manifest.images) {
  if (typeof entry.filename === 'string') {
    existingEntriesByFilename.set(entry.filename, entry);
  }
}

const newEntries = [];
let added = 0;
let skippedAlreadyPresent = 0;
let skippedNoDarkFile = 0;

for (const entry of manifest.images) {
  // Only process entries that reference a real file and have no appearance.
  if (typeof entry.filename !== 'string') continue;
  if (entry.appearances) continue;

  const darkFilename = toDarkFilename(entry.filename);
  if (!darkFilename) continue;

  // If the dark PNG doesn't actually exist in the folder, skip.
  if (!filesInFolder.has(darkFilename)) {
    skippedNoDarkFile += 1;
    continue;
  }

  // If a dark entry for this filename is already present, skip.
  if (existingEntriesByFilename.has(darkFilename)) {
    skippedAlreadyPresent += 1;
    continue;
  }

  newEntries.push({
    ...entry,
    filename: darkFilename,
    appearances: [{ appearance: 'luminosity', value: 'dark' }],
  });
  existingEntriesByFilename.set(darkFilename, entry);
  added += 1;
}

if (added > 0) {
  manifest.images = [...manifest.images, ...newEntries];
  writeFileSync(CONTENTS_JSON, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(
    `[fix-ios-splash-darkmode] Added ${added} dark-mode entries to ${CONTENTS_JSON}`,
  );
} else {
  console.log(
    `[fix-ios-splash-darkmode] Nothing to add. ` +
      `(already-present: ${skippedAlreadyPresent}, no-dark-file: ${skippedNoDarkFile})`,
  );
}

// Step 2: prune orphaned PNG files that are not referenced by any entry in
// Contents.json. `@capacitor/assets` has, across versions, generated files
// with different naming conventions (e.g. `splash-2732x2732.png` in older
// releases, `Default@Nx~universal~anyany.png` in newer ones). When the tool
// is upgraded or re-run on an older imageset, the stale files are left
// behind and Xcode surfaces them as "Splash has N unassigned children"
// warnings. Anything in the folder that isn't referenced by the manifest is
// dead weight — delete it.
const referencedFilenames = new Set(
  manifest.images
    .map((entry) => entry.filename)
    .filter((name) => typeof name === 'string'),
);

const orphanFiles = [...filesInFolder].filter(
  (file) => !referencedFilenames.has(file),
);

let deleted = 0;
for (const file of orphanFiles) {
  try {
    unlinkSync(join(IMAGESET_DIR, file));
    deleted += 1;
  } catch (err) {
    console.warn(
      `[fix-ios-splash-darkmode] Failed to delete orphan ${file}: ${err.message}`,
    );
  }
}

if (deleted > 0) {
  console.log(
    `[fix-ios-splash-darkmode] Pruned ${deleted} orphaned PNG file(s) from ${IMAGESET_DIR}: ${orphanFiles.join(', ')}`,
  );
}
