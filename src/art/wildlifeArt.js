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

import { gen, scaledGraphics, ART_SCALE, makeLeg } from './_frames.js';
import { BIRD_TYPES } from '../data/wildlife.js';

// ── Fish (#183) ──────────────────────────────────────────────────────────────
// Seen from above through the water: a dark slate silhouette with a faintly lighter
// back and a flicking tail. Rendered at low alpha by the spawner so it reads as a
// shadow just under the surface, not a sprite sitting on top of it.
export const FISH_W = 18, FISH_H = 11;
const FISH_BODY = 0x35586a, FISH_BACK = 0x223c48, FISH_BELLY = 0x6f97a6;

function drawFish(g, flick) {
  g.layer('fin_tail');
  g.fillStyle(FISH_BACK, 1);
  g.fillTriangle(1, 5, 7, 2 + flick, 7, 8 - flick);
  g.layer('body');
  g.fillStyle(FISH_BODY, 1); g.fillEllipse(11, 5, 13, 6);
  g.layer('fin_dorsal');
  g.fillStyle(FISH_BACK, 1); g.fillTriangle(8, 2, 12, 2, 10, 0);
  g.layer('back');
  g.fillStyle(FISH_BACK, 1); g.fillEllipse(11, 4, 11, 3);
  g.layer('belly');
  g.fillStyle(FISH_BELLY, 0.85); g.fillEllipse(12, 6, 8, 2);
  g.layer('eye');
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

// ── Bird (#182 / variety #220) ─────────────────────────────────────────────────
// Two looks: a flying pose (wings up/down for a flap) and a perched pose (head up vs
// down for a peck). ONE sprite driven by a data palette (data/wildlife.js BIRD_TYPES):
// each type swaps the body/wing/belly/beak colors and can toggle a couple of purely
// cosmetic silhouette tweaks (a head crest, a longer forked tail). No per-type behavior.
export const BIRD_W = 16, BIRD_H = 12;
// The original little brown songbird's palette — the default when no type is passed.
const DEFAULT_BIRD = { body: 0x6b513a, wing: 0x4f3c2b, belly: 0xc2a47a, beak: 0xe0a838 };
const EYE_DEFAULT = 0x0a0805;

function drawBirdFly(g, wingsUp, t = DEFAULT_BIRD) {
  const eye = t.eye ?? EYE_DEFAULT;
  g.layer('tail');
  g.fillStyle(t.body, 1);
  if (t.longTail) { g.fillTriangle(0, 3, 5, 4, 5, 7); g.fillTriangle(0, 11, 5, 6, 5, 9); } // longer forked tail
  else g.fillTriangle(1, 5, 5, 4, 5, 9);
  g.layer('body');
  g.fillStyle(t.body, 1); g.fillEllipse(8, 7, 9, 5);
  g.fillStyle(t.belly, 0.9); g.fillEllipse(8, 8, 6, 3);
  g.layer('crest');
  if (t.crest) { g.fillStyle(t.body, 1); g.fillTriangle(11, 4, 13, 1, 14, 5); } // raised head-tuft
  g.layer('head');
  g.fillStyle(t.body, 1); g.fillCircle(12, 6, 2.3);
  g.layer('beak');
  g.fillStyle(t.beak, 1); g.fillTriangle(14, 5, 16, 6, 14, 7);
  g.layer('eye');
  g.fillStyle(eye, 1); g.fillRect(12, 5, 1, 1);
  g.layer('wing');
  g.fillStyle(t.wing, 1);
  if (wingsUp) g.fillTriangle(6, 6, 10, 0, 3, 2);
  else g.fillTriangle(6, 7, 10, 12, 3, 11);
}

function drawBirdPeck(g, headDown, t = DEFAULT_BIRD) {
  const eye = t.eye ?? EYE_DEFAULT;
  g.layer('legs');
  g.fillStyle(t.beak, 1); g.fillRect(6, 9, 1, 2); g.fillRect(9, 9, 1, 2);
  g.layer('tail');
  g.fillStyle(t.body, 1);
  if (t.longTail) { g.fillTriangle(0, 2, 5, 3, 5, 6); g.fillTriangle(0, 10, 5, 5, 5, 8); }
  else g.fillTriangle(1, 4, 5, 3, 5, 8);
  g.layer('body');
  g.fillStyle(t.body, 1); g.fillEllipse(8, 7, 9, 6);
  g.fillStyle(t.belly, 0.9); g.fillEllipse(8, 8, 6, 4);
  g.layer('wing');
  g.fillStyle(t.wing, 1); g.fillEllipse(6, 7, 5, 4);
  g.layer('head');
  const hy = headDown ? 9 : 4;
  g.layer('crest');
  if (t.crest) { g.fillStyle(t.body, 1); g.fillTriangle(11, hy - 2, 13, hy - 5, 14, hy - 1); }
  g.layer('head');
  g.fillStyle(t.body, 1); g.fillCircle(12, hy, 2.3);
  g.layer('beak');
  g.fillStyle(t.beak, 1); g.fillTriangle(14, hy, 16, hy + 1, 14, hy + 1);
  g.layer('eye');
  g.fillStyle(eye, 1); g.fillRect(12, hy - 1, 1, 1);
}

// Texture/animation key helpers so the spawner and art builder agree on names.
export const birdTexKey = (id, pose, frame) => `bird_${id}_${pose}_${frame}`;
export const birdAnimKey = (id, pose) => `bird_${id}_${pose}`;

export function buildBirdTextures(scene) {
  const W = BIRD_W * ART_SCALE, H = BIRD_H * ART_SCALE;
  // Build a full 4-frame texture set per bird type (data-driven variety, #220).
  for (const t of BIRD_TYPES) {
    gen(scene, birdTexKey(t.id, 'fly', 0), W, H, (g) => drawBirdFly(scaledGraphics(g), true, t));
    gen(scene, birdTexKey(t.id, 'fly', 1), W, H, (g) => drawBirdFly(scaledGraphics(g), false, t));
    gen(scene, birdTexKey(t.id, 'peck', 0), W, H, (g) => drawBirdPeck(scaledGraphics(g), false, t));
    gen(scene, birdTexKey(t.id, 'peck', 1), W, H, (g) => drawBirdPeck(scaledGraphics(g), true, t));
  }
  // Back-compat aliases: the original un-prefixed keys map to the default sparrow, so
  // any code/tests that still reference `bird_fly_0` keep working.
  gen(scene, 'bird_fly_0', W, H, (g) => drawBirdFly(scaledGraphics(g), true));
  gen(scene, 'bird_fly_1', W, H, (g) => drawBirdFly(scaledGraphics(g), false));
  gen(scene, 'bird_peck_0', W, H, (g) => drawBirdPeck(scaledGraphics(g), false));
  gen(scene, 'bird_peck_1', W, H, (g) => drawBirdPeck(scaledGraphics(g), true));
}

// ── Hummingbird (#226) ─────────────────────────────────────────────────────────
// A tiny darting nectar-feeder: an iridescent emerald body, a rosy throat gorget, a
// long needle beak, and a fast wing-buzz (two blur poses swapped quickly so the wings
// read as a motion smear). Much smaller than the songbirds. It hovers near flowers and
// the nectar feeder and darts off in a blink (paddock/birdEcosystem.js). Faces RIGHT,
// origin (0.5, 0.5) — it hovers mid-air rather than perching on the ground.
export const HUMMER_W = 18, HUMMER_H = 12;
const H_BODY = 0x2fae72, H_BACK = 0x1c7a4e, H_BELLY = 0x9ad8b4, H_GORGET = 0xd83a6a,
  H_BEAK = 0x20201c, H_WING = 0x4a5560, H_EYE = 0x0a0f0a;

function drawHummingbird(g, wingsUp) {
  g.layer('tail');
  g.fillStyle(H_BACK, 1); g.fillTriangle(1, 5, 6, 4, 6, 8); // short fan tail
  g.layer('body');
  g.fillStyle(H_BODY, 1);  g.fillEllipse(8, 6, 8, 5);
  g.fillStyle(H_BACK, 0.8); g.fillEllipse(7, 5, 6, 2.5);   // shaded back
  g.fillStyle(H_BELLY, 0.9); g.fillEllipse(8, 7, 5, 2.5);  // pale belly
  g.layer('gorget');
  g.fillStyle(H_GORGET, 1); g.fillEllipse(11, 7, 3, 2);    // rosy throat patch
  g.layer('head');
  g.fillStyle(H_BODY, 1); g.fillCircle(12, 5, 2.2);
  g.layer('beak');
  g.fillStyle(H_BEAK, 1); g.fillRect(13, 5, 5, 1);         // long needle beak
  g.layer('eye');
  g.fillStyle(H_EYE, 1); g.fillRect(12, 4, 1, 1);
  g.layer('wing');
  // The wing buzz: a translucent blurred smear, up on one frame and down/forward on the
  // other, so alternating them reads as a fast beat.
  g.fillStyle(H_WING, 0.5);
  if (wingsUp) { g.fillTriangle(7, 5, 13, 0, 3, 1); g.fillEllipse(8, 2, 9, 3); }
  else         { g.fillTriangle(7, 6, 13, 11, 3, 10); g.fillEllipse(8, 10, 9, 3); }
}

export function buildHummingbirdTextures(scene) {
  const W = HUMMER_W * ART_SCALE, H = HUMMER_H * ART_SCALE;
  gen(scene, 'hummer_0', W, H, (g) => drawHummingbird(scaledGraphics(g), true));
  gen(scene, 'hummer_1', W, H, (g) => drawHummingbird(scaledGraphics(g), false));
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

// ── Detailed raccoon (#181 redraw draft) ──────────────────────────────────────
// Built like the barnyard quadrupeds: makeLeg shin+paw legs, stacked hi/mid/shad body
// rects, and a rect neck — same construction language as the pig/dog. Character detail
// (banded tail, guard-hair flecks, bandit mask) stays the same.
const raccoonLegM = makeLeg({ topY: 13, w: 3, h: 3, hoofColor: 0x17181c, hoofY: 16, hoofW: 4, hoofDX: -1, hoofH: 1 });

function raccoonLeg2(g, x, lift) {
  g.fillStyle(0x2c2f35, 1); g.fillRect(x, 13 - lift, 2, 4 + lift);
  g.fillStyle(0x3d4047, 1); g.fillRect(x, 13 - lift, 1, 2);
  g.fillStyle(0x17181c, 1); g.fillRect(x - 1, 16, 3, 1);
  g.fillStyle(0x2c2f35, 1); g.fillRect(x, 16, 1, 1);
}

function drawRaccoon2(g, [l0, l1, l2, l3], bob = 0) {
  const y = bob;
  const FUR = 0x8d8f94, LO = 0x686b71, HI = 0xb4b6bb, GUARD = 0x4a4d54, DARK = 0x2c2f35,
    MASK = 0x1c1d21, PALE = 0xdedfe1, PALElo = 0xb9bbbf, NOSE = 0x120f0c, EARP = 0xc59a9a, SHINE = 0xf2efe6;

  // ── Ringed bushy tail (left) ──
  g.layer('tail');
  g.fillStyle(MASK, 1);   g.fillRect(0, 11 + y, 3, 5);
  g.fillStyle(PALE, 1);   g.fillRect(2, 10 + y, 2, 6);
  g.fillStyle(DARK, 1);   g.fillRect(4, 10 + y, 2, 6);
  g.fillStyle(PALElo, 1); g.fillRect(5, 9 + y, 2, 7);
  g.fillStyle(FUR, 1);    g.fillRect(6, 9 + y, 3, 7);
  g.fillStyle(LO, 1);     g.fillRect(8, 10 + y, 1, 5);
  g.fillStyle(DARK, 1);   g.fillRect(1, 10 + y, 1, 1); g.fillRect(3, 9 + y, 1, 1); g.fillRect(0, 15 + y, 1, 1);
  g.fillStyle(PALE, 1);   g.fillRect(2, 9 + y, 1, 1);  g.fillRect(4, 16 + y, 1, 1);

  // far legs (behind the body)
  g.layer('legs_far');
  raccoonLegM(g, 8, l0, DARK, y); raccoonLegM(g, 17, l2, DARK, y);

  // ── Body ──
  g.layer('body');
  g.fillStyle(FUR, 1);   g.fillRect(6, 8 + y, 14, 6);
  g.fillStyle(HI, 1);    g.fillRect(6, 8 + y, 14, 2);
  g.fillStyle(LO, 1);    g.fillRect(6, 12 + y, 14, 2);
  g.fillStyle(FUR, 1);   g.fillRect(5, 10 + y, 1, 3);
  g.fillStyle(GUARD, 1);
  g.fillRect(7, 8 + y, 11, 1);
  g.fillRect(10, 9 + y, 1, 1); g.fillRect(13, 9 + y, 1, 1); g.fillRect(15, 9 + y, 1, 1);
  g.fillStyle(HI, 1);
  g.fillRect(9, 13 + y, 1, 1); g.fillRect(13, 13 + y, 1, 1);

  // ── Neck ──
  g.layer('neck');
  g.fillStyle(FUR, 1);  g.fillRect(18, 9 + y, 3, 4);
  g.fillStyle(HI, 1);   g.fillRect(18, 9 + y, 3, 1);
  g.fillStyle(LO, 1);   g.fillRect(18, 12 + y, 3, 1);

  // near legs (over the body)
  g.layer('legs_near');
  raccoonLegM(g, 10, l1, 0x3d4047, y); raccoonLegM(g, 19, l3, 0x3d4047, y);

  // ── Head ──
  g.layer('head');
  g.fillStyle(FUR, 1);  g.fillRect(19, 6 + y, 5, 6); g.fillRect(20, 5 + y, 3, 1);
  g.fillStyle(HI, 1);   g.fillRect(20, 6 + y, 3, 1);

  // ── Snout ──
  g.layer('snout');
  g.fillStyle(PALElo, 1); g.fillRect(24, 8 + y, 2, 2); g.fillRect(23, 9 + y, 3, 2);
  g.fillStyle(PALE, 1);   g.fillRect(23, 10 + y, 2, 1);
  g.fillStyle(NOSE, 1);   g.fillRect(25, 8 + y, 1, 1); g.fillRect(24, 9 + y, 1, 1);

  // ── Ears ──
  g.layer('ears');
  g.fillStyle(FUR, 1);   g.fillRect(19, 4 + y, 2, 2); g.fillRect(18, 5 + y, 1, 1); g.fillRect(22, 4 + y, 2, 2); g.fillRect(24, 5 + y, 1, 1);
  g.fillStyle(EARP, 1);  g.fillRect(19, 5 + y, 1, 1); g.fillRect(23, 5 + y, 1, 1);
  g.fillStyle(GUARD, 1); g.fillRect(19, 4 + y, 1, 1); g.fillRect(23, 4 + y, 1, 1);

  // ── Bandit mask ──
  g.layer('mask');
  g.fillStyle(PALE, 1); g.fillRect(19, 6 + y, 6, 1);
  g.fillStyle(MASK, 1); g.fillRect(20, 7 + y, 5, 2); g.fillRect(19, 8 + y, 1, 1); g.fillRect(24, 7 + y, 1, 1);
  g.fillStyle(SHINE, 1); g.fillRect(21, 7 + y, 1, 1); g.fillRect(23, 7 + y, 1, 1);
}

// ── Hybrid raccoon draft — soft edges + pixel detail (#181) ──────────────────
// Same character as drawRaccoon2 but outer silhouette built from curves (ellipses /
// circles / triangles) so the canvas anti-aliases the rim. Interior fur detail stays
// as rects. The AA bakes into the 4× texture and becomes sub-pixel at the 0.5× display
// scale — smooth edge, pixel-art feel inside.
function drawRaccoon3(g, [l0, l1, l2, l3], bob = 0) {
  const y = bob;
  const FUR = 0x8d8f94, LO = 0x686b71, HI = 0xb4b6bb, GUARD = 0x4a4d54, DARK = 0x2c2f35,
    MASK = 0x1c1d21, PALE = 0xdedfe1, PALElo = 0xb9bbbf, NOSE = 0x120f0c, EARP = 0xc59a9a, SHINE = 0xf2efe6;

  // ── Tail: banded rings from overlapping ellipses → soft shape; stray rects = fur tufts
  g.fillStyle(MASK, 1);  g.fillEllipse(3,   12 + y, 6,   8);    // dark tip
  g.fillStyle(PALE, 1);  g.fillEllipse(5,   11.5 + y, 5, 8);    // pale ring
  g.fillStyle(DARK, 1);  g.fillEllipse(6,   11 + y, 4,   8);    // dark ring
  g.fillStyle(FUR, 1);   g.fillEllipse(8,   10.5 + y, 5, 8);    // rump join
  g.fillStyle(DARK, 1);  g.fillRect(0, 9 + y, 1, 2); g.fillRect(1, 15 + y, 1, 1); // stray tufts
  g.fillStyle(PALE, 1);  g.fillRect(3, 8 + y, 1, 1); g.fillRect(5, 16 + y, 1, 1);
  g.fillStyle(LO, 1);    g.fillRect(8, 10 + y, 1, 5);            // shade at join

  // far legs (behind body)
  raccoonLeg2(g, 9, l0); raccoonLeg2(g, 18, l2);

  // ── Body: smooth ellipse silhouette + rect fur/guard-hair detail on top
  g.fillStyle(FUR, 1);  g.fillEllipse(13, 10.5 + y, 15, 8);
  g.fillStyle(GUARD, 1);
  g.fillRect(8, 8 + y, 9, 1); g.fillRect(9, 7 + y, 7, 1);        // dark back
  g.fillRect(10, 9 + y, 1, 1); g.fillRect(13, 8 + y, 1, 1); g.fillRect(15, 9 + y, 1, 1); // flecks
  g.fillStyle(LO, 1);   g.fillRect(8, 14 + y, 11, 1);             // belly shadow
  g.fillStyle(HI, 1);   g.fillRect(9, 13 + y, 9,  1);             // pale underside
  g.fillRect(10, 12 + y, 1, 1); g.fillRect(14, 12 + y, 1, 1);     // pale flecks

  // near legs (over body)
  raccoonLeg2(g, 11, l1); raccoonLeg2(g, 20, l3);

  // ── Head: smooth circle skull; detail rects on top
  g.fillStyle(FUR, 1); g.fillCircle(21, 8.5 + y, 4);
  g.fillStyle(HI, 1);  g.fillRect(20, 6 + y, 3, 1);               // crown highlight

  // Ears — triangles for soft pointy shape, rects for pink inner + dark tip
  g.fillStyle(FUR, 1);   g.fillTriangle(19, 5 + y, 20.5, 2 + y, 22, 6 + y);
  g.fillStyle(EARP, 1);  g.fillRect(20, 4 + y, 1, 1);
  g.fillStyle(GUARD, 1); g.fillRect(19, 3 + y, 1, 1);
  g.fillStyle(FUR, 1);   g.fillTriangle(22, 5 + y, 23.5, 2 + y, 25, 6 + y);
  g.fillStyle(EARP, 1);  g.fillRect(23, 4 + y, 1, 1);
  g.fillStyle(GUARD, 1); g.fillRect(22, 3 + y, 1, 1);

  // Stepped snout (rects keep the pointy silhouette)
  g.fillStyle(PALElo, 1); g.fillRect(24, 8 + y, 2, 2); g.fillRect(23, 9 + y, 3, 2);
  g.fillStyle(PALE, 1);   g.fillRect(23, 10 + y, 2, 1);
  g.fillStyle(NOSE, 1);   g.fillRect(25, 8 + y, 1, 1); g.fillRect(24, 9 + y, 1, 1);

  // ── Bandit mask: pale brow, dark wrap, bright eye shines
  g.fillStyle(PALE, 1);  g.fillRect(19, 6 + y, 6, 1);
  g.fillStyle(MASK, 1);  g.fillRect(20, 7 + y, 5, 2); g.fillRect(19, 8 + y, 1, 1); g.fillRect(24, 7 + y, 1, 1);
  g.fillStyle(SHINE, 1); g.fillRect(21, 7 + y, 1, 1); g.fillRect(23, 7 + y, 1, 1);
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
  RACCOON_FRAMES.forEach((f) => {
    gen(scene, `raccoon_${f.name}`, RACC_W * ART_SCALE, RACC_H * ART_SCALE,
      (g) => drawRaccoon2(scaledGraphics(g), f.legs, f.bob));
  });
}

// One call BootScene makes for all ambient wildlife textures (parallel to the
// world/player builders — these aren't a roster species).
export function buildWildlifeTextures(scene) {
  buildFishTextures(scene);
  buildBirdTextures(scene);
  buildHummingbirdTextures(scene);
  buildRaccoonTextures(scene);
}


// TEMP comparison scaffolding: the OLD 1× (non-super-sampled) variants under `*Old`
// keys, built ONLY for the Art Preview gallery so the owner can A/B the soft AA'd edges
// against the crisp super-sampled versions. Not used in-world. Remove once the look is
// settled (these draw fns are the same — only the 1× vs ART_SCALE grid differs).
export function buildWildlifeOldTextures(scene) {
  // These "Old" textures draw at 1× (no scaledGraphics wrapper) so the art-preview
  // can A/B crisp vs super-sampled. The draw fns have g.layer() calls for the dissect
  // tool, but raw Phaser Graphics has no .layer() — shim a no-op so they don't throw.
  const L = (g) => (g.layer ??= () => {}, g);
  gen(scene, 'fishOld_0', FISH_W, FISH_H, (g) => drawFish(L(g), 0));
  gen(scene, 'fishOld_1', FISH_W, FISH_H, (g) => drawFish(L(g), 1));
  gen(scene, 'birdOld_fly_0', BIRD_W, BIRD_H, (g) => drawBirdFly(L(g), true));
  gen(scene, 'birdOld_fly_1', BIRD_W, BIRD_H, (g) => drawBirdFly(L(g), false));
  gen(scene, 'birdOld_peck_0', BIRD_W, BIRD_H, (g) => drawBirdPeck(L(g), false));
  gen(scene, 'birdOld_peck_1', BIRD_W, BIRD_H, (g) => drawBirdPeck(L(g), true));
  RACCOON_FRAMES.forEach((f) => {
    gen(scene, `raccoon5_${f.name}`, RACC_W * ART_SCALE, RACC_H * ART_SCALE,
      (g) => drawRaccoon2(scaledGraphics(g), f.legs, f.bob));
  });
}
