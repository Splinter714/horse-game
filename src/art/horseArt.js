// Procedural pixel-art horse sprite. Draws the elegant side-view body from a coat's
// 3-tone ramp into Phaser textures: 2 idle frames (breathing bob) and 4 walk frames
// (stepping legs). These are the "placeholder" sprites from the plan — swap in
// hand-drawn art later by replacing these texture keys.

export const FRAME_W = 64;
export const FRAME_H = 54;

const WHITE = 0xf4efe6;
const SOCK = 0xf0ead0;
const EAR_PINK = 0xe0a890;

// Leg lift patterns per frame: [hindFar, hindNear, foreFar, foreNear]
const IDLE_LEGS = [0, 0, 0, 0];
const WALK_LEGS = [
  [0, 0, 0, 0],
  [3, 0, 0, 3],
  [0, 0, 0, 0],
  [0, 3, 3, 0]
];

function leg(g, x, lift, tone, hoof, sock, featherColor) {
  const topY = 35;
  const fullH = 15;
  const h = fullH - lift;
  g.fillStyle(tone, 1);
  g.fillRect(x, topY, 4, h);
  if (sock) {
    g.fillStyle(SOCK, 1);
    g.fillRect(x, topY + h - 7, 4, 7);
  }
  g.fillStyle(hoof, 1);
  g.fillRect(x, topY + h, 4, 3);
  if (featherColor !== undefined) {
    // Feathering: a wider fluffy tuft above the hoof, widens toward the ground.
    g.fillStyle(featherColor, 1);
    g.fillRect(x - 1, topY + h - 5, 6, 3); // mid tuft
    g.fillRect(x - 2, topY + h - 2, 8, 3); // wide base fringe
  }
}

function drawHorse(g, coat, bob, legLift) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // --- legs first (behind body), far legs in shadow tone ---
  const feather = mk.feather ? m.mid : undefined;
  leg(g, 7,  legLift[0], b.lo, coat.hoof, false,      feather); // hind far
  leg(g, 38, legLift[2], b.lo, coat.hoof, false,      feather); // fore far
  leg(g, 13, legLift[1], b.mid, coat.hoof, false,     feather); // hind near
  leg(g, 44, legLift[3], b.mid, coat.hoof, !!mk.sock, feather); // fore near (sock)

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

  // optional paint patches (large white irregular blotches over body)
  if (mk.paint) {
    g.fillStyle(WHITE, 1);
    g.fillRect(14, 19 + bob, 14, 12); // big patch on side/barrel
    g.fillRect(28, 23 + bob, 8, 8);   // second patch
    g.fillRect(10, 22 + bob, 5, 9);   // rump patch
    g.fillRect(43, 20 + bob, 5, 7);   // chest patch
    g.fillStyle(0xe8e0d0, 1);         // slight shadow edge on patches
    g.fillRect(14, 29 + bob, 14, 2);
    g.fillRect(28, 29 + bob, 8, 2);
  }

  // optional dapples
  if (mk.dapples) {
    g.fillStyle(b.hi, 0.6);
    g.fillCircle(22, 27 + bob, 3);
    g.fillCircle(31, 30 + bob, 2.5);
    g.fillCircle(38, 26 + bob, 2.5);
    g.fillCircle(44, 29 + bob, 2);
  }

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

  // markings on face (disabled until art is more refined)
  // if (mk.blaze) { g.fillStyle(WHITE, 1); g.fillRect(52, 4 + bob, 2, 9); }
  // else if (mk.star) { g.fillStyle(WHITE, 1); g.fillRect(53, 5 + bob, 2, 3); }

  // eye
  g.fillStyle(coat.eye, 1); g.fillRect(50, 7 + bob, 2, 2);
  g.fillStyle(WHITE, 0.8); g.fillRect(50, 7 + bob, 1, 1);

  // --- mane (over neck) ---
  g.fillStyle(m.mid, 1); g.fillRect(43, 3 + bob, 3, 6);
  g.fillStyle(m.lo, 1); g.fillRect(41, 9 + bob, 3, 8);
  g.fillStyle(m.mid, 1); g.fillRect(40, 16 + bob, 3, 9);
  g.fillStyle(m.lo, 1); g.fillRect(40, 24 + bob, 2, 6);
}

// Horse eating/drinking: head drops to ground level, body stays the same.
function drawHorseEat(g, coat, bob) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // Legs all planted
  leg(g, 7,  0, b.lo,  coat.hoof, false);
  leg(g, 38, 0, b.lo,  coat.hoof, false);
  leg(g, 13, 0, b.mid, coat.hoof, false);
  leg(g, 44, 0, b.mid, coat.hoof, !!mk.sock);

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

  if (mk.dapples) {
    g.fillStyle(b.hi, 0.6);
    g.fillCircle(22, 27 + bob, 3); g.fillCircle(31, 30 + bob, 2.5);
    g.fillCircle(38, 26 + bob, 2.5); g.fillCircle(44, 29 + bob, 2);
  }

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
  // Eye on upper part of skull
  g.fillStyle(coat.eye, 1);  g.fillRect(50, headY + 1, 2, 2);
  g.fillStyle(WHITE, 0.8);   g.fillRect(50, headY + 1, 1, 1);

  // Mane follows neck down
  g.fillStyle(m.mid, 1); g.fillRect(41, 20 + bob, 3, 5);
  g.fillStyle(m.lo, 1);  g.fillRect(40, 24 + bob, 3, 8);
  g.fillStyle(m.mid, 1); g.fillRect(42, 30 + bob, 3, 8);
  g.fillStyle(m.lo, 1);  g.fillRect(43, 36 + bob, 2, 4);
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

function legFoal(g, x, lift, tone, hoof) {
  const topY = 24, fullH = 10;
  const h = fullH - lift;
  g.fillStyle(tone, 1); g.fillRect(x, topY, 3, h);
  g.fillStyle(hoof, 1); g.fillRect(x, topY + h, 3, 2);
}

function drawFoal(g, coat, bob, legLift) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // Legs — long relative to body (classic foal proportion)
  legFoal(g, 7,  legLift[0], b.lo,  coat.hoof);
  legFoal(g, 27, legLift[2], b.lo,  coat.hoof);
  legFoal(g, 11, legLift[1], b.mid, coat.hoof);
  legFoal(g, 31, legLift[3], b.mid, coat.hoof);

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

  if (mk.paint) {
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
  ];
  for (const f of frames) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    drawFoal(g, coat, f.bob, f.legs);
    g.generateTexture(`${baseKey}_${f.name}`, FOAL_W, FOAL_H);
    g.destroy();
  }
}

// Builds idle_0, idle_1, walk_0..3 textures under `${baseKey}_...`.
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
    { name: 'eat_1', bob: 1, eat: true }
  );

  for (const f of frames) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    if (f.eat) drawHorseEat(g, coat, f.bob);
    else drawHorse(g, coat, f.bob, f.legs);
    g.generateTexture(`${baseKey}_${f.name}`, FRAME_W, FRAME_H);
    g.destroy();
  }
}
