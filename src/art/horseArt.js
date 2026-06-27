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

// Face markings (real-world: star / stripe / snip / blaze), white on the face of a
// right-facing horse (#2). A blaze is the broad connected band; otherwise star,
// stripe, and snip are drawn independently per flag.
function faceMarkings(g, mk, bob) {
  if (mk.cobwebbing) { // fine dark radial lines / mask on the forehead (#152)
    g.fillStyle(DARK_MARK, 0.5);
    g.fillRect(50, 4 + bob, 1, 5); g.fillRect(49, 6 + bob, 1, 2);
    g.fillRect(52, 6 + bob, 1, 2); g.fillRect(51, 3 + bob, 1, 1);
  }
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
function drawDorsal(g, coat, yo) {
  if (!coat.dorsal) return;
  g.fillStyle(coat.points ?? coat.mane.lo, 1);
  g.fillRect(8, 18 + yo, 39, 1);
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
// Linear-interpolate a control-point polyline [[x,y]…] at x (used for the leg's
// anatomical width profile). Ported from the shelved revamp.
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

// Blend two packed-RGB colours (t: 0→a, 1→b) — expands the coat's 3-tone ramp into
// a smooth gradient for the row-by-row anatomical leg.
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t));
}

// Vertical value modulation along a leg's length: subtle light on the forearm/
// gaskin muscle, the knee/hock knob and the fetlock; soft shadow tucked above the
// knee and below the joints. Layered over the flat leg so the anatomy reads through
// SHADING — the leg looks like a jointed limb rather than a plain cylinder. Ported
// (and toned down) from the shelved art revamp's legShadeV. Returns +light / -dark
// for a height fraction f (0 = top of leg, 1 = ground).
function legShadeV(f) {
  const bump = (c, hw, a) => Math.max(0, a * (1 - Math.abs(f - c) / hw));
  return bump(0.15, 0.14, 0.045)  // forearm / gaskin muscle (light)
       - bump(0.34, 0.08, 0.03)   // above the knee (shadow)
       + bump(0.42, 0.06, 0.035)  // knee / hock knob (light)
       - bump(0.55, 0.08, 0.03)   // under the joint (shadow)
       + bump(0.83, 0.05, 0.035)  // fetlock (light)
       - bump(0.92, 0.06, 0.03);  // pastern (shadow)
}

// Feathering — the long hair a draft horse grows from the back of the cannon, draping
// over the fetlock and hoof. Drawn as a small row of hanging locks — the SAME soft
// tapering clumps used for the mane — rather than a solid blob, so it reads as flowing
// hair. `tone` is the hair colour, already resolved per-leg (#155: white over a sock,
// dark over points, else the leg's tone); `near` lights it a touch for the front pair.
function drawFeather(g, cx, topY, tone, near = true) {
  const root = lerpColor(tone, 0xfff2d8, near ? 0.11 : 0.04); // lit where it leaves the leg
  const tip  = lerpColor(tone, 0x000000, 0.16);               // darker at the hanging tips
  // Overlapping locks across the fetlock — longest in the middle so they drape over the
  // hoof; each tapers to a point on the root→tip gradient. [x-offset from cx, length].
  const locks = [[-2.3, 4], [-1.1, 5.5], [0.2, 6], [1.4, 5], [2.6, 3.6]];
  for (const [dx, len] of locks) {
    for (let i = 0; i < len; i += 0.5) {
      const fy = i / len;
      const w = 2.1 * (1 - fy * 0.7);            // widest at the root, tapering to a point
      const lx = cx + dx - w / 2 + fy * 0.4;     // drifts gently inward as it falls
      const c = lerpColor(root, tip, 0.28 + fy * 0.72);
      g.fillStyle(c, 1); g.fillRect(lx, topY + i, w, 0.5);
      g.fillStyle(lerpColor(c, 0x000000, 0.08), 1); g.fillRect(lx, topY + i, 0.5, 0.5); // soft seam
    }
  }
}

// One continuously-tapered limb with real anatomy, drawn row-by-row. The vertical
// width profile gives it a muscular forearm/gaskin flaring into the body, a narrowing
// above the knee/hock, a joint KNOB, a thin straight cannon, a fetlock bump, a pinched
// pastern, then the hoof — so it reads top-to-bottom like a leg, not a cone. Hind legs
// carry a heavier gaskin + bigger hock and a slight hock angle. Depth-aware: near legs
// are lit, far legs sink toward the underbelly tone. Markings (points / sock /
// stocking) layer by height fraction. Ported from the shelved revamp (the legs were
// the part that read well); the parametric body it came with was NOT brought along.
function legV2(g, x, lift, body, near, hind, hoof, legMark, sockTone = SOCK, feather = false, points, yo = 0, geo = { top: 35, ground: 50, upperW: 5, cannonW: 3.1 }) {
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
    ? [[0, upperW + 0.5], [0.20, upperW - 0.4], [0.36, cannonW + 0.6], [0.50, cannonW], [0.78, cannonW], [0.85, cannonW + 0.4], [0.90, cannonW], [1, cannonW + 0.3]]
    : [[0, upperW],       [0.20, upperW - 0.6], [0.36, cannonW + 0.4], [0.50, cannonW], [0.78, cannonW], [0.85, cannonW + 0.4], [0.90, cannonW], [1, cannonW + 0.3]];
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
  // feathering — flowing hair draping over the fetlock/hoof (mane-matched style, #155)
  if (feather) {
    const ft = legMark ? sTone : (pTone !== null ? pTone : base);
    drawFeather(g, centerAt(0.8), topY + H * 0.8, ft, near);
  }
}

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
  // Vertical anatomy shading down the leg's length (forearm / knee / fetlock), so it
  // reads as a jointed limb instead of an even cylinder. Subtle, layered over the
  // tone + markings.
  for (let yy = 0; yy < h; yy += 0.5) {
    const v = legShadeV(yy / h);
    if (v > 0)      { g.fillStyle(HILITE, v);  g.fillRect(x, topY + yy, 4, 0.5); }
    else if (v < 0) { g.fillStyle(SHADE, -v);  g.fillRect(x, topY + yy, 4, 0.5); }
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
    // dark over dark legs ("points"), otherwise the leg's own tone. Flowing hair
    // draped over the fetlock/hoof in the mane-matched style (see drawFeather).
    const ft = legMark ? sockTone : (points !== undefined ? points : tone);
    drawFeather(g, x + 2, topY + h - 4, ft, true);
  }
}

// Tail as a flowing hank off the dock (x0,y0 = where it attaches), falling down-left:
// narrow dock, swelling fuller through the mid-length, then tapering to a tip, with a
// soft sheen ribbon down the front. This is the FIRST tail design from the shelved
// art revamp (the clean version built for this horse's scale, before it got bulkier).
// `white` draws it in the pinto colour for a two-tone tail (#144).
function drawTailFrom(g, m, x0, y0, bob, white = false) {
  const lo = white ? WHITE : m.lo, mid = white ? WHITE : m.mid, hi = white ? WHITE : m.hi;
  // Silhouette as [dy, xLeft-offset, width] control points — same hank shape as the
  // flat version, but filled row-by-row so the colour can flow smoothly.
  // Thicker hank. [dy, xLeft-offset, width].
  const prof = [[0, 0, 3.5], [3, -2.5, 4], [8, -3.5, 4.5], [14, -3.5, 4.5], [21, -2.5, 3.5], [26, -2, 2]];
  const xlAt = (d) => yAt(prof.map((p) => [p[0], p[1]]), d);
  const wAt  = (d) => yAt(prof.map((p) => [p[0], p[2]]), d);
  const total = 28;
  g.layer('tail.body');
  for (let d = 0; d < total; d += 0.5) {
    const xl = x0 + xlAt(d), w = wAt(d);
    const fy = d / total;                              // 0 root … 1 tip
    for (let x = xl; x < xl + w; x += 0.5) {
      const tx = w > 0 ? (x - xl) / w : 0;             // 0 back edge … 1 front edge
      let c = lerpColor(mid, lo, fy * 0.85);           // darkens root → tip
      if (tx > 0.62) c = lerpColor(c, hi, (tx - 0.62) / 0.38 * 0.4);     // front sheen
      else if (tx < 0.3) c = lerpColor(c, 0x000000, (0.3 - tx) / 0.3 * 0.18); // back shadow
      const lock = Math.round((x - xl) / 0.9) % 2;     // fine lock striping (strands)
      if (lock) c = lerpColor(c, 0x000000, 0.085);
      g.fillStyle(c, 1); g.fillRect(x, y0 + d + bob, 0.5, 0.5);
    }
  }
  if (!white) {
    // Locks cascading off the hank's edges and tip — many fine, tapering strands rooted
    // right at the silhouette edge so they read as part of one full mass of flowing hair,
    // not a solid segment with a few detached strands beside it.
    g.layer('tail.frays');
    const edge = lerpColor(lo, mid, 0.35);
    // [start d, side (-1 left / +1 right), length, outward splay]
    const locks = [
      [3, -1, 8, 1.2], [6, -1, 11, 1.6], [10, -1, 13, 1.8], [14, -1, 12, 1.6], [18, -1, 9, 1.2], [22, -1, 6, 0.8],
      [5,  1, 7, 1.0], [9,  1, 10, 1.3], [13, 1, 11, 1.4], [17, 1, 8, 1.0], [21, 1, 5, 0.7],
    ];
    for (const [dd, side, len, splay] of locks) {
      const xl = x0 + xlAt(dd), w = wAt(dd);
      const root = side < 0 ? xl : xl + w - 0.5;
      for (let i = 0; i < len; i += 0.5) {
        const f = i / len;
        const ww = Math.max(0.5, 1.1 * (1 - f * 0.8));            // taper to a point
        const x = root + side * splay * f - (side < 0 ? ww - 0.5 : 0); // splay outward as it falls
        g.fillStyle(lerpColor(edge, 0x000000, f * 0.22), 1);     // darken toward the tip
        g.fillRect(x, y0 + dd + i + bob, ww, 0.5);
      }
    }
    // frayed tip — a few wispy points fanning off the bottom of the hank
    g.layer('tail.tip');
    const tx0 = x0 + xlAt(25);
    for (const [dx, len] of [[-1, 5], [0.5, 7], [2, 6], [3.5, 4]]) {
      for (let i = 0; i < len; i += 0.5) {
        const f = i / len;
        g.fillStyle(lerpColor(lo, 0x000000, 0.12 + f * 0.22), 1);
        g.fillRect(tx0 + dx - f * 0.6, y0 + 25 + i + bob, Math.max(0.5, 1 - f * 0.7), 0.5);
      }
    }
    // bright locks picking out the flow (within the hank, not detached)
    g.layer('tail.sheen');
    g.fillStyle(hi, 0.42);
    for (const [frac, dy0, len] of [[0.18, 4, 14], [0.3, 8, 10], [0.45, 12, 7]]) {
      for (let i = 0; i < len; i += 0.5) { const d = dy0 + i, xl = x0 + xlAt(d), w = wAt(d); g.fillRect(xl + w * frac, y0 + d + bob, 0.5, 0.5); }
    }
  }
}

// Mane draped down the crest of the neck, rendered row-by-row for fine resolution:
// a smooth root→tip gradient with subtly varied hair locks, sheen strands picking out
// a few locks, a shadow seam where it meets the neck, and a small forelock at the
// poll. Pinto two-tone (#144) whitens the upper half when `pintoMane` is set.
function drawMane(g, coat, bob) {
  const m = coat.mane, mk = coat.markings || {};
  const pintoMane = mk.pinto && mk.pintoMane;
  // Full, cohesive mane band; the root (right) edge overlaps the neck crest so the mane
  // reads attached to the horse. [y, xLeft, width].
  const prof = [[0, 45.8, 1.6], [3, 43.5, 3.6], [7, 41.5, 5.2], [13, 40, 5.5], [20, 39.5, 5], [27, 40, 3.8], [31, 41, 2.5]];
  const xlAt = (y) => yAt(prof.map((p) => [p[0], p[1]]), y);
  const wAt  = (y) => yAt(prof.map((p) => [p[0], p[2]]), y);
  // Smooth band edge — no rounded lobes (those read as ripples). The hanging edge is
  // broken up by frayed strand-tips below instead, the way the tail's edge frays.
  g.layer('mane.band');
  for (let y = 0; y < 32; y += 0.5) {
    const xl = xlAt(y), w = wAt(y);
    const f = y / 31;                                    // 0 poll … 1 withers
    for (let x = xl; x < xl + w; x += 0.5) {
      const t = w > 0 ? (x - xl) / w : 0;                // 0 hanging tip (left) … 1 root (right)
      let c = lerpColor(m.lo, m.mid, Math.min(1, t * 1.1));   // tip dark → root mid
      if (t > 0.64) c = lerpColor(c, m.hi, (t - 0.64) / 0.36 * 0.5); // lit roots blend INTO the neck
      const lock = Math.round((x - xl) / 0.9) % 2;       // fine vertical strand lines, like the tail
      if (lock) c = lerpColor(c, 0x000000, 0.085);
      if (pintoMane && f < 0.5) c = WHITE;
      g.fillStyle(c, 1); g.fillRect(x, y + bob, 0.5, 0.5);
    }
  }
  // Frayed hanging edge — tapering strand-locks cascading off the left edge (and the
  // bottom), rooted at the band like the tail's edge locks, so the silhouette breaks
  // into hair tips instead of a smooth outline. Fullest through the middle.
  g.layer('mane.frays');
  const edge = lerpColor(m.lo, m.mid, 0.4);
  for (const [ry, len, splay] of [
    [2, 4, 0.6], [5, 6, 0.9], [8, 7, 1.1], [11, 8, 1.2], [14, 8, 1.2],
    [17, 7, 1.1], [20, 7, 1.0], [23, 6, 0.9], [26, 5, 0.7], [29, 4, 0.5],
  ]) {
    const rootX = xlAt(ry);
    for (let i = 0; i < len; i += 0.5) {
      const f = i / len;
      const ww = Math.max(0.5, 1.4 * (1 - f * 0.8));     // taper to a point
      const x = rootX - splay * f - (ww - 0.5);          // drift forward as it falls
      const yy = ry + i;
      let c = lerpColor(edge, 0x000000, f * 0.22);       // darken toward the tip
      if (pintoMane && yy / 31 < 0.5) c = WHITE;
      g.fillStyle(c, 1); g.fillRect(x, yy + bob, ww, 0.5);
    }
  }
  // bright sheen strands picking out a few locks (same look as the tail)
  g.layer('mane.sheen');
  g.fillStyle(m.hi, 0.42);
  for (const [y0s, len, frac] of [[4, 13, 0.62], [13, 11, 0.48], [21, 7, 0.55]]) {
    for (let i = 0; i < len; i += 0.5) { const y = y0s + i, xl = xlAt(y), w = wAt(y); g.fillRect(xl + w * frac, y + bob, 0.5, 0.5); }
  }
  g.layer('mane.forelock');
  // forelock — a small fall of hair from the poll over the brow, flowing like the mane
  // (tapered locks) instead of a solid block between the ears. Kept at y>=0 so the bob
  // never pushes it above the frame's top edge (clipping there pins it in place and it
  // stops animating — the old "non-moving block" bug).
  for (const [fx, fy0, len] of [[44, 0, 4.5], [45.4, 0.3, 5], [46.6, 1, 4]]) {
    for (let i = 0; i < len; i += 0.5) {
      const f = i / len;
      const w = 1.5 * (1 - f * 0.72);
      let c = lerpColor(m.mid, m.lo, 0.3 + f * 0.6);
      if (pintoMane) c = WHITE;          // forelock sits in the white upper half
      g.fillStyle(c, 1); g.fillRect(fx + f * 0.8, fy0 + i + bob, w, 0.5);
    }
  }
}

function drawHorse(g, coat, bob, legLift) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // --- legs first (behind body), far legs in shadow tone ---
  g.layer('legs'); // part tags for the dissect tool (no-op in the real build)
  const feather = !!mk.feather; // feathering is on/off; colour derives per-leg (#155)
  const lm = mk.legs || {};
  const pts = coat.points;
  const sockTone = SOCK; // socks/stockings are always white (#153)
  // Anatomical row-by-row legs (legV2): body=b, plus near/hind flags for depth + shape.
  legV2(g, 7,  legLift[0], b, false, true,  coat.hoof, lm.hindFar,  sockTone, feather, pts); // hind far
  legV2(g, 38, legLift[2], b, false, false, coat.hoof, lm.foreFar,  sockTone, feather, pts); // fore far
  legV2(g, 13, legLift[1], b, true,  true,  coat.hoof, lm.hindNear, sockTone, feather, pts); // hind near
  legV2(g, 44, legLift[3], b, true,  false, coat.hoof, lm.foreNear, sockTone, feather, pts); // fore near
  legDark(g, 7, legLift[0], mk, lm.hindFar);  legDark(g, 38, legLift[2], mk, lm.foreFar);  // dark leg marks (#152)
  legDark(g, 13, legLift[1], mk, lm.hindNear); legDark(g, 44, legLift[3], mk, lm.foreNear);

  // --- tail (flowing hank, anchored at the rump dock) ---
  drawTailFrom(g, m, 6, 20, bob);

  // --- rump + body (3-tone bands) ---
  g.layer('body');
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
  darkMarkings(g, coat, bob);

  // --- neck ---
  g.layer('neck');
  g.fillStyle(b.mid, 1); g.fillRect(42, 14 + bob, 8, 12);
  g.fillStyle(b.mid, 1); g.fillRect(45, 8 + bob, 8, 8);
  g.fillStyle(b.hi, 1); g.fillRect(46, 8 + bob, 3, 18);

  // --- head ---
  g.layer('head');
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

  // --- mane (hi-res, over neck) ---
  drawMane(g, coat, bob);
  // Pinto two-tone tail tip (#144): whiten the tail's lower flow to match the mane.
  if (mk.pinto && mk.pintoMane) {
    g.layer('tail.tip');
    g.fillStyle(WHITE, 1);
    g.fillRect(2.5, 34 + bob, 4.5, 7); g.fillRect(3.5, 41 + bob, 3, 6); // lower tail + tip
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
    });  }
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
    });  }
}
