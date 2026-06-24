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
const LIGHT_HOOF = 0xd9c2a6; // unpigmented (light/tan-pink) hoof under a white marking (#151)
const DARK_MARK = 0x1a140f;  // near-black for the optional "dark markings" set (#152)
// Coat-agnostic shading overlays (Stage 2 detail, #2). Drawn as low-alpha white/black
// on top of the 3-tone coat so every coat colour gets soft rounded form for free. The
// hi-res grid (ART_SCALE) lets these be thin (sub-design-pixel) so they read as a
// gradient, not a band.
const HILITE = 0xffffff;
const SHADE  = 0x000000;

// ── Silhouette engine (Stage 3 shape pass) ──────────────────────────────────
// The body / neck / head are no longer stacked rectangles: each is filled as a
// run of 1-wide vertical "scanline" columns whose top and bottom edges follow a
// control-point polyline. That gives the horse an anatomical OUTLINE — arched
// crested neck, deep sloping shoulder, tucked-up belly, rounded haunch, shaped
// head — while every edge still snaps to a whole device-pixel (crisp, not
// blurry) because the art grid is super-sampled (ART_SCALE). Re-shaping the horse
// is now "move a control point", not "rewrite a wall of fillRects".
const snap = (v) => Math.round(v * 2) / 2; // 0.5 design-grid = 2 device px @ R=4

// Linear-interpolate a polyline [[x,y]…] (sorted by x); clamps past the ends.
function yAt(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  const n = pts.length;
  for (let i = 1; i < n; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return pts[n - 1][1];
}

// Blend two packed-RGB colours (t: 0→a, 1→b). Lets the coat's 3-tone ramp be expanded
// into a smooth gradient — many shades instead of three flat bands.
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t));
}
// Vertical form-tone for a body cross-section: lit (hi) at the top, shading down
// through mid to lo at the underside. t = 0 (top) … 1 (bottom).
function toneAt(body, t) {
  return t < 0.42 ? lerpColor(body.hi, body.mid, t / 0.42) : lerpColor(body.mid, body.lo, (t - 0.42) / 0.58);
}
// Fill a closed profile (between a top and bottom polyline) as 1-wide columns with a
// smooth top-lit gradient (toneAt) plus a bright topline rim-light — a rounded,
// many-shade body instead of three flat bands. `yo` shifts the shape (bob / poses).
function fillProfile(g, body, topPts, botPts, x0, x1, yo) {
  const STEP = 0.5;
  for (let x = x0; x < x1; x++) {
    const yt = snap(yAt(topPts, x + 0.5) + yo);
    const yb = snap(yAt(botPts, x + 0.5) + yo);
    const h = yb - yt;
    if (h <= 0) continue;
    for (let y = yt; y < yb; y += STEP) {
      g.fillStyle(toneAt(body, (y - yt) / h), 1);
      g.fillRect(x, y, 1, Math.min(STEP, yb - y));
    }
    g.fillStyle(lerpColor(body.hi, 0xffffff, 0.22), 1); g.fillRect(x, yt, 1, 0.5); // topline rim
  }
}

// ── Build table ─────────────────────────────────────────────────────────────
// A horse "build" is a fully parametric silhouette: profile polylines (barrel /
// neck / head, design grid, faces right → front = high x), leg geometry + the
// four leg x-positions, and a few head/tail anchors. Re-proportioning the whole
// horse — or adding a new build — is data, not new draw code. A young (foal)
// variant is derived from a build by foalizeBuild() rather than hand-drawn.
export const BUILDS = {
  // Balanced all-purpose riding horse.
  riding: {
    barrelTop: [[6,24],[8,19],[11,16.5],[14,16],[20,16.5],[30,17.5],[37,16.5],[40,15.5],[44,16.5],[48,19]],
    barrelBot: [[6,29],[8,32.5],[11,34.5],[15,34],[18,33],[23,31.5],[31,32.5],[39,34],[44,34],[47,33],[48,31]],
    neckTop:   [[40,15.5],[43,10],[46,6],[48,4.5],[50,4]],
    neckBot:   [[40,31],[43,26],[46,21],[48,19.5],[50,15]],
    headTop:   [[49,5],[53,4.5],[57,5],[60,6],[62,7]],
    headBot:   [[49,13.5],[51,14],[55,13.5],[59,13],[62,12.5]],
    legX: [8, 14, 36, 42],                 // [hindFar, hindNear, foreFar, foreNear]
    leg:  { top: 33, ground: 50, upperW: 5, cannonW: 3 },
    tailRoot: [6, 20],
    ears:   { near: [47, 0.5, 2.5, 5], inner: [47.75, 1.5, 1, 2.5], far: [45.5, 1, 1.5, 4] },
    eye: [53, 7], nostril: [59.5, 10], muzzle: [57, 9, 5, 3.5],
  },
  // Heavy draft: deep barrel, thick crested neck, short stout legs, blunt head.
  draft: {
    barrelTop: [[4,25],[7,18.5],[11,15.5],[15,15],[24,15.5],[33,16.5],[40,15.5],[44,14.5],[47,15],[49,18.5]],
    barrelBot: [[4,32],[6,35],[10,37],[15,37.5],[24,37],[33,36.5],[41,37],[46,36.5],[48,35],[49,32]],
    neckTop:   [[39,15],[41,9],[44,5.5],[47,4],[49,3.5]],
    neckBot:   [[39,31],[42,27],[45,21],[48,16.5],[49,15]],
    headTop:   [[48,4],[51,3.5],[55,4.5],[58,7],[61,9.5]],
    headBot:   [[48,15.5],[51,16],[54,15.5],[57,15],[60,14.5],[61,13.5]],
    legX: [8, 13, 41, 46],
    leg:  { top: 35, ground: 51, upperW: 7, cannonW: 5 },
    tailRoot: [5, 21],
    ears:   { near: [46, 0.5, 3, 5], inner: [46.75, 1.5, 1, 2.5], far: [44, 1, 2, 4] },
    eye: [51, 6], nostril: [59, 11], muzzle: [57, 10.5, 4, 3],
  },
};
const getBuild = (id) => BUILDS[id] || BUILDS.riding;

// Face markings (real-world: star / stripe / snip / blaze), white on the face of a
// right-facing horse (#2). A blaze is the broad connected band; otherwise star,
// stripe, and snip are drawn independently per flag.
function faceMarkings(g, mk, bob) {
  if (mk.cobwebbing) { // fine dark radial lines / mask on the forehead (#152)
    g.fillStyle(DARK_MARK, 0.5);
    g.fillRect(51, 5 + bob, 1, 5); g.fillRect(50, 7 + bob, 1, 2);
    g.fillRect(53, 6 + bob, 1, 2);
  }
  g.fillStyle(WHITE, 1);
  if (mk.blaze) {
    g.fillRect(51, 4.5 + bob, 2.5, 2);   // forehead
    g.fillRect(53, 6.5 + bob, 2.5, 2);
    g.fillRect(55, 8 + bob, 3, 2);
    g.fillRect(58, 9.5 + bob, 3.5, 2);   // down onto the muzzle
    return;
  }
  if (mk.star) g.fillRect(51, 4.5 + bob, 3, 3);          // forehead spot
  if (mk.stripe) {                                        // thin line down the nose
    g.fillRect(54, 7 + bob, 1, 1); g.fillRect(55, 8 + bob, 1, 1);
    g.fillRect(56, 9 + bob, 1, 1); g.fillRect(57, 10 + bob, 1, 1);
  }
  if (mk.snip) g.fillRect(59, 10 + bob, 2, 2);           // muzzle spot
}

// The eating head sits low-right in a different pose, so face markings need their
// own coordinates there (otherwise a star/blaze vanishes when a horse eats).
function faceMarkingsEat(g, mk, headY) {
  if (mk.cobwebbing) { g.fillStyle(DARK_MARK, 0.5); g.fillRect(49, headY + 1, 1, 4); } // #152
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
function drawDorsal(g, coat, yo, B = BUILDS.riding) {
  if (!coat.dorsal) return;
  g.fillStyle(coat.points ?? coat.mane.lo, 1);
  const t = B.barrelTop, x0 = t[0][0] + 3, x1 = t[t.length - 1][0] - 4;
  for (let x = x0; x < x1; x++) g.fillRect(x, snap(yAt(t, x + 0.5) + yo) + 1.5, 1, 1);
}

// Optional "dark markings" set (#152) — toggleable detail layers, each matching a
// real reference. Body-level: sooty topline, shoulder stripe, Bend-Or spots.
const BENDOR_SPOTS = [[18, 25], [30, 28], [24, 33], [38, 24], [14, 30], [34, 21], [27, 27]];
function darkMarkings(g, coat, yo) {
  const mk = coat.markings || {};
  if (mk.sooty) { // smutty dusting along the topline, fading downward
    g.fillStyle(SHADE, 0.16); g.fillRect(8, 18 + yo, 39, 3);
    g.fillStyle(SHADE, 0.10); g.fillRect(8, 21 + yo, 39, 3);
  }
  if (mk.shoulderStripe) { // dark crossbar over the shoulder/withers
    g.fillStyle(DARK_MARK, 0.8);
    g.fillRect(41, 16 + yo, 2, 13);
    g.fillRect(43, 18 + yo, 2, 9);
  }
  if (mk.bendOr) { // random small dark smudges (Bend-Or / grease spots)
    g.fillStyle(DARK_MARK, 0.7);
    for (const [sx, sy] of BENDOR_SPOTS) g.fillRect(sx, sy + yo, 2, 2);
  }
}

// Leg-level dark markings (#152): horizontal zebra bars + ermine spots in a sock.
function legDark(g, x, lift, mk, legMark, offsetY = 0) {
  const topY = 35 + offsetY, h = 15 - lift;
  if (mk.legBars) {
    g.fillStyle(DARK_MARK, 0.55);
    g.fillRect(x, topY + Math.max(1, h - 11), 4, 1);
    g.fillRect(x, topY + Math.max(3, h - 8), 4, 1);
    g.fillRect(x, topY + Math.max(5, h - 5), 4, 1);
  }
  if (mk.ermine && legMark) { // dark spots inside the white sock/stocking
    g.fillStyle(DARK_MARK, 0.85);
    g.fillRect(x + 1, topY + h - 4, 1, 1);
    g.fillRect(x + 2, topY + h - 7, 1, 1);
  }
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
  // Hoof — small shine on top + a contact shadow at the ground. Its colour follows
  // the leg's marking (#151): a white sock/stocking gives an unpigmented (light)
  // hoof, otherwise the coat's hoof colour (dark legs keep dark hooves).
  g.fillStyle(legMark ? LIGHT_HOOF : hoof, 1);
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

// Vertical value modulation along a leg: subtle highlights on the forearm/gaskin
// muscle, the knee/hock knob and the fetlock, with soft shadows tucked above the knee
// and below the joints — so the anatomy reads through SHADING, keeping the silhouette
// bumps gentle. Returns +light / −dark amount for a height fraction f.
function legShadeV(f) {
  const bump = (c, hw, a) => Math.max(0, a * (1 - Math.abs(f - c) / hw));
  return bump(0.15, 0.13, 0.055)   // forearm / gaskin muscle (light)
       - bump(0.34, 0.06, 0.05)    // above the knee (shadow)
       + bump(0.42, 0.05, 0.06)    // knee / hock knob (light)
       - bump(0.54, 0.07, 0.045)   // under the joint (shadow)
       + bump(0.83, 0.04, 0.05)    // fetlock (light)
       - bump(0.92, 0.06, 0.04);   // pastern (shadow)
}

// One continuously-tapered limb with real anatomy, drawn row-by-row. The vertical
// width profile gives it a muscular forearm/gaskin that flares into the body, a
// narrowing above the knee/hock, a joint KNOB, a thin straight cannon, a fetlock
// bump, a pinched pastern, then the hoof — so it reads top-to-bottom like a leg, not
// a cone. Hind legs carry a heavier gaskin + bigger hock and a slight hock angle.
// Depth-aware: near legs are lit and blend up into the body; far legs sink into the
// underbelly shadow. Markings (points / sock / stocking) layer by height fraction.
function legV2(g, x, lift, body, near, hind, hoof, legMark, sockTone = SOCK, feather = false, points, yo = 0, geo = { top: 33, ground: 50, upperW: 5, cannonW: 3 }) {
  const upperW = geo.upperW, cannonW = geo.cannonW;
  const topY = geo.top + yo;
  const ground = geo.ground + yo - lift;
  if (ground <= topY + 4) return;
  const H = ground - topY;
  const cxC = x + upperW / 2;                 // limb centre line
  const kneeF = 0.46;                          // points (dark lower leg) begin below the knee
  const base = near ? lerpColor(body.mid, body.hi, 0.28) : body.lo;
  const topTone = near ? body.mid : body.lo;
  const pTone = points !== undefined ? (near ? points : lerpColor(points, 0x000000, 0.18)) : null;
  const sTone = legMark ? (near ? sockTone : lerpColor(sockTone, body.lo, 0.28)) : null;
  const sockF = legMark === 'stocking' ? 0.5 : 0.78;
  // anatomical width by height fraction (control points): forearm/gaskin → above-knee
  // pinch → knee/hock knob → cannon → fetlock → pastern → hoof.
  const prof = hind
    ? [[0, upperW + 1.7], [0.09, upperW + 0.3], [0.26, cannonW + 0.7], [0.40, cannonW + 1.2], [0.48, cannonW], [0.78, cannonW], [0.83, cannonW + 0.6], [0.89, cannonW - 0.1], [1, cannonW + 0.5]]
    : [[0, upperW + 1.2], [0.10, upperW - 0.2], [0.30, cannonW + 0.5], [0.40, cannonW + 0.9], [0.47, cannonW], [0.78, cannonW], [0.83, cannonW + 0.6], [0.89, cannonW - 0.1], [1, cannonW + 0.5]];
  const widthAt = (f) => yAt(prof, f);
  // hind leg leans: gaskin forward at the top, tucking back through the hock, vertical below
  const centerAt = (f) => cxC + (!hind ? 0 : f < 0.4 ? 0.7 - 0.9 * (f / 0.4) : f < 0.52 ? -0.2 + (f - 0.4) / 0.12 * 0.2 : 0);
  for (let y = topY; y < ground; y += 0.5) {
    const f = (y - topY) / H;
    const w = widthAt(f), lx = centerAt(f) - w / 2;
    let core;
    if (sTone && f >= sockF) core = sTone;
    else if (pTone && f >= kneeF) core = pTone;
    else core = lerpColor(topTone, base, Math.min(1, f / 0.16)); // blend body tone → base at the top
    const v = legShadeV(f);                                       // vertical anatomy shading
    core = v >= 0 ? lerpColor(core, 0xfff2d8, v) : lerpColor(core, 0x000000, -v);
    g.fillStyle(core, 1); g.fillRect(lx, y, w, 0.5);
    g.fillStyle(lerpColor(core, 0x000000, near ? 0.13 : 0.09), 1); g.fillRect(lx, y, w * 0.26, 0.5); // back shadow
    if (near) { g.fillStyle(lerpColor(core, 0xfff2d8, 0.08), 1); g.fillRect(lx + w * 0.72, y, w * 0.2, 0.5); } // front light
  }
  // knee/hock: a faint shadow tucked at the back of the joint (the rest of the joint
  // shaping is carried by legShadeV)
  const jf = 0.40, jw = widthAt(jf), jc = centerAt(jf), jy = topY + H * jf;
  g.fillStyle(lerpColor(base, 0x000000, 0.1), 1); g.fillRect(jc - jw / 2, jy - 0.5, jw * 0.2, 1.4);
  // hoof — light if a white marking sits above it (unpigmented hoof, #151)
  const hToneBase = legMark ? LIGHT_HOOF : hoof;
  const hTone = near ? hToneBase : lerpColor(hToneBase, 0x000000, 0.2);
  const hoofW = cannonW + 1.4, hx = centerAt(1) - hoofW / 2;
  g.fillStyle(hTone, 1); g.fillRect(hx, ground, hoofW, 2.5);
  g.fillStyle(lerpColor(hTone, 0x000000, near ? 0.1 : 0.16), 1); g.fillRect(hx, ground, hoofW * 0.28, 2.5);
  if (near) { g.fillStyle(lerpColor(hTone, 0xffffff, 0.18), 1); g.fillRect(hx + 0.6, ground + 0.3, 1.25, 0.7); }
  g.fillStyle(SHADE, 0.16); g.fillRect(hx, ground + 2, hoofW, 0.6);
  // feathering — fluffy tuft cascading over the fetlock/hoof
  if (feather) {
    const fetY = topY + H * 0.82, fc = centerAt(0.82);
    const ft = legMark ? sTone : (pTone !== null ? pTone : base);
    g.fillStyle(ft, 1);
    const fw = cannonW + 4;
    g.fillRect(fc - fw / 2, fetY, fw, 2);
    g.fillRect(fc - fw / 2 - 0.5, fetY + 1.5, fw + 1, 2);
    g.fillRect(fc - 2, fetY + 3, 1.5, 3);
    g.fillRect(fc, fetY + 3, 1.5, 2);
    g.fillRect(fc + 1, fetY + 3, 1.5, 3.5);
  }
}

// Flowing tail off the dock (x0,y0 = where it attaches), falling down-left.
function drawTailFrom(g, m, x0, y0, bob, white = false) {
  const lo = white ? WHITE : m.lo, mid = white ? WHITE : m.mid;
  g.fillStyle(mid, 1); g.fillRect(x0, y0 + bob, 3, 4);          // dock (narrow, attached)
  g.fillStyle(lo, 1);  g.fillRect(x0 - 2, y0 + 3 + bob, 4, 7);  // upper flow
  g.fillStyle(mid, 1); g.fillRect(x0 - 3, y0 + 8 + bob, 4, 8);
  g.fillStyle(lo, 1);  g.fillRect(x0 - 4, y0 + 14 + bob, 4, 8); // fullest bulge
  g.fillStyle(mid, 1); g.fillRect(x0 - 3, y0 + 19 + bob, 4, 7);
  g.fillStyle(lo, 1);  g.fillRect(x0 - 3, y0 + 25 + bob, 3, 5); // tapering tip
  g.fillStyle(mid, 1); g.fillRect(x0 - 2, y0 + 29 + bob, 2, 4);
  if (!white) { g.fillStyle(HILITE, 0.10); g.fillRect(x0 - 1.5, y0 + 4 + bob, 0.8, 22); }
}

// Form shading that follows the barrel: a sheen just under the topline and a soft
// core shadow just above the belly, so every coat reads as a rounded 3-D barrel.
function shadeBarrel(g, B, bob) {
  const t = B.barrelTop, bt = B.barrelBot;
  const x0 = Math.max(t[0][0], bt[0][0]) + 2;
  const x1 = Math.min(t[t.length - 1][0], bt[bt.length - 1][0]) - 1;
  for (let x = x0; x < x1; x++) {
    const yt = snap(yAt(t, x + 0.5) + bob), yb = snap(yAt(bt, x + 0.5) + bob);
    g.fillStyle(HILITE, 0.10); g.fillRect(x, yt + 1.5, 1, 1);     // topline sheen
    g.fillStyle(SHADE, 0.10);  g.fillRect(x, yb - 2.75, 1, 1.25); // belly core shadow
  }
}

// Soft anatomical definition over the barrel: a haunch-muscle highlight, a stifle /
// flank crease, the sloping shoulder shadow, and a brisket highlight — so the body
// reads as muscled rather than a smooth sausage. Positioned by barrel landmarks so it
// follows any build; coat-agnostic alpha overlays.
function musculature(g, B, bob) {
  const t = B.barrelTop;
  const bx0 = t[0][0], bx1 = t[t.length - 1][0];
  const topY = (x) => snap(yAt(t, x + 0.5) + bob);
  g.fillStyle(HILITE, 0.09);                                   // haunch dome
  for (let x = bx0 + 3; x < bx0 + 9; x++) g.fillRect(x, topY(x) + 2, 1, 4);
  g.fillStyle(SHADE, 0.10);                                    // stifle / flank crease
  for (let i = 0; i < 7; i++) g.fillRect(bx0 + 9 + i * 0.25, topY(bx0 + 9) + 4 + i, 0.8, 3);
  for (let i = 0; i < 8; i++) g.fillRect(bx1 - 8 + i * 0.5, topY(bx1 - 8 + i * 0.5) + 3 + i * 0.8, 0.8, 5); // shoulder slope
  g.fillStyle(HILITE, 0.07);                                   // shoulder / brisket
  for (let x = bx1 - 5; x < bx1 - 1; x++) g.fillRect(x, topY(x) + 3, 1, 6);
}

// Mane draped along the neck crest (parametric → follows any build's neck), plus a
// forelock at the poll. Locks are longest at the withers, fading toward the poll.
function drawManeAlong(g, coat, bob, B) {
  const m = coat.mane, mk = coat.markings || {};
  const crest = B.neckTop, xW = crest[0][0], xP = crest[crest.length - 1][0];
  const pintoMane = mk.pinto && mk.pintoMane;
  const L = 5; // mane hair length (kept trim so it doesn't swallow the neck)
  // Hanging mass: a band off the crest broken into ~3px locks with slightly varied
  // tips, so the lower edge reads as distinct hanks of hair draped down the near side
  // of the neck rather than a noisy fringe. Lit roots sit along the crest.
  for (let x = xW; x <= xP; x += 0.5) {
    const cy = yAt(crest, x + 0.25);
    const f = (x - xW) / (xP - xW);                   // 0 at withers … 1 at poll
    const lock = Math.floor((x - xW) / 3);
    const tip = L + (lock % 2 ? 1.5 : 0) - f * 2;      // alternate lock length, shorter toward poll
    const white = pintoMane && f < 0.5;
    g.fillStyle(white ? WHITE : m.lo, 1);  g.fillRect(x - 0.25, cy - 1 + bob, 1, tip);
    g.fillStyle(white ? WHITE : m.mid, 1); g.fillRect(x - 0.25, cy - 1 + bob, 1, 2.5);
  }
  // sheen strands picking out a few locks
  g.fillStyle(m.hi, 0.45);
  for (let x = xW + 1.5; x < xP - 1; x += 3) g.fillRect(x, yAt(crest, x + 0.5) + 0.5 + bob, 0.6, 4);
  // forelock falling over the brow between the ears
  g.fillStyle(m.mid, 1); g.fillRect(xP - 1, yAt(crest, xP) - 3 + bob, 3, 4);
  g.fillStyle(m.lo, 1);  g.fillRect(xP + 0.5, yAt(crest, xP) - 1 + bob, 1.5, 3);
}

function drawHorse(g, coat, bob, legLift, B = BUILDS.riding) {
  const b = coat.body;
  const mk = coat.markings || {};
  const feather = !!mk.feather; // feathering is on/off; colour derives per-leg (#155)
  const lm = mk.legs || {};
  const pts = coat.points;
  const sockTone = SOCK; // socks/stockings are always white (#153)
  const geo = B.leg, lx = B.legX;

  // --- far legs + tail (behind the body) ---
  legV2(g, lx[0], legLift[0], b, false, true,  coat.hoof, lm.hindFar, sockTone, feather, pts, bob, geo); // hind far
  legV2(g, lx[2], legLift[2], b, false, false, coat.hoof, lm.foreFar, sockTone, feather, pts, bob, geo); // fore far
  legDark(g, lx[0], legLift[0], mk, lm.hindFar, bob); legDark(g, lx[2], legLift[2], mk, lm.foreFar, bob);
  drawTailFrom(g, coat.mane, B.tailRoot[0], B.tailRoot[1], bob, !!(mk.pinto && mk.pintoMane));

  // --- body barrel + chest (scanline profile) ---
  const bx0 = Math.max(B.barrelTop[0][0], B.barrelBot[0][0]);
  const bx1 = Math.min(B.barrelTop[B.barrelTop.length - 1][0], B.barrelBot[B.barrelBot.length - 1][0]);
  fillProfile(g, b, B.barrelTop, B.barrelBot, bx0, bx1, bob);
  shadeBarrel(g, B, bob);
  musculature(g, B, bob);

  // dorsal stripe + whole-body patterns + dark markings
  drawDorsal(g, coat, bob, B);
  bodyPatterns(g, coat, bob);
  darkMarkings(g, coat, bob);

  // --- neck (arched crest) ---
  fillProfile(g, b, B.neckTop, B.neckBot, B.neckTop[0][0], B.neckTop[B.neckTop.length - 1][0] + 1, bob);

  // --- head ---
  fillProfile(g, b, B.headTop, B.headBot, B.headTop[0][0], B.headTop[B.headTop.length - 1][0] + 1, bob);
  // muzzle — soft velvety darkening over the lower front of the nose, following the
  // head contour and blended in (no hard box), strongest toward the tip
  const hxEnd = B.headTop[B.headTop.length - 1][0];
  for (let x = hxEnd - 5; x < hxEnd; x++) {
    const yt = snap(yAt(B.headTop, x + 0.5) + bob), yb = snap(yAt(B.headBot, x + 0.5) + bob);
    const k = (x - (hxEnd - 5)) / 5;
    g.fillStyle(lerpColor(b.lo, 0x000000, 0.06 + 0.16 * k), 1);
    g.fillRect(x, yb - (yb - yt) * 0.5, 1, (yb - yt) * 0.5);
  }
  // ears
  const e = B.ears;
  g.fillStyle(b.mid, 1);    g.fillRect(e.near[0], e.near[1] + bob, e.near[2], e.near[3]);   // near ear
  g.fillStyle(EAR_PINK, 1); g.fillRect(e.inner[0], e.inner[1] + bob, e.inner[2], e.inner[3]);
  g.fillStyle(b.lo, 1);     g.fillRect(e.far[0], e.far[1] + bob, e.far[2], e.far[3]);       // far ear (shadow)
  // nostril — a soft dark comma on the side of the muzzle with a lip shadow beneath
  const [nx, ny] = B.nostril;
  g.fillStyle(lerpColor(b.lo, 0x000000, 0.5), 1);  g.fillRect(nx, ny + bob, 1.5, 1.5);
  g.fillStyle(lerpColor(b.lo, 0x000000, 0.22), 1); g.fillRect(nx - 0.25, ny + 1.5 + bob, 2, 0.5);

  // face markings (drawn before the eye so the eye stays on top)
  faceMarkings(g, mk, bob);

  // eye — set into a soft socket, with an almond eyeball, upper-lid shadow + catch-light
  const [ex, ey] = B.eye;
  g.fillStyle(lerpColor(b.mid, 0x000000, 0.16), 1);   g.fillRect(ex - 0.5, ey - 0.75 + bob, 3, 2.75); // socket
  g.fillStyle(coat.eye, 1);  g.fillRect(ex, ey + bob, 2, 1.75);                                        // eyeball
  g.fillStyle(SHADE, 0.45);  g.fillRect(ex, ey + bob, 2, 0.5);                                         // upper lid
  g.fillStyle(lerpColor(coat.eye, 0xffffff, 0.9), 1); g.fillRect(ex + 1.05, ey + 0.4 + bob, 0.6, 0.55); // catch-light

  // mane over the crest
  drawManeAlong(g, coat, bob, B);

  // --- near legs (in front of the body) ---
  legV2(g, lx[1], legLift[1], b, true, true,  coat.hoof, lm.hindNear, sockTone, feather, pts, bob, geo); // hind near
  legV2(g, lx[3], legLift[3], b, true, false, coat.hoof, lm.foreNear, sockTone, feather, pts, bob, geo); // fore near
  legDark(g, lx[1], legLift[1], mk, lm.hindNear, bob); legDark(g, lx[3], legLift[3], mk, lm.foreNear, bob);
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
  legDark(g, 7, 10, mk, lm.hindFar, dy);  legDark(g, 38, 10, mk, lm.foreFar, dy);  // dark leg marks (#152)
  legDark(g, 13, 10, mk, lm.hindNear, dy); legDark(g, 44, 10, mk, lm.foreNear, dy);

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
  darkMarkings(g, coat, bob + dy);

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
  legDark(g, 7, 0, mk, lm.hindFar);  legDark(g, 38, 0, mk, lm.foreFar);   // dark leg marks (#152)
  legDark(g, 13, 0, mk, lm.hindNear); legDark(g, 44, 0, mk, lm.foreNear);

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
  darkMarkings(g, coat, bob);

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
export function buildHorseTextures(scene, baseKey, coat, buildId = 'riding') {
  const B = getBuild(buildId);
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
      else drawHorse(g, coat, f.bob, f.legs, B);
    });
  }
}
