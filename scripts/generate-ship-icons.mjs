/**
 * Generates the ship-type silhouette atlas used by the deck.gl IconLayer
 * in apps/web. Each PNG is 64×64, single-channel white-on-transparent so
 * deck.gl's `mask: true` can tint it via `getColor`.
 *
 * Run on demand:
 *
 *   node scripts/generate-ship-icons.mjs
 *
 * The PNG outputs are committed to the repo so the dev loop never
 * depends on this script. Re-run only when changing silhouette designs.
 *
 * Buckets match `iconForShipType` in apps/web/lib/ais/ship-icons.ts and
 * PRD §9 feature 1.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

const SIZE = 64;
const HALF = SIZE / 2;

// All silhouettes share a top-down, bilaterally-symmetric layout (long
// axis = X). Symmetric so the icons read sensibly even though v1 does
// not yet rotate by COG; if `getAngle` is added later all silhouettes
// rotate uniformly without re-design.

function capsule(width, height) {
  const halfW = width / 2;
  const halfH = height / 2;
  const flatHalfW = halfW - halfH;
  return (x, y) => {
    const dx = x - HALF;
    const dy = y - HALF;
    if (Math.abs(dx) <= flatHalfW) return Math.abs(dy) <= halfH ? 255 : 0;
    const d = Math.hypot(Math.abs(dx) - flatHalfW, dy);
    return d <= halfH ? 255 : 0;
  };
}

function roundedRect(width, height, r) {
  return (x, y) => {
    const dx = Math.abs(x - HALF);
    const dy = Math.abs(y - HALF);
    if (dx > width / 2 || dy > height / 2) return 0;
    const cornerDx = dx - (width / 2 - r);
    const cornerDy = dy - (height / 2 - r);
    if (cornerDx <= 0 || cornerDy <= 0) return 255;
    return Math.hypot(cornerDx, cornerDy) <= r ? 255 : 0;
  };
}

function ellipse(width, height) {
  const halfW = width / 2;
  const halfH = height / 2;
  return (x, y) => {
    const nx = (x - HALF) / halfW;
    const ny = (y - HALF) / halfH;
    return nx * nx + ny * ny <= 1 ? 255 : 0;
  };
}

function lngCarrier() {
  // Long thin capsule + three round LNG tanks on top and bottom decks.
  // The double row of tanks gives the silhouette a distinctive "bumpy"
  // outline that reads at 18 px.
  const body = capsule(46, 8);
  const blisters = [-14, 0, 14].flatMap((dx) => [
    { cx: HALF + dx, cy: HALF - 8, r: 5 },
    { cx: HALF + dx, cy: HALF + 8, r: 5 },
  ]);
  return (x, y) => {
    if (body(x, y)) return 255;
    for (const c of blisters) {
      if (Math.hypot(x - c.cx, y - c.cy) <= c.r) return 255;
    }
    return 0;
  };
}

const SHAPES = {
  // Long, thin — reads as VLCC / product tanker.
  tanker: capsule(54, 10),
  // Squat rectangle — boxy hull common to container ships viewed from above.
  cargo: roundedRect(50, 16, 3),
  // Wider capsule — bulkers tend to sit lower and broader than tankers.
  bulker: capsule(48, 18),
  lng: lngCarrier(),
  // Stadium — short and rounded; cruise/ferry profile.
  passenger: capsule(40, 22),
  // Small ellipse — intentionally undersized so fishing reads as
  // distinct from the cargo classes at glance.
  fishing: ellipse(26, 12),
  // Neutral catch-all.
  other: ellipse(36, 14),
};

function rasterize(maskFn) {
  const png = new PNG({ width: SIZE, height: SIZE });
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      const alpha = maskFn(x + 0.5, y + 0.5);
      png.data[idx] = 255;
      png.data[idx + 1] = 255;
      png.data[idx + 2] = 255;
      png.data[idx + 3] = alpha;
    }
  }
  return PNG.sync.write(png);
}

const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "apps/web/public/icons/ships",
);
mkdirSync(OUT_DIR, { recursive: true });

for (const [name, fn] of Object.entries(SHAPES)) {
  const buf = rasterize(fn);
  const outPath = resolve(OUT_DIR, `${name}.png`);
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath}`);
}
