// Procedural pixel-art horse sprite. Draws the elegant side-view body from a coat's
// 3-tone ramp into Phaser textures: 2 idle frames (breathing bob) and 4 walk frames
// (stepping legs). These are the "placeholder" sprites from the plan — swap in
// hand-drawn art later by replacing these texture keys. Shares the texture-snapshot
// helper (`gen`) and the simple two-rect leg (`makeLeg`) from _frames.js; the horse's
// own `leg` is kept local because it adds socks and feathering.

import { gen, makeLeg, scaledGraphics, ART_SCALE } from './_frames.js';
import { dappleCircles, roanFlecks, pintoSpec, appaloosaSpec } from '../data/species/horse/patterns.js';

export const FRAME_W = 64;
export const FRAME_H = 54;

const WHITE = 0xf4efe6;
const SOCK = 0xf0ead0;
const EAR_PINK = 0xe0a890;
// Coat-agnostic shading overlays (Stage 2 detail, #2). Drawn as low-alpha white/black
// on top of the 3-tone coat so every coat colour gets soft rounded form for free. The
// hi-res grid (ART_SCALE) lets these be thin (sub-design-pixel) so they read as a
// gradient, not a band.
const HILITE = 0xffffff;
const SHADE  = 0x000000;

// Face markings (real-world: star / stripe / snip / blaze), white on the face of a
// right-facing horse (#2). A blaze is the broad connected band; otherwise star,
// stripe, and snip are drawn independently per flag.
function faceMarkings(g, mk, bob) {
  g.fillStyle(WHITE, 1);
  if (mk.blaze) {
    g.fillRect(51, 4 + bob, 2, 2);   // forehead
    g.fillRect(52, 6 + bob, 2, 2);
    g.fillRect(54, 8 + bob, 2, 2);
    g.fillRect(56, 9 + bob, 3, 2);   // down onto the muzzle
    return;
  }
  if (mk.star) g.fillRect(50, 3 + bob, 3, 3);            // forehead spot (bigger)
  if (mk.stripe) {                                        // thin line down the nose
    g.fillRect(53, 6 + bob, 1, 1); g.fillRect(54, 7 + bob, 1, 1);
    g.fillRect(55, 8 + bob, 1, 1); g.fillRect(56, 9 + bob, 1, 1);
  }
  if (mk.snip) g.fillRect(58, 10 + bob, 2, 2);           // muzzle spot (bigger)
}

// The eating head sits low-right in a different pose, so face markings need their
// own coordinates there (otherwise a star/blaze vanishes when a horse eats).
function faceMarkingsEat(g, mk, headY) {
  g.fillStyle(WHITE, 1);
  if (mk.blaze) {
    g.fillRect(48, headY, 3, 2);
    g.fillRect(50, headY + 3, 3, 2);
    g.fillRect(53, headY + 7, 4, 2);
    return;
  }
  if (mk.star) g.fillRect(48, headY, 3, 2);
  if (mk.stripe) { g.fillRect(51, headY + 3, 1, 2); g.fillRect(53, headY + 6, 1, 2); }
  if (mk.snip) g.fillRect(57, headY + 9, 2, 1);
}

// Whole-body PATTERNS (pinto / appaloosa / dapples / roan), drawn over the body in
// any pose. `yo` is the vertical offset for that pose (bob, plus the sleep drop).
// Centralized so patterns no longer disappear when a horse eats or sleeps. Each
// pattern's geometry is chosen by its numbered variant (#139); see patterns.js.
function bodyPatterns(g, coat, yo) {
  const b = coat.body;
  const mk = coat.markings || {};

  if (mk.pinto) {
    const { patches, shadows } = pintoSpec(mk.pintoVar ?? 1);
    g.fillStyle(WHITE, 1);
    for (const [x, y, w, h] of patches) g.fillRect(x, y + yo, w, h);
    g.fillStyle(0xe8e0d0, 1); // slight shadow edge on patches
    for (const [x, y, w, h] of shadows) g.fillRect(x, y + yo, w, h);
  }

  if (mk.appaloosa) {
    const { blanket, spots } = appaloosaSpec(mk.appaloosaVar ?? 1);
    g.fillStyle(WHITE, 1);
    for (const [x, y, w, h] of blanket) g.fillRect(x, y + yo, w, h); // spotted blanket
    g.fillStyle(0x352620, 1);                                        // dark leopard spots
    for (const [sx, sy] of spots) g.fillRect(sx, sy + yo, 2, 2);
  }

  if (mk.dapples) {
    g.fillStyle(b.hi, 0.6);
    for (const [x, y, r] of dappleCircles(mk.dapplesVar ?? 1)) g.fillCircle(x, y + yo, r);
  }

  if (mk.roan) {
    g.fillStyle(WHITE, 0.45);
    for (const [sx, sy] of roanFlecks(mk.roanVar ?? 1)) g.fillRect(sx, sy + yo, 1, 1);
  }
}

// Dun-gene dorsal stripe: a thin dark line down the spine (drawn after the body).
function drawDorsal(g, coat, yo) {
  if (!coat.dorsal) return;
  g.fillStyle(coat.points ?? coat.mane.lo, 1);
  g.fillRect(8, 18 + yo, 39, 1);
}

// Leg lift patterns per frame: [hindFar, hindNear, foreFar, foreNear]
const IDLE_LEGS = [0, 0, 0, 0];
const WALK_LEGS = [
  [0, 0, 0, 0],
  [3, 0, 0, 3],
  [0, 0, 0, 0],
  [0, 3, 3, 0]
];

// `legMark` is undefined | 'sock' (short) | 'stocking' (tall). `sockTone` is the
// sock/stocking colour (white by default, or black, #141). `points` (optional)
// darkens the lower leg — real bays/buckskins/duns have black points; it's
// independently colourable now (#141). Sock/stocking is drawn over the points.
function leg(g, x, lift, tone, hoof, legMark, sockTone = SOCK, feather, points, offsetY = 0) {
  const topY = 35 + offsetY;
  const fullH = 15;
  const h = fullH - lift;
  g.fillStyle(tone, 1);
  g.fillRect(x, topY, 4, h);
  if (points !== undefined) {
    const pH = Math.min(h, 9);
    g.fillStyle(points, 1);
    g.fillRect(x, topY + h - pH, 4, pH);
  }
  if (legMark) {
    const sH = Math.min(h, legMark === 'stocking' ? 11 : 6);
    g.fillStyle(sockTone, 1);
    g.fillRect(x, topY + h - sH, 4, sH);
  }
  // Cylindrical shading: a soft highlight down the front (viewer-facing) edge and a
  // shadow down the back, so the leg reads as round rather than a flat bar.
  g.fillStyle(HILITE, 0.12); g.fillRect(x + 3, topY, 1, h);
  g.fillStyle(SHADE, 0.13);  g.fillRect(x, topY, 0.75, h);
  // Hoof — small shine on top + a contact shadow at the ground.
  g.fillStyle(hoof, 1);
  g.fillRect(x, topY + h, 4, 3);
  g.fillStyle(HILITE, 0.18); g.fillRect(x + 0.5, topY + h + 0.25, 1.25, 0.75);
  g.fillStyle(SHADE, 0.16);  g.fillRect(x, topY + h + 2.25, 4, 0.75);
  if (feather) {
    // Feathering matches the bottom of the leg (#155): white over a sock/stocking,
    // dark over dark legs ("points"), otherwise the leg's own tone. A fluffy tuft
    // that widens toward the ground, broken into tapering strands so it looks wispy.
    const ft = legMark ? sockTone : (points !== undefined ? points : tone);
    g.fillStyle(ft, 1);
    g.fillRect(x - 1.5, topY + h - 5, 7, 2.5);   // mid tuft
    g.fillRect(x - 2, topY + h - 2.5, 8, 2.25);  // wide base fringe
    g.fillRect(x - 0.5, topY + h - 1, 2.5, 2.5); // inner strand
    g.fillRect(x + 3, topY + h - 0.75, 2, 2.25); // outer strand
  }
}

function drawHorse(g, coat, bob, legLift) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // --- legs first (behind body), far legs in shadow tone ---
  const feather = !!mk.feather; // feathering is on/off; colour derives per-leg (#155)
  const lm = mk.legs || {};
  const pts = coat.points;
  const sockTone = SOCK; // socks/stockings are always white (#153)
  leg(g, 7,  legLift[0], b.lo,  coat.hoof, lm.hindFar,  sockTone, feather, pts); // hind far
  leg(g, 38, legLift[2], b.lo,  coat.hoof, lm.foreFar,  sockTone, feather, pts); // fore far
  leg(g, 13, legLift[1], b.mid, coat.hoof, lm.hindNear, sockTone, feather, pts); // hind near
  leg(g, 44, legLift[3], b.mid, coat.hoof, lm.foreNear, sockTone, feather, pts); // fore near

  // --- tail ---
  g.fillStyle(m.mid, 1); g.fillRect(6, 22 + bob, 2, 4);
  g.fillStyle(m.lo, 1); g.fillRect(4, 25 + bob, 2, 7);
  g.fillStyle(m.mid, 1); g.fillRect(3, 31 + bob, 2, 7);
  g.fillStyle(m.lo, 1); g.fillRect(4, 37 + bob, 2, 5);

  // --- rump + body (3-tone bands) ---
  // Rump left edge is rounded by trimming top and bottom corners.
  g.fillStyle(b.mid, 1);
  g.fillRect(8, 20 + bob, 8, 16);   // main rump bulk
  g.fillRect(7, 22 + bob, 1, 12);   // left strip, corners bare = rounded silhouette
  g.fillStyle(b.hi, 1);
  g.fillRect(8, 18 + bob, 8, 4);    // top highlight
  g.fillRect(7, 20 + bob, 1, 2);    // left highlight patch
  // Body — chest (right edge) rounded by trimming top and bottom corners.
  g.fillStyle(b.mid, 1);
  g.fillRect(12, 20 + bob, 35, 16);   // main body
  g.fillRect(47, 22 + bob, 1, 11);    // right strip, corners bare = rounded chest
  g.fillStyle(b.hi, 1);
  g.fillRect(12, 18 + bob, 35, 5);    // top highlight
  g.fillRect(47, 21 + bob, 1, 2);     // right highlight patch
  g.fillStyle(b.lo, 1);
  g.fillRect(12, 33 + bob, 35, 4);    // belly shadow
  g.fillRect(47, 33 + bob, 1, 2);     // right shadow patch

  // Rounded-barrel shading (Stage 2): a bright sheen along the topline fading to a
  // soft shadow under the belly, plus a curved highlight on the haunch, so the body
  // reads as a 3-D barrel instead of a flat slab. Coat-agnostic alpha overlays.
  g.fillStyle(HILITE, 0.10);
  g.fillRect(13, 18.5 + bob, 33, 1.25);  // back topline sheen
  g.fillRect(9, 18.5 + bob, 6, 1.25);    // rump topline sheen
  g.fillRect(9.5, 22 + bob, 4, 5);       // rounded haunch highlight
  g.fillStyle(SHADE, 0.07);
  g.fillRect(12, 31 + bob, 35, 1.5);     // lower-barrel soft shade
  g.fillStyle(SHADE, 0.11);
  g.fillRect(12, 34.5 + bob, 34, 1.5);   // belly core shadow

  // dorsal stripe (dun gene) + whole-body patterns (pinto / appaloosa / dapples / roan)
  drawDorsal(g, coat, bob);
  bodyPatterns(g, coat, bob);

  // --- neck ---
  g.fillStyle(b.mid, 1); g.fillRect(42, 14 + bob, 8, 12);
  g.fillStyle(b.mid, 1); g.fillRect(45, 8 + bob, 8, 8);
  g.fillStyle(b.hi, 1); g.fillRect(46, 8 + bob, 3, 18);

  // --- head ---
  g.fillStyle(b.mid, 1); g.fillRect(47, 4 + bob, 14, 9);   // skull
  g.fillStyle(b.hi, 1);  g.fillRect(47, 4 + bob, 14, 2);   // top highlight
  g.fillStyle(b.lo, 1);  g.fillRect(55, 8 + bob, 7, 4);    // muzzle (flush with skull)
  g.fillStyle(b.mid, 1); g.fillRect(48, 0 + bob, 3, 6);    // ear (taller, more upright)
  g.fillStyle(EAR_PINK, 1); g.fillRect(49, 1 + bob, 1, 4); // ear inner
  // nostril
  g.fillStyle(coat.hoof, 0.6); g.fillRect(60, 10 + bob, 1, 1);

  // face markings (star / stripe / snip / blaze), drawn before the eye so the eye
  // stays on top
  faceMarkings(g, mk, bob);

  // eye — upper-lid shadow + a small catch-light glint
  g.fillStyle(coat.eye, 1);  g.fillRect(50, 7 + bob, 2, 2);
  g.fillStyle(SHADE, 0.30);  g.fillRect(50, 7 + bob, 2, 0.5);
  g.fillStyle(HILITE, 0.85); g.fillRect(50.25, 7.5 + bob, 0.5, 0.5);

  // --- mane (over neck) ---
  g.fillStyle(m.mid, 1); g.fillRect(43, 3 + bob, 3, 6);
  g.fillStyle(m.lo, 1); g.fillRect(41, 9 + bob, 3, 8);
  g.fillStyle(m.mid, 1); g.fillRect(40, 16 + bob, 3, 9);
  g.fillStyle(m.lo, 1); g.fillRect(40, 24 + bob, 2, 6);
  // A soft highlight ribbon down the front of the mane gives it a bit of sheen
  // without busying up the blocky locks.
  g.fillStyle(HILITE, 0.10);
  g.fillRect(43.25, 3.5 + bob, 0.6, 5);
  g.fillRect(41.25, 9.5 + bob, 0.6, 7);
  g.fillRect(40.25, 16.5 + bob, 0.6, 7);
  // Pinto: optionally carry the white pattern into the lower mane + tail tip for a
  // two-tone mane (#144, opt-in via mk.pintoMane). Overpaint the lower segments.
  if (mk.pinto && mk.pintoMane) {
    g.fillStyle(WHITE, 1);
    g.fillRect(40, 16 + bob, 3, 9); g.fillRect(40, 24 + bob, 2, 6); // lower mane
    g.fillRect(3, 31 + bob, 2, 7);  g.fillRect(4, 37 + bob, 2, 5);  // tail tip
  }
}

// Horse sleeping: laid out on side, head and neck relaxed.
// `dy` drops the whole pose toward the bottom of the frame so the resting
// horse sits on the ground at the sprite anchor instead of hovering above it.
function drawHorseSleep(g, coat, bob) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};
  const dy = 11;

  // Legs tucked/bent (very short — sleeping position)
  const lm = mk.legs || {};
  const pts = coat.points;
  const sockTone = SOCK; // socks/stockings are always white (#153)
  leg(g, 7,  10, b.lo,  coat.hoof, lm.hindFar,  sockTone, undefined, pts, dy); // hind far (folded)
  leg(g, 38, 10, b.lo,  coat.hoof, lm.foreFar,  sockTone, undefined, pts, dy); // fore far (folded)
  leg(g, 13, 10, b.mid, coat.hoof, lm.hindNear, sockTone, undefined, pts, dy); // hind near (folded)
  leg(g, 44, 10, b.mid, coat.hoof, lm.foreNear, sockTone, undefined, pts, dy); // fore near (folded)

  // Tail relaxed
  g.fillStyle(m.mid, 1); g.fillRect(6, 22 + bob + dy, 2, 2);
  g.fillStyle(m.lo, 1);  g.fillRect(4, 24 + bob + dy, 2, 4);
  g.fillStyle(m.mid, 1); g.fillRect(3, 27 + bob + dy, 2, 3);

  // Rump — flatter/lower, showing side view
  g.fillStyle(b.mid, 1);
  g.fillRect(8, 22 + bob + dy, 8, 12);   // main rump
  g.fillRect(7, 24 + bob + dy, 1, 8);    // left strip
  g.fillStyle(b.hi, 1);
  g.fillRect(8, 20 + bob + dy, 8, 3);    // top highlight
  g.fillRect(7, 22 + bob + dy, 1, 1);    // left highlight

  // Body — horizontal, relaxed
  g.fillStyle(b.mid, 1);
  g.fillRect(12, 22 + bob + dy, 35, 12);   // main body (shorter height)
  g.fillRect(47, 24 + bob + dy, 1, 8);     // right strip
  g.fillStyle(b.hi, 1);
  g.fillRect(12, 20 + bob + dy, 35, 3);    // top highlight
  g.fillRect(47, 23 + bob + dy, 1, 1);     // right highlight
  g.fillStyle(b.lo, 1);
  g.fillRect(12, 32 + bob + dy, 35, 2);    // belly shadow (thinner)

  // Soft rounded shading (lying pose) — lighter than the standing barrel.
  g.fillStyle(HILITE, 0.09); g.fillRect(13, 20.5 + bob + dy, 33, 1.25);
  g.fillStyle(SHADE, 0.10);  g.fillRect(12, 32.5 + bob + dy, 34, 1.25);

  drawDorsal(g, coat, bob + dy);
  bodyPatterns(g, coat, bob + dy);

  // Neck angled back/down (horse on its side)
  g.fillStyle(b.mid, 1);
  g.fillRect(42, 18 + bob + dy, 8, 8);   // base
  g.fillRect(43, 24 + bob + dy, 8, 6);   // middle (slopes down)
  g.fillStyle(b.hi, 1);
  g.fillRect(43, 18 + bob + dy, 3, 8);
  g.fillRect(44, 24 + bob + dy, 3, 5);

  // Head relaxed/resting
  const headY = 28 + bob + dy;
  g.fillStyle(b.mid, 1); g.fillRect(48, headY, 12, 7);   // skull
  g.fillStyle(b.hi, 1);  g.fillRect(48, headY, 12, 1.5); // top highlight
  g.fillStyle(b.lo, 1);  g.fillRect(54, headY + 2, 6, 3); // muzzle
  // Ear flopped back (sleeping)
  g.fillStyle(b.mid, 1);     g.fillRect(48, headY - 2, 2, 3);
  g.fillStyle(EAR_PINK, 1);  g.fillRect(49, headY - 1, 1, 2);
  // Nostril
  g.fillStyle(coat.hoof, 0.6); g.fillRect(58, headY + 3, 1, 1);
  // Closed/sleepy eye (smaller, different position)
  g.fillStyle(coat.eye, 1);  g.fillRect(50, headY + 1, 1, 1);

  // Mane lying down
  g.fillStyle(m.mid, 1); g.fillRect(42, 18 + bob + dy, 2, 4);
  g.fillStyle(m.lo, 1);  g.fillRect(41, 22 + bob + dy, 2, 4);
  g.fillStyle(m.mid, 1); g.fillRect(40, 26 + bob + dy, 2, 3);
  if (mk.pinto && mk.pintoMane) { // optional two-tone pinto mane + tail tip (#144)
    g.fillStyle(WHITE, 1);
    g.fillRect(40, 26 + bob + dy, 2, 3); // lower mane
    g.fillRect(3, 27 + bob + dy, 2, 3);  // tail tip
  }
}

// Horse eating/drinking: head drops to ground level, body stays the same.
function drawHorseEat(g, coat, bob) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};
  const feather = !!mk.feather; // feathering is on/off; colour derives per-leg (#155)

  // Legs all planted
  const lm = mk.legs || {};
  const pts = coat.points;
  const sockTone = SOCK; // socks/stockings are always white (#153)
  leg(g, 7,  0, b.lo,  coat.hoof, lm.hindFar,  sockTone, feather, pts);
  leg(g, 38, 0, b.lo,  coat.hoof, lm.foreFar,  sockTone, feather, pts);
  leg(g, 13, 0, b.mid, coat.hoof, lm.hindNear, sockTone, feather, pts);
  leg(g, 44, 0, b.mid, coat.hoof, lm.foreNear, sockTone, feather, pts);

  // Tail
  g.fillStyle(m.mid, 1); g.fillRect(6, 22 + bob, 2, 4);
  g.fillStyle(m.lo, 1);  g.fillRect(4, 25 + bob, 2, 7);
  g.fillStyle(m.mid, 1); g.fillRect(3, 31 + bob, 2, 7);
  g.fillStyle(m.lo, 1);  g.fillRect(4, 37 + bob, 2, 5);

  // Rump
  g.fillStyle(b.mid, 1); g.fillRect(8, 20 + bob, 8, 16); g.fillRect(7, 22 + bob, 1, 12);
  g.fillStyle(b.hi, 1);  g.fillRect(8, 18 + bob, 8, 4);  g.fillRect(7, 20 + bob, 1, 2);
  // Body
  g.fillStyle(b.mid, 1); g.fillRect(12, 20 + bob, 35, 16); g.fillRect(47, 22 + bob, 1, 11);
  g.fillStyle(b.hi, 1);  g.fillRect(12, 18 + bob, 35, 5);  g.fillRect(47, 21 + bob, 1, 2);
  g.fillStyle(b.lo, 1);  g.fillRect(12, 33 + bob, 35, 4);  g.fillRect(47, 33 + bob, 1, 2);

  // Rounded-barrel shading (matches the standing pose)
  g.fillStyle(HILITE, 0.10);
  g.fillRect(13, 18.5 + bob, 33, 1.25); g.fillRect(9, 18.5 + bob, 6, 1.25); g.fillRect(9.5, 22 + bob, 4, 5);
  g.fillStyle(SHADE, 0.07);  g.fillRect(12, 31 + bob, 35, 1.5);
  g.fillStyle(SHADE, 0.11);  g.fillRect(12, 34.5 + bob, 34, 1.5);

  drawDorsal(g, coat, bob);
  bodyPatterns(g, coat, bob);

  // Neck angled downward (head eating from ground)
  g.fillStyle(b.mid, 1);
  g.fillRect(42, 20 + bob, 7, 5);   // base
  g.fillRect(44, 24 + bob, 7, 8);   // middle
  g.fillRect(46, 30 + bob, 7, 10);  // lower
  g.fillStyle(b.hi, 1);
  g.fillRect(43, 20 + bob, 3, 5);
  g.fillRect(45, 24 + bob, 3, 8);
  g.fillRect(47, 30 + bob, 3, 8);

  // Head tilted down — staggered steps so nose angles toward ground
  const headY = 37 + bob;
  // Poll / back of head (highest point)
  g.fillStyle(b.mid, 1); g.fillRect(48, headY, 4, 6);
  g.fillStyle(b.hi, 1);  g.fillRect(48, headY, 4, 1);
  // Mid skull (steps down)
  g.fillStyle(b.mid, 1); g.fillRect(50, headY + 3, 5, 6);
  g.fillStyle(b.hi, 1);  g.fillRect(50, headY + 3, 5, 1);
  // Muzzle (lowest — near ground)
  g.fillStyle(b.lo, 1);  g.fillRect(53, headY + 7, 7, 6);
  g.fillStyle(b.mid, 1); g.fillRect(53, headY + 7, 7, 2);
  // Ear pointing back/up
  g.fillStyle(b.mid, 1);     g.fillRect(48, headY - 3, 2, 4);
  g.fillStyle(EAR_PINK, 1);  g.fillRect(49, headY - 2, 1, 3);
  // Nostril at tip of muzzle
  g.fillStyle(coat.hoof, 0.6); g.fillRect(58, headY + 11, 1, 1);
  // Face markings on the lowered head (drawn before the eye so the eye stays on top)
  faceMarkingsEat(g, mk, headY);
  // Eye on upper part of skull
  g.fillStyle(coat.eye, 1);  g.fillRect(50, headY + 1, 2, 2);
  g.fillStyle(WHITE, 0.8);   g.fillRect(50, headY + 1, 1, 1);

  // Mane follows neck down
  g.fillStyle(m.mid, 1); g.fillRect(41, 20 + bob, 3, 5);
  g.fillStyle(m.lo, 1);  g.fillRect(40, 24 + bob, 3, 8);
  g.fillStyle(m.mid, 1); g.fillRect(42, 30 + bob, 3, 8);
  g.fillStyle(m.lo, 1);  g.fillRect(43, 36 + bob, 2, 4);
  if (mk.pinto && mk.pintoMane) { // optional two-tone pinto mane + tail tip (#144)
    g.fillStyle(WHITE, 1);
    g.fillRect(42, 30 + bob, 3, 8); g.fillRect(43, 36 + bob, 2, 4); // lower mane
    g.fillRect(3, 31 + bob, 2, 7);  g.fillRect(4, 37 + bob, 2, 5);  // tail tip
  }
}

// ─── Foal ────────────────────────────────────────────────────────────────────

export const FOAL_W = 40;
export const FOAL_H = 36;

const FOAL_IDLE_LEGS = [0, 0, 0, 0];
const FOAL_WALK_LEGS = [
  [0, 0, 0, 0],
  [2, 0, 0, 2],
  [0, 0, 0, 0],
  [0, 2, 2, 0],
];

// Foal leg: same simple shin+hoof shape as the barnyard quadrupeds, but hooves take
// the coat's own tone (passed per call), so reuse makeLeg with a hoof override.
const legFoal = makeLeg({ topY: 24, w: 3, h: 10, hoofY: 34 });

function drawFoalSleep(g, coat, bob) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // Legs tucked/bent (sleeping position)
  legFoal(g, 7,  7, b.lo,  0, coat.hoof);
  legFoal(g, 27, 7, b.lo,  0, coat.hoof);
  legFoal(g, 11, 7, b.mid, 0, coat.hoof);
  legFoal(g, 31, 7, b.mid, 0, coat.hoof);

  // Tail stub relaxed
  g.fillStyle(m.mid, 1); g.fillRect(5, 17 + bob, 2, 2);
  g.fillStyle(m.lo, 1);  g.fillRect(4, 19 + bob, 2, 3);

  // Rump (flatter)
  g.fillStyle(b.mid, 1); g.fillRect(7, 17 + bob, 5, 8); g.fillRect(6, 19 + bob, 1, 6);
  g.fillStyle(b.hi, 1);  g.fillRect(7, 15 + bob, 5, 2);  g.fillRect(6, 17 + bob, 1, 1);

  // Body (horizontal, relaxed)
  g.fillStyle(b.mid, 1); g.fillRect(10, 17 + bob, 22, 8); g.fillRect(32, 19 + bob, 1, 5);
  g.fillStyle(b.hi, 1);  g.fillRect(10, 15 + bob, 22, 2);  g.fillRect(32, 17 + bob, 1, 1);
  g.fillStyle(b.lo, 1);  g.fillRect(10, 23 + bob, 22, 1);

  if (mk.pinto) {
    g.fillStyle(WHITE, 1);
    g.fillRect(12, 16 + bob, 8, 6);
    g.fillRect(22, 18 + bob, 5, 4);
  }

  // Neck (relaxed, down)
  g.fillStyle(b.mid, 1); g.fillRect(29, 12 + bob, 5, 6);
  g.fillStyle(b.hi, 1);  g.fillRect(30, 12 + bob, 2, 6);

  // Head (sleeping)
  g.fillStyle(b.mid, 1); g.fillRect(30, 6 + bob, 10, 7);
  g.fillStyle(b.hi, 1);  g.fillRect(30, 6 + bob, 10, 1.5);
  g.fillStyle(b.lo, 1);  g.fillRect(35, 8 + bob, 5, 4);
  // Ear (flopped)
  g.fillStyle(b.mid, 1);     g.fillRect(30, 4 + bob, 2, 2);
  g.fillStyle(EAR_PINK, 1);  g.fillRect(31, 4 + bob, 1, 1);
  // Nostril
  g.fillStyle(coat.hoof, 0.6); g.fillRect(38, 10 + bob, 1, 1);
  // Sleepy eye
  g.fillStyle(coat.eye, 1);  g.fillRect(32, 7 + bob, 2, 1.5);

  // Mane (lying down, fluffy)
  g.fillStyle(m.mid, 1); g.fillRect(29, 6 + bob, 2, 3);
  g.fillStyle(m.lo, 1);  g.fillRect(28, 9 + bob, 2, 3);
}

function drawFoal(g, coat, bob, legLift) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // Legs — long relative to body (classic foal proportion)
  legFoal(g, 7,  legLift[0], b.lo,  0, coat.hoof);
  legFoal(g, 27, legLift[2], b.lo,  0, coat.hoof);
  legFoal(g, 11, legLift[1], b.mid, 0, coat.hoof);
  legFoal(g, 31, legLift[3], b.mid, 0, coat.hoof);

  // Tail stub
  g.fillStyle(m.mid, 1); g.fillRect(5, 17 + bob, 2, 3);
  g.fillStyle(m.lo, 1);  g.fillRect(4, 19 + bob, 2, 5);

  // Rump
  g.fillStyle(b.mid, 1); g.fillRect(7, 16 + bob, 5, 10); g.fillRect(6, 18 + bob, 1, 8);
  g.fillStyle(b.hi, 1);  g.fillRect(7, 14 + bob, 5, 3);  g.fillRect(6, 16 + bob, 1, 2);

  // Body (short and slim)
  g.fillStyle(b.mid, 1); g.fillRect(10, 16 + bob, 22, 10); g.fillRect(32, 18 + bob, 1, 6);
  g.fillStyle(b.hi, 1);  g.fillRect(10, 14 + bob, 22, 3);  g.fillRect(32, 16 + bob, 1, 2);
  g.fillStyle(b.lo, 1);  g.fillRect(10, 24 + bob, 22, 2);

  if (mk.pinto) {
    g.fillStyle(WHITE, 1);
    g.fillRect(12, 15 + bob, 8, 8);
    g.fillRect(22, 17 + bob, 5, 5);
  }

  // Neck (short and upright)
  g.fillStyle(b.mid, 1); g.fillRect(29, 9 + bob, 5, 8);
  g.fillStyle(b.hi, 1);  g.fillRect(30, 9 + bob, 2, 8);

  // Head — disproportionately large (key foal feature)
  g.fillStyle(b.mid, 1); g.fillRect(30, 2 + bob, 10, 9);
  g.fillStyle(b.hi, 1);  g.fillRect(30, 2 + bob, 10, 2);
  g.fillStyle(b.lo, 1);  g.fillRect(35, 6 + bob, 5, 5); // big muzzle
  // Ear
  g.fillStyle(b.mid, 1);     g.fillRect(30, 0 + bob, 2, 3);
  g.fillStyle(EAR_PINK, 1);  g.fillRect(31, 0 + bob, 1, 2);
  // Nostril
  g.fillStyle(coat.hoof, 0.6); g.fillRect(38, 9 + bob, 1, 1);
  // Big eye (foals have large eyes)
  g.fillStyle(coat.eye, 1);  g.fillRect(32, 4 + bob, 3, 3);
  g.fillStyle(WHITE, 0.8);   g.fillRect(32, 4 + bob, 1, 1);

  // Mane (fluffy and upright — young horses have bristly manes)
  g.fillStyle(m.mid, 1); g.fillRect(29, 2 + bob, 2, 4);
  g.fillStyle(m.lo, 1);  g.fillRect(28, 5 + bob, 2, 5);
  g.fillStyle(m.mid, 1); g.fillRect(27, 9 + bob, 2, 4);
}

export function buildFoalTextures(scene, baseKey, coat) {
  const frames = [
    { name: 'idle_0', bob: 0, legs: FOAL_IDLE_LEGS },
    { name: 'idle_1', bob: 1, legs: FOAL_IDLE_LEGS },
    { name: 'walk_0', bob: 0, legs: FOAL_WALK_LEGS[0] },
    { name: 'walk_1', bob: 1, legs: FOAL_WALK_LEGS[1] },
    { name: 'walk_2', bob: 0, legs: FOAL_WALK_LEGS[2] },
    { name: 'walk_3', bob: 1, legs: FOAL_WALK_LEGS[3] },
    { name: 'sleep_0', bob: 0, sleep: true },
    { name: 'sleep_1', bob: 1, sleep: true },
  ];
  for (const f of frames) {
    gen(scene, `${baseKey}_${f.name}`, FOAL_W * ART_SCALE, FOAL_H * ART_SCALE, g0 => {
      const g = scaledGraphics(g0);
      if (f.sleep) drawFoalSleep(g, coat, f.bob);
      else drawFoal(g, coat, f.bob, f.legs);
    });
  }
}

// Builds idle_0, idle_1, walk_0..3, eat_0..1, sleep_0..1 textures under `${baseKey}_...`.
export function buildHorseTextures(scene, baseKey, coat) {
  const frames = [
    { name: 'idle_0', bob: 0, legs: IDLE_LEGS },
    { name: 'idle_1', bob: 1, legs: IDLE_LEGS },
    { name: 'walk_0', bob: 0, legs: WALK_LEGS[0] },
    { name: 'walk_1', bob: 1, legs: WALK_LEGS[1] },
    { name: 'walk_2', bob: 0, legs: WALK_LEGS[2] },
    { name: 'walk_3', bob: 1, legs: WALK_LEGS[3] }
  ];

  frames.push(
    { name: 'eat_0', bob: 0, eat: true },
    { name: 'eat_1', bob: 1, eat: true },
    { name: 'sleep_0', bob: 0, sleep: true },
    { name: 'sleep_1', bob: 1, sleep: true }
  );

  for (const f of frames) {
    gen(scene, `${baseKey}_${f.name}`, FRAME_W * ART_SCALE, FRAME_H * ART_SCALE, g0 => {
      const g = scaledGraphics(g0);
      if (f.eat) drawHorseEat(g, coat, f.bob);
      else if (f.sleep) drawHorseSleep(g, coat, f.bob);
      else drawHorse(g, coat, f.bob, f.legs);
    });
  }
}
