// Numbered variations per coat pattern (#139). Each pattern is no longer a single
// fixed look: the player picks a variant (1..N) and these parameter sets feed the
// existing procedural pattern art (src/art/horseArt.js — bodyPatterns). Variant 1 is
// always the original look, so existing horses (no `<pattern>Var`) render unchanged.
//
// Placement-sensitive patterns (pinto, appaloosa) are hand-authored per variant;
// scatter-style patterns (dapples, roan) are generated from a tiny seeded RNG so a
// variant is just a density knob. All coordinates are body-local (the art adds the
// per-pose vertical offset). Keep these pure (no Phaser) so they're unit-testable.

// How many variants each pattern offers (drives the editor's 1..N stepper).
export const PATTERN_VARIANT_COUNT = { dapples: 5, roan: 5, pinto: 5, appaloosa: 5 };

// Deterministic scatter of `count` integer points inside a box — a seeded LCG so a
// given variant always looks the same (no flicker on re-skin).
function scatter(seed, count, x0, y0, w, h) {
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const out = [];
  for (let i = 0; i < count; i++) out.push([x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h)]);
  return out;
}

// ── Dapples — soft body-highlight circles [x, y, radius] ───────────────────────
const DAPPLE_V1 = [[22, 27, 3], [31, 30, 2.5], [38, 26, 2.5], [44, 29, 2]];
const DAPPLE_COUNT = { 2: 6, 3: 9, 4: 13, 5: 17 };
export function dappleCircles(variant = 1) {
  if (variant <= 1) return DAPPLE_V1;
  const pts = scatter(100 + variant, DAPPLE_COUNT[variant] ?? 6, 12, 21, 33, 12);
  return pts.map(([x, y], i) => [x, y, 2 + ((x + y + i) % 2)]); // radius 2 or 3
}

// ── Roan — single-pixel white flecks [x, y] ────────────────────────────────────
const ROAN_V1 = [
  [15, 23], [19, 27], [23, 22], [27, 29], [31, 24], [35, 28], [39, 23], [43, 27],
  [17, 31], [25, 32], [33, 31], [41, 31], [13, 26], [37, 26], [21, 33], [45, 29],
  [29, 21], [16, 29],
];
const ROAN_COUNT = { 2: 12, 3: 24, 4: 34, 5: 46 };
export function roanFlecks(variant = 1) {
  if (variant <= 1) return ROAN_V1;
  return scatter(200 + variant, ROAN_COUNT[variant] ?? 18, 11, 20, 35, 14);
}

// ── Pinto — white patches + slight shadow edges (placement-authored) ───────────
const PINTO = {
  1: { patches: [[14, 19, 14, 12], [28, 23, 8, 8], [10, 22, 5, 9], [43, 20, 5, 7]], shadows: [[14, 29, 14, 2], [28, 29, 8, 2]] },
  2: { patches: [[16, 21, 10, 9], [11, 24, 5, 7]], shadows: [[16, 28, 10, 2]] },                                  // mostly coloured
  3: { patches: [[10, 19, 22, 13], [33, 21, 11, 9], [43, 20, 5, 8]], shadows: [[10, 30, 22, 2], [33, 28, 11, 2]] }, // mostly white
  4: { patches: [[18, 19, 8, 16], [34, 20, 7, 14]], shadows: [[18, 33, 8, 2], [34, 32, 7, 2]] },                  // vertical (tobiano-ish)
  5: { patches: [[12, 20, 6, 7], [22, 24, 7, 6], [33, 21, 6, 8], [41, 26, 5, 6], [15, 29, 9, 4]], shadows: [[22, 28, 7, 2]] }, // splashy
};
export function pintoSpec(variant = 1) { return PINTO[variant] || PINTO[1]; }

// ── Appaloosa — white blanket rect(s) + dark leopard spots [x, y] ─────────────
const APPALOOSA_SPOTS_V1 = [
  [11, 25], [16, 23], [20, 28], [14, 31], [24, 26], [27, 31], [19, 24], [10, 30], [23, 33],
];
const APPALOOSA = {
  1: { blanket: [[8, 22, 22, 13], [30, 24, 4, 9]], spots: APPALOOSA_SPOTS_V1 },
  2: { blanket: [[8, 23, 16, 12]], spots: scatter(311, 6, 9, 24, 13, 9) },          // small hip blanket
  3: { blanket: [[8, 21, 30, 14], [30, 24, 5, 9]], spots: scatter(312, 16, 9, 23, 27, 10) }, // full leopard
  4: { blanket: [[8, 22, 22, 13], [30, 24, 4, 9]], spots: scatter(313, 5, 9, 24, 19, 9) },   // few spots
  5: { blanket: [[8, 22, 20, 12]], spots: scatter(314, 2, 10, 24, 16, 8) },         // snowcap (sparse)
};
export function appaloosaSpec(variant = 1) { return APPALOOSA[variant] || APPALOOSA[1]; }
