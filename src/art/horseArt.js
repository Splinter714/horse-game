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

function leg(g, x, lift, tone, hoof, sock) {
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
}

function drawHorse(g, coat, bob, legLift) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};

  // --- legs first (behind body), far legs in shadow tone ---
  leg(g, 7,  legLift[0], b.lo, coat.hoof, false);            // hind far
  leg(g, 38, legLift[2], b.lo, coat.hoof, false);            // fore far
  leg(g, 13, legLift[1], b.mid, coat.hoof, false);           // hind near
  leg(g, 44, legLift[3], b.mid, coat.hoof, !!mk.sock);       // fore near (sock)

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

  for (const f of frames) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    drawHorse(g, coat, f.bob, f.legs);
    g.generateTexture(`${baseKey}_${f.name}`, FRAME_W, FRAME_H);
    g.destroy();
  }
}
