// Procedural pixel-art for the AMBIENT WILDLIFE (issues #181/#182/#183): a stream
// fish, fly-by/peck birds, and a scampering raccoon. These are scenery, not cared-for
// animals — no roster, no needs, no info panel — so their art lives here and builds
// alongside the world/player textures (BootScene), not via the species art registry.
//
// All face RIGHT and use origin (0.5, 1) like the other small critters. They're drawn
// from rounded primitives (ellipses/triangles), which the canvas anti-aliases — so we
// SUPER-SAMPLE them on the ART_SCALE grid (like the horse/sheep) and display at
// S/ART_SCALE. That keeps the soft AA rim sub-pixel at game size, so the curves stay
// smooth but the sprite reads crisp (and sharp on HiDPI) rather than fuzzy-edged.
// First-pass draft look — the owner art-directs the polish in the preview.

import { gen, scaledGraphics, ART_SCALE } from './_frames.js';

// ── Fish (#183) ──────────────────────────────────────────────────────────────
// Seen from above through the water: a dark slate silhouette with a faintly lighter
// back and a flicking tail. Rendered at low alpha by the spawner so it reads as a
// shadow just under the surface, not a sprite sitting on top of it.
export const FISH_W = 18, FISH_H = 11;
const FISH_BODY = 0x35586a, FISH_BACK = 0x223c48, FISH_BELLY = 0x6f97a6;

function drawFish(g, flick) {
  // tail fin (left) — splays open/closed with the flick to read as a swish
  g.fillStyle(FISH_BACK, 1);
  g.fillTriangle(1, 5, 7, 2 + flick, 7, 8 - flick);
  // body
  g.fillStyle(FISH_BODY, 1); g.fillEllipse(11, 5, 13, 6);
  // dorsal fin
  g.fillStyle(FISH_BACK, 1); g.fillTriangle(8, 2, 12, 2, 10, 0);
  // darker back
  g.fillStyle(FISH_BACK, 1); g.fillEllipse(11, 4, 11, 3);
  // pale belly sheen
  g.fillStyle(FISH_BELLY, 0.85); g.fillEllipse(12, 6, 8, 2);
  // eye
  g.fillStyle(0x0a1518, 1); g.fillRect(15, 4, 1, 1);
}

export function buildFishTextures(scene) {
  gen(scene, 'fish_0', FISH_W * ART_SCALE, FISH_H * ART_SCALE, (g) => drawFish(scaledGraphics(g), 0));
  gen(scene, 'fish_1', FISH_W * ART_SCALE, FISH_H * ART_SCALE, (g) => drawFish(scaledGraphics(g), 1)); // tail swished

  // A tiny expanding ring left where a fish surfaces/darts — a soft white ripple. Kept
  // 1× (not super-sampled): a ripple is meant to be soft, and strokeCircle isn't on the
  // scaledGraphics wrapper.
  gen(scene, 'fishRipple', 16, 16, (g) => {
    g.lineStyle(1, 0xdff4ff, 0.9); g.strokeCircle(8, 8, 6);
    g.lineStyle(1, 0xbfeaff, 0.5); g.strokeCircle(8, 8, 3);
  });
}

// ── Bird (#182) ──────────────────────────────────────────────────────────────
// Two looks: a flying pose (wings up/down for a flap) and a perched pose (head up vs
// down for a peck). A little brown songbird with a pale belly and a stubby beak.
export const BIRD_W = 16, BIRD_H = 12;
const BIRD_BODY = 0x6b513a, BIRD_WING = 0x4f3c2b, BIRD_BELLY = 0xc2a47a, BEAK = 0xe0a838;

function drawBirdFly(g, wingsUp) {
  // tail
  g.fillStyle(BIRD_BODY, 1); g.fillTriangle(1, 5, 5, 4, 5, 9);
  // body
  g.fillStyle(BIRD_BODY, 1); g.fillEllipse(8, 7, 9, 5);
  g.fillStyle(BIRD_BELLY, 0.9); g.fillEllipse(8, 8, 6, 3);
  // head + beak
  g.fillStyle(BIRD_BODY, 1); g.fillCircle(12, 6, 2.3);
  g.fillStyle(BEAK, 1); g.fillTriangle(14, 5, 16, 6, 14, 7);
  g.fillStyle(0x0a0805, 1); g.fillRect(12, 5, 1, 1); // eye
  // the wing — swept up for the up-stroke, down for the down-stroke
  g.fillStyle(BIRD_WING, 1);
  if (wingsUp) g.fillTriangle(6, 6, 10, 0, 3, 2);
  else g.fillTriangle(6, 7, 10, 12, 3, 11);
}

function drawBirdPeck(g, headDown) {
  // legs
  g.fillStyle(BEAK, 1); g.fillRect(6, 9, 1, 2); g.fillRect(9, 9, 1, 2);
  // tail (cocked up behind)
  g.fillStyle(BIRD_BODY, 1); g.fillTriangle(1, 4, 5, 3, 5, 8);
  // body
  g.fillStyle(BIRD_BODY, 1); g.fillEllipse(8, 7, 9, 6);
  g.fillStyle(BIRD_BELLY, 0.9); g.fillEllipse(8, 8, 6, 4);
  g.fillStyle(BIRD_WING, 1); g.fillEllipse(6, 7, 5, 4); // folded wing
  // head — up (alert) or down (pecking the ground)
  const hy = headDown ? 9 : 4;
  g.fillStyle(BIRD_BODY, 1); g.fillCircle(12, hy, 2.3);
  g.fillStyle(BEAK, 1); g.fillTriangle(14, hy, 16, hy + 1, 14, hy + 1);
  g.fillStyle(0x0a0805, 1); g.fillRect(12, hy - 1, 1, 1);
}

export function buildBirdTextures(scene) {
  const W = BIRD_W * ART_SCALE, H = BIRD_H * ART_SCALE;
  gen(scene, 'bird_fly_0', W, H, (g) => drawBirdFly(scaledGraphics(g), true));
  gen(scene, 'bird_fly_1', W, H, (g) => drawBirdFly(scaledGraphics(g), false));
  gen(scene, 'bird_peck_0', W, H, (g) => drawBirdPeck(scaledGraphics(g), false));
  gen(scene, 'bird_peck_1', W, H, (g) => drawBirdPeck(scaledGraphics(g), true));
}

// ── Raccoon (#181) ─────────────────────────────────────────────────────────��─
// Side view, facing right: grey body, black bandit mask across the eyes, pointed
// ears, and a fat banded tail. Scampers, so it gets a 4-frame run plus a sit/idle.
export const RACC_W = 26, RACC_H = 18;
const R_FUR = 0x8b8d92, R_DARK = 0x3c3f45, R_LIGHT = 0xcccdcf, R_MASK = 0x202125, R_NOSE = 0x141009;

function raccoonLeg(g, x, lift) {
  g.fillStyle(R_DARK, 1);
  g.fillRect(x, 13 - lift, 2, 4 + lift); // dark sock leg
}

function drawRaccoon(g, [l0, l1, l2, l3], bob = 0) {
  const y = bob;
  // ── Banded bushy tail (left), held out behind ──
  g.fillStyle(R_DARK, 1); g.fillEllipse(3, 11 + y, 8, 7);
  g.fillStyle(R_LIGHT, 1);
  g.fillRect(1, 9 + y, 2, 5); g.fillRect(5, 9 + y, 2, 5); // light rings
  g.fillStyle(R_DARK, 1); g.fillRect(3, 9 + y, 2, 5);     // dark ring between
  g.fillStyle(R_FUR, 1); g.fillEllipse(6, 11 + y, 4, 5);  // tail meets the rump
  // ── Legs (far pair drawn first/darker, near pair over) ──
  raccoonLeg(g, 8, l0); raccoonLeg(g, 17, l2);
  raccoonLeg(g, 10, l1); raccoonLeg(g, 19, l3);
  // ── Body ── low, rounded, grey with a darker back
  g.fillStyle(R_FUR, 1); g.fillEllipse(13, 10 + y, 16, 9);
  g.fillStyle(R_DARK, 0.5); g.fillEllipse(13, 8 + y, 14, 4); // shaded back
  g.fillStyle(R_LIGHT, 0.6); g.fillEllipse(13, 12 + y, 12, 3); // pale underside
  // ── Head (right) ── pointed snout
  g.fillStyle(R_FUR, 1); g.fillCircle(20, 8 + y, 4);
  g.fillStyle(R_LIGHT, 1); g.fillTriangle(23, 7 + y, 26, 9 + y, 23, 10 + y); // snout
  g.fillStyle(R_NOSE, 1); g.fillRect(25, 8 + y, 1, 1);
  // ears
  g.fillStyle(R_FUR, 1);
  g.fillTriangle(17, 5 + y, 19, 2 + y, 20, 6 + y);
  g.fillTriangle(20, 5 + y, 22, 2 + y, 23, 6 + y);
  g.fillStyle(R_DARK, 1); g.fillRect(18, 4 + y, 1, 1); g.fillRect(21, 4 + y, 1, 1);
  // ── Bandit mask across the eyes, white brow above ──
  g.fillStyle(R_LIGHT, 1); g.fillRect(17, 6 + y, 7, 1);
  g.fillStyle(R_MASK, 1); g.fillRect(18, 7 + y, 6, 2);
  g.fillStyle(0xf4f0e6, 1); g.fillRect(20, 7 + y, 1, 1); g.fillRect(22, 7 + y, 1, 1); // eye glints
}

// idle (a low sit) + a 4-frame scamper (diagonal leg pairs, with a bounce).
const RACCOON_FRAMES = [
  { name: 'idle_0', legs: [0, 0, 0, 0], bob: 0 },
  { name: 'idle_1', legs: [0, 0, 0, 0], bob: 1 },
  { name: 'run_0', legs: [2, 0, 0, 2], bob: 0 },
  { name: 'run_1', legs: [0, 0, 0, 0], bob: 1 },
  { name: 'run_2', legs: [0, 2, 2, 0], bob: 0 },
  { name: 'run_3', legs: [0, 0, 0, 0], bob: 1 },
];

export function buildRaccoonTextures(scene) {
  RACCOON_FRAMES.forEach((f) => gen(scene, `raccoon_${f.name}`, RACC_W * ART_SCALE, RACC_H * ART_SCALE,
    (g) => drawRaccoon(scaledGraphics(g), f.legs, f.bob)));
}

// One call BootScene makes for all ambient wildlife textures (parallel to the
// world/player builders — these aren't a roster species).
export function buildWildlifeTextures(scene) {
  buildFishTextures(scene);
  buildBirdTextures(scene);
  buildRaccoonTextures(scene);
}

// TEMP comparison scaffolding: the OLD 1× (non-super-sampled) variants under `*Old`
// keys, built ONLY for the Art Preview gallery so the owner can A/B the soft AA'd edges
// against the crisp super-sampled versions. Not used in-world. Remove once the look is
// settled (these draw fns are the same — only the 1× vs ART_SCALE grid differs).
export function buildWildlifeOldTextures(scene) {
  gen(scene, 'fishOld_0', FISH_W, FISH_H, (g) => drawFish(g, 0));
  gen(scene, 'fishOld_1', FISH_W, FISH_H, (g) => drawFish(g, 1));
  gen(scene, 'birdOld_fly_0', BIRD_W, BIRD_H, (g) => drawBirdFly(g, true));
  gen(scene, 'birdOld_fly_1', BIRD_W, BIRD_H, (g) => drawBirdFly(g, false));
  gen(scene, 'birdOld_peck_0', BIRD_W, BIRD_H, (g) => drawBirdPeck(g, false));
  gen(scene, 'birdOld_peck_1', BIRD_W, BIRD_H, (g) => drawBirdPeck(g, true));
  RACCOON_FRAMES.forEach((f) => gen(scene, `raccoonOld_${f.name}`, RACC_W, RACC_H, (g) => drawRaccoon(g, f.legs, f.bob)));
}
