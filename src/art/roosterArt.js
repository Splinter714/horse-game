// Procedural pixel-art rooster. Faces right, origin (0.5,1). idle_0/1, walk_0..3, and
// eat_0/1 (pecking) frames, in five feather coats. A sibling of the chicken (chickenArt.js)
// — same drawing approach via the shared `gen` helper (_frames.js) — but visibly a ROOSTER:
// a taller, prouder stance on a bigger body, an upright puffed chest, a large multi-point
// comb, a long dangling wattle, and sweeping arched sickle tail-plumes. No lay pose
// (roosters don't lay eggs — that stays a hen-only art, chickenArt.js).

import { gen, scaledGraphics, ART_SCALE } from './_frames.js';

// Slightly taller canvas than the hen (22) to fit the tall comb + arched tail plumes.
export const ROOSTER_W = 18, ROOSTER_H = 26;

// Five feather coat variants — richer/darker than the hen coats, and every rooster gets
// a golden-green iridescent sickle tail. `saddle` is the golden neck/back hackle sheen.
export const ROOSTER_COATS = [
  // classic red-brown gamecock
  { body: 0x8a2a14, bodyHi: 0xa8381c, bodyLo: 0x681c0c, wing: 0x5a180a, wingLo: 0x401006, saddle: 0xd89828, tail: 0x1c3a20, tailHi: 0x2e6a3a, tailDark: 0x102414 },
  // black-breasted with green sickle
  { body: 0x241f1a, bodyHi: 0x3a332c, bodyLo: 0x14100c, wing: 0x181410, wingLo: 0x0e0b08, saddle: 0xc88a2a, tail: 0x143824, tailHi: 0x246a44, tailDark: 0x0a2016 },
  // golden buff
  { body: 0xd89838, bodyHi: 0xf0b858, bodyLo: 0xb47820, wing: 0x9c6418, wingLo: 0x7a4c10, saddle: 0xf4d060, tail: 0x5a3a12, tailHi: 0x8a5c1e, tailDark: 0x3c2608 },
  // slate blue
  { body: 0x4a5464, bodyHi: 0x66727e, bodyLo: 0x343c48, wing: 0x2e3640, wingLo: 0x20262e, saddle: 0xc0842e, tail: 0x1e2a34, tailHi: 0x38505e, tailDark: 0x121a20 },
  // white leghorn (yellow-gold accents)
  { body: 0xf0ece2, bodyHi: 0xffffff, bodyLo: 0xd6cfc0, wing: 0xdcd4c4, wingLo: 0xc2b9a6, saddle: 0xe8c256, tail: 0xbcb4a4, tailHi: 0xe4dccb, tailDark: 0x9a917e },
];

const COMB   = 0xe22222; // bright red comb + wattle
const COMB_HI = 0xf25050;
const LEG    = 0xe0b028; // yellow legs (a touch deeper than the hen)
const LEG_LO = 0xb88818;
const BEAK   = 0xf0c838;
const BEAK_LO = 0xc89818;

function drawRooster(g, bob, phase, coat = ROOSTER_COATS[0]) {
  const { body, bodyHi, bodyLo, wing, wingLo, saddle, tail, tailHi, tailDark } = coat;
  // Two legs step on the walk-cycle phases (1 & 3), like the hen — taller legs though.
  const lL = phase === 1 ? 2 : 0;
  const lR = phase === 3 ? 2 : 0;

  g.layer('legs');
  // Tall yellow legs with scaly feet — the rooster stands proud and upright.
  g.fillStyle(LEG, 1);
  g.fillRect(6, 18+bob, 2, 6-lL); g.fillRect(11, 18+bob, 2, 6-lR);
  g.fillStyle(LEG_LO, 1);
  g.fillRect(4, 24+bob-lL, 5, 1); g.fillRect(9, 24+bob-lR, 5, 1);
  // Little spurs on the back of each leg (a cockerel signature).
  g.fillStyle(LEG_LO, 1);
  g.fillRect(5, 21+bob-lL, 1, 2); g.fillRect(10, 21+bob-lR, 1, 2);

  g.layer('tail');
  // Long arched sickle plumes sweeping up-and-back behind the body.
  g.fillStyle(tailDark, 1); g.fillRect(0, 8+bob, 3, 8);
  g.fillStyle(tail, 1);     g.fillRect(1, 4+bob, 3, 8);
  g.fillStyle(tailHi, 1);   g.fillRect(2, 2+bob, 3, 6);   // top sickle catches the light
  g.fillStyle(tail, 1);     g.fillRect(3, 1+bob, 2, 4);   // curling tip

  g.layer('body');
  // Bigger, rounder body than the hen; puffed forward chest.
  g.fillStyle(body, 1);    g.fillRect(3, 11+bob, 12, 9);
  g.fillStyle(bodyHi, 1);  g.fillRect(3, 11+bob, 12, 2);
  g.fillStyle(bodyLo, 1);  g.fillRect(3, 17+bob, 12, 3);
  // Proud chest bulge at the front-lower edge.
  g.fillStyle(body, 1);    g.fillRect(13, 13+bob, 3, 6);
  g.fillStyle(bodyLo, 1);  g.fillRect(13, 17+bob, 3, 2);

  g.layer('wing');
  g.fillStyle(wing, 1);    g.fillRect(4, 12+bob, 9, 6);
  g.fillStyle(wingLo, 1);  g.fillRect(4, 16+bob, 9, 2);
  // A couple of folded wing-tip feathers.
  g.fillStyle(wingLo, 1);  g.fillRect(3, 15+bob, 2, 3);

  g.layer('neck');
  // Golden hackle (saddle) sheen cascading down the neck — the rooster's collar.
  g.fillStyle(saddle, 1);  g.fillRect(13, 7+bob, 4, 7);
  g.fillStyle(body, 1);    g.fillRect(13, 12+bob, 3, 3);

  g.layer('head');
  g.fillStyle(body, 1);    g.fillRect(13, 2+bob, 5, 6);
  g.fillStyle(bodyHi, 1);  g.fillRect(13, 2+bob, 5, 2);

  g.layer('comb');
  // Large multi-point serrated comb across the top of the head.
  g.fillStyle(COMB, 1);
  g.fillRect(13, -1+bob, 2, 3); g.fillRect(15, -2+bob, 2, 4);
  g.fillRect(17, -1+bob, 2, 3); g.fillRect(14, 1+bob, 5, 2);
  g.fillStyle(COMB_HI, 1); g.fillRect(15, -2+bob, 1, 2);

  g.layer('wattle');
  // Long paired wattles dangling under the beak.
  g.fillStyle(COMB, 1);   g.fillRect(15, 8+bob, 2, 4); g.fillRect(17, 7+bob, 1, 3);
  g.fillStyle(COMB_HI, 1); g.fillRect(15, 8+bob, 1, 2);

  g.layer('beak');
  g.fillStyle(BEAK, 1);    g.fillRect(18, 4+bob, 2, 2);
  g.fillStyle(BEAK_LO, 1); g.fillRect(18, 6+bob, 2, 1);

  g.layer('eye');
  g.fillStyle(0x1a0800, 1); g.fillRect(15, 4+bob, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(15, 4+bob, 1, 1);
}

// Pecking pose — peckDepth 0 = beak lifted, 2 = beak at ground. Mirrors the hen's eat.
function drawRoosterEat(g, peckDepth, coat = ROOSTER_COATS[0]) {
  const { body, bodyHi, bodyLo, wing, wingLo, saddle, tail, tailHi, tailDark } = coat;

  g.layer('legs');
  g.fillStyle(LEG, 1);    g.fillRect(6, 18, 2, 6); g.fillRect(11, 18, 2, 6);
  g.fillStyle(LEG_LO, 1); g.fillRect(4, 24, 5, 1); g.fillRect(9, 24, 5, 1);
  g.fillRect(5, 21, 1, 2); g.fillRect(10, 21, 1, 2); // spurs

  g.layer('tail');
  g.fillStyle(tailDark, 1); g.fillRect(0, 5, 3, 8);
  g.fillStyle(tail, 1);     g.fillRect(1, 2, 3, 7);
  g.fillStyle(tailHi, 1);   g.fillRect(2, 0, 3, 5);
  g.fillStyle(tail, 1);     g.fillRect(3, 0, 2, 3);

  g.layer('body');
  g.fillStyle(body, 1);    g.fillRect(3, 11, 12, 9);
  g.fillStyle(bodyHi, 1);  g.fillRect(3, 11, 12, 2);
  g.fillStyle(bodyLo, 1);  g.fillRect(3, 17, 12, 3);
  g.fillStyle(body, 1);    g.fillRect(13, 13, 3, 6);
  g.layer('wing');
  g.fillStyle(wing, 1);    g.fillRect(4, 12, 9, 6);
  g.fillStyle(wingLo, 1);  g.fillRect(4, 16, 9, 2);

  g.layer('neck');
  // Neck stretched down toward the ground to peck.
  g.fillStyle(saddle, 1);  g.fillRect(14, 11, 4, 5);

  g.layer('head');
  const hy = 15 + peckDepth;
  g.fillStyle(body, 1);    g.fillRect(14, hy, 5, 5);
  g.fillStyle(bodyHi, 1);  g.fillRect(14, hy, 5, 1);
  g.layer('comb');
  g.fillStyle(COMB, 1);
  g.fillRect(14, hy-2, 2, 2); g.fillRect(16, hy-3, 2, 3); g.fillRect(18, hy-2, 1, 2);
  g.layer('wattle');
  g.fillStyle(COMB, 1); g.fillRect(16, hy+3, 2, 3);
  g.layer('beak');
  g.fillStyle(BEAK, 1); g.fillRect(18, hy+3, 2, 2);
  g.layer('eye');
  g.fillStyle(0x1a0800, 1); g.fillRect(15, hy+1, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(15, hy+1, 1, 1);
}

// Crow pose (#269) — head thrown back and up, beak wide open skyward, neck fully
// extended: the classic dawn cock-a-doodle-doo silhouette. Two frames (mid-crow +
// full-crow) so the crow visibly animates when it fires at dawn.
function drawRoosterCrow(g, open, coat = ROOSTER_COATS[0]) {
  const { body, bodyHi, bodyLo, wing, wingLo, saddle, tail, tailHi, tailDark } = coat;
  const lift = open; // 0 = starting to raise, 1 = fully thrown back

  g.layer('legs');
  g.fillStyle(LEG, 1);    g.fillRect(6, 18, 2, 6); g.fillRect(11, 18, 2, 6);
  g.fillStyle(LEG_LO, 1); g.fillRect(4, 24, 5, 1); g.fillRect(9, 24, 5, 1);
  g.fillRect(5, 21, 1, 2); g.fillRect(10, 21, 1, 2); // spurs

  g.layer('tail');
  // Tail flared high during the crow.
  g.fillStyle(tailDark, 1); g.fillRect(0, 6, 3, 8);
  g.fillStyle(tail, 1);     g.fillRect(1, 2, 3, 8);
  g.fillStyle(tailHi, 1);   g.fillRect(2, 0, 3, 6);
  g.fillStyle(tail, 1);     g.fillRect(3, 0, 2, 3);

  g.layer('body');
  // Chest puffed and drawn up — the whole bird rears back into the crow.
  g.fillStyle(body, 1);    g.fillRect(3, 11, 12, 9);
  g.fillStyle(bodyHi, 1);  g.fillRect(3, 11, 12, 2);
  g.fillStyle(bodyLo, 1);  g.fillRect(3, 17, 12, 3);
  g.fillStyle(body, 1);    g.fillRect(13, 12, 3, 6);
  g.layer('wing');
  g.fillStyle(wing, 1);    g.fillRect(4, 12, 9, 6);
  g.fillStyle(wingLo, 1);  g.fillRect(4, 16, 9, 2);

  g.layer('neck');
  // Neck arched up and back, golden hackles stretched.
  g.fillStyle(saddle, 1);  g.fillRect(13, 5-lift, 4, 8);
  g.fillStyle(body, 1);    g.fillRect(13, 11, 3, 3);

  g.layer('head');
  // Head thrown back and up, tilted skyward.
  const hy = 0 - lift;
  g.fillStyle(body, 1);    g.fillRect(14, hy+1, 5, 5);
  g.fillStyle(bodyHi, 1);  g.fillRect(14, hy+1, 5, 2);

  g.layer('comb');
  g.fillStyle(COMB, 1);
  g.fillRect(13, hy-2, 2, 3); g.fillRect(15, hy-3, 2, 4);
  g.fillRect(17, hy-2, 2, 3); g.fillRect(14, hy, 5, 2);
  g.fillStyle(COMB_HI, 1); g.fillRect(15, hy-3, 1, 2);

  g.layer('wattle');
  // Wattle swings forward as the head rears back.
  g.fillStyle(COMB, 1);   g.fillRect(15, hy+6, 2, 4); g.fillRect(14, hy+7, 1, 3);
  g.fillStyle(COMB_HI, 1); g.fillRect(15, hy+6, 1, 2);

  g.layer('beak');
  // Beak WIDE OPEN, angled up to the sky — the crow. `open` splits the mandibles.
  g.fillStyle(BEAK, 1);    g.fillRect(18, hy+1, 3, 1);              // upper mandible
  g.fillStyle(BEAK_LO, 1); g.fillRect(18, hy+3+open, 3, 1);         // lower mandible drops open
  if (open) { g.fillStyle(0x7a1010, 1); g.fillRect(18, hy+2, 2, 1); } // open throat

  g.layer('eye');
  g.fillStyle(0x1a0800, 1); g.fillRect(15, hy+2, 2, 2);
  g.fillStyle(0xffffff, 0.85); g.fillRect(15, hy+2, 1, 1);
}

export function buildRoosterTextures(scene, key, coat) {
  const phases = [0, 0, 0, 1, 2, 3];
  const bobs   = [0, 1, 0, 1, 0, 1];
  const names  = ['idle_0','idle_1','walk_0','walk_1','walk_2','walk_3'];
  const W = ROOSTER_W * ART_SCALE, H = ROOSTER_H * ART_SCALE;
  names.forEach((name, i) => {
    gen(scene, `${key}_${name}`, W, H, g0 => drawRooster(scaledGraphics(g0), bobs[i], phases[i], coat));
  });
  // Eat (peck) frames: beak at ground / beak lifted
  gen(scene, `${key}_eat_0`, W, H, g0 => drawRoosterEat(scaledGraphics(g0), 2, coat));
  gen(scene, `${key}_eat_1`, W, H, g0 => drawRoosterEat(scaledGraphics(g0), 0, coat));
  // Crow frames (#269): head rearing back / full cock-a-doodle-doo. Played by the
  // dawn-crow behavior; aliased to `crow_<key>` in creatures.js if lay-style gating
  // registers it (see rooster spawn wiring).
  gen(scene, `${key}_crow_0`, W, H, g0 => drawRoosterCrow(scaledGraphics(g0), 0, coat));
  gen(scene, `${key}_crow_1`, W, H, g0 => drawRoosterCrow(scaledGraphics(g0), 1, coat));
}
