// Procedural pixel-art barnyard animals. All sprites face right, origin (0.5,1) — feet at bottom.
// Rendered at scale 2. Each species has idle_0/1 and walk_0..3 frame textures.

// Walk leg pattern — alternating diagonals [hindFar, hindNear, foreFar, foreNear]
const W4 = [ [0,0,0,0], [3,0,0,3], [0,0,0,0], [0,3,3,0] ];

function gen(scene, key, w, h, drawFn) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  drawFn(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function buildFrames(scene, baseKey, w, h, drawFn, legSets) {
  const names = ['idle_0','idle_1','walk_0','walk_1','walk_2','walk_3'];
  const bobs  = [0, 1, 0, 1, 0, 1];
  legSets.forEach((legs, i) => {
    gen(scene, `${baseKey}_${names[i]}`, w, h, g => drawFn(g, bobs[i], legs));
  });
}

// ─── COW (52×40) ─────────────────────────────────────────────────────────────

export const COW_W = 52, COW_H = 40;

function drawCow(g, bob, [lhf, lhn, lff, lfn]) {
  const hoof = 0x2a2020;
  const legL = (x, lift, tone) => {
    g.fillStyle(tone, 1);    g.fillRect(x, 27+bob, 5, 11-lift);
    g.fillStyle(hoof, 1);    g.fillRect(x, 38+bob-lift, 5, 2);
  };
  legL(6,  lhf, 0x2a2020); legL(33, lff, 0x2a2020);
  legL(11, lhn, 0x3a3030); legL(37, lfn, 0x3a3030);

  // Tail with tuft
  g.fillStyle(0xb09080, 1); g.fillRect(3, 18+bob, 2, 8);
  g.fillStyle(0x3a3030, 1); g.fillRect(2, 25+bob, 3, 5);

  // Udder
  g.fillStyle(0xf4b4b4, 1); g.fillRect(14, 28+bob, 16, 5);
  g.fillStyle(0xe89898, 1); g.fillRect(14, 31+bob, 16, 2);
  g.fillStyle(0xe08080, 1);
  g.fillRect(16, 33+bob, 2, 2); g.fillRect(21, 33+bob, 2, 2); g.fillRect(26, 33+bob, 2, 2);

  // Body
  g.fillStyle(0xf0ece4, 1); g.fillRect(5, 14+bob, 38, 16);
  g.fillStyle(0xffffff, 1); g.fillRect(5, 14+bob, 38, 3);
  g.fillStyle(0xe0dcd4, 1); g.fillRect(5, 27+bob, 38, 3);
  g.fillStyle(0xf0ece4, 1); g.fillRect(4, 16+bob, 1, 10); // rump curve

  // Black patches
  g.fillStyle(0x1a1818, 1);
  g.fillRect(6,  14+bob, 12, 10);
  g.fillRect(31, 15+bob, 9,  9);
  g.fillRect(20, 20+bob, 6,  7);

  // Neck
  g.fillStyle(0xf0ece4, 1); g.fillRect(39, 10+bob, 6, 8);
  g.fillStyle(0x1a1818, 1); g.fillRect(40, 10+bob, 3, 4);

  // Head
  g.fillStyle(0xf0ece4, 1); g.fillRect(39, 3+bob, 13, 10);
  g.fillStyle(0xffffff, 1); g.fillRect(39, 3+bob, 13, 2);
  // Muzzle
  g.fillStyle(0xf0c0a0, 1); g.fillRect(46, 7+bob, 6, 6);
  g.fillStyle(0xd0a080, 1); g.fillRect(47, 10+bob, 2, 1); g.fillRect(50, 10+bob, 2, 1);
  // Horn
  g.fillStyle(0xe0d080, 1); g.fillRect(40, 1+bob, 2, 4);
  // Ear
  g.fillStyle(0xf0ece4, 1); g.fillRect(38, 5+bob, 2, 3);
  g.fillStyle(0xf4b0a0, 1); g.fillRect(38, 6+bob, 1, 2);
  // Eye
  g.fillStyle(0x1a0e00, 1); g.fillRect(43, 6+bob, 2, 2);
  g.fillStyle(0xffffff, 0.8); g.fillRect(43, 6+bob, 1, 1);
}

function buildCowTextures(scene, key) {
  buildFrames(scene, key, COW_W, COW_H, drawCow, [
    [0,0,0,0],[0,0,0,0], ...W4
  ]);
}

// ─── SHEEP (40×30) ───────────────────────────────────────────────────────────

export const SHEEP_W = 40, SHEEP_H = 30;

const W4S = [ [0,0,0,0], [2,0,0,2], [0,0,0,0], [0,2,2,0] ];

function drawSheep(g, bob, [lhf, lhn, lff, lfn]) {
  const legS = (x, lift, tone) => {
    g.fillStyle(tone, 1); g.fillRect(x, 22+bob, 3, 6-lift);
    g.fillStyle(0x2a1e14, 1); g.fillRect(x-1, 28+bob-lift, 5, 2);
  };
  legS(6,  lhf, 0x2a1e14); legS(26, lff, 0x2a1e14);
  legS(10, lhn, 0x3a2e24); legS(30, lfn, 0x3a2e24);

  // Tail stub
  g.fillStyle(0xf0ece8, 1); g.fillRect(3, 16+bob, 3, 4);

  // Fluffy wool body — bumpy outline
  g.fillStyle(0xf0ece8, 1);
  g.fillRect(6,  12+bob, 28, 14);
  g.fillRect(4,  14+bob, 2,  10);   // left bump
  g.fillRect(34, 13+bob, 2,  10);   // right bump
  g.fillRect(8,  10+bob, 6,  4);    // top-left bump
  g.fillRect(17,  9+bob, 7,  4);    // top-mid bump
  g.fillRect(26, 10+bob, 6,  4);    // top-right bump
  // Wool shading
  g.fillStyle(0xd8d4d0, 1); g.fillRect(6,  22+bob, 28, 4);
  g.fillStyle(0xe8e4e0, 1);
  g.fillRect(9, 13+bob, 3, 3); g.fillRect(18, 11+bob, 3, 3); g.fillRect(27, 12+bob, 3, 3);

  // Dark face
  g.fillStyle(0x2a1e14, 1); g.fillRect(30, 11+bob, 10, 10);
  g.fillStyle(0x3a2e24, 1); g.fillRect(30, 11+bob, 10, 2);
  // Nose
  g.fillStyle(0xe0a090, 1); g.fillRect(37, 16+bob, 3, 4);
  g.fillStyle(0xc08070, 1); g.fillRect(38, 18+bob, 1, 1);
  // Floppy ear
  g.fillStyle(0x3a2e24, 1); g.fillRect(29, 12+bob, 2, 5);
  g.fillStyle(0xe0a090, 1); g.fillRect(29, 13+bob, 1, 3);
  // Amber slit-pupil eye
  g.fillStyle(0xf0c080, 1); g.fillRect(33, 14+bob, 2, 2);
  g.fillStyle(0x1a0800, 1); g.fillRect(33, 14+bob, 1, 2);
}

function buildSheepTextures(scene, key) {
  buildFrames(scene, key, SHEEP_W, SHEEP_H, drawSheep, [
    [0,0,0,0],[0,0,0,0], ...W4S
  ]);
}

// ─── PIG (32×26) ─────────────────────────────────────────────────────────────

export const PIG_W = 32, PIG_H = 26;

const W4P = [ [0,0,0,0], [2,0,0,2], [0,0,0,0], [0,2,2,0] ];

function drawPig(g, bob, [lhf, lhn, lff, lfn]) {
  const legP = (x, lift, tone) => {
    g.fillStyle(tone, 1); g.fillRect(x, 18+bob, 3, 6-lift);
    g.fillStyle(0xa05050, 1); g.fillRect(x-1, 24+bob-lift, 5, 2);
  };
  legP(5,  lhf, 0xd07878); legP(19, lff, 0xd07878);
  legP(8,  lhn, 0xe08888); legP(22, lfn, 0xe08888);

  // Curly tail (3-pixel curl)
  g.fillStyle(0xe07878, 1);
  g.fillRect(2, 11+bob, 2, 2);
  g.fillRect(1, 13+bob, 2, 2);
  g.fillRect(2, 15+bob, 2, 2);

  // Body (round pink)
  g.fillStyle(0xf4a0a0, 1); g.fillRect(4, 8+bob, 24, 14);
  g.fillStyle(0xf8c0c0, 1); g.fillRect(4, 8+bob, 24, 4);
  g.fillStyle(0xe08080, 1); g.fillRect(4, 18+bob, 24, 4);
  g.fillStyle(0xf4a0a0, 1); g.fillRect(3, 10+bob, 1, 8); // rump curve
  g.fillStyle(0xf8c0c0, 1); g.fillRect(3, 10+bob, 1, 2);

  // Head
  g.fillStyle(0xf4a0a0, 1); g.fillRect(23, 6+bob, 9, 12);
  g.fillStyle(0xf8c0c0, 1); g.fillRect(23, 6+bob, 9, 2);
  // Round snout
  g.fillStyle(0xe07878, 1); g.fillRect(28, 10+bob, 4, 5);
  g.fillStyle(0xc05858, 1); g.fillRect(29, 12+bob, 1, 1); g.fillRect(31, 12+bob, 1, 1);
  // Ear (triangular, flopped forward)
  g.fillStyle(0xf4a0a0, 1); g.fillRect(23, 3+bob, 4, 5);
  g.fillStyle(0xe07878, 1); g.fillRect(24, 4+bob, 2, 4);
  // Eye
  g.fillStyle(0x2a1010, 1); g.fillRect(25, 9+bob, 2, 2);
  g.fillStyle(0xffffff, 0.8); g.fillRect(25, 9+bob, 1, 1);
}

function buildPigTextures(scene, key) {
  buildFrames(scene, key, PIG_W, PIG_H, drawPig, [
    [0,0,0,0],[0,0,0,0], ...W4P
  ]);
}

// ─── DOG (28×24) — golden retriever ──────────────────────────────────────────

export const DOG_W = 28, DOG_H = 24;

const W4D = [ [0,0,0,0], [2,0,0,2], [0,0,0,0], [0,2,2,0] ];

function drawDog(g, bob, [lhf, lhn, lff, lfn]) {
  const legD = (x, lift, tone) => {
    g.fillStyle(tone, 1); g.fillRect(x, 17+bob, 3, 6-lift);
    g.fillStyle(0x2a2018, 1); g.fillRect(x-1, 23+bob-lift, 5, 1);
  };
  legD(5,  lhf, 0xb07828); legD(17, lff, 0xb07828);
  legD(8,  lhn, 0xc48830); legD(20, lfn, 0xc48830);

  // Tail wagging up
  g.fillStyle(0xc48830, 1); g.fillRect(2, 7+bob, 2, 7);
  g.fillStyle(0xd4983c, 1); g.fillRect(1, 7+bob, 1, 5);

  // Body
  g.fillStyle(0xd4943c, 1); g.fillRect(4, 10+bob, 20, 10);
  g.fillStyle(0xe8b054, 1); g.fillRect(4, 10+bob, 20, 3);
  g.fillStyle(0xb07828, 1); g.fillRect(4, 17+bob, 20, 3);
  g.fillStyle(0xd4943c, 1); g.fillRect(3, 12+bob, 1, 6);

  // Red collar
  g.fillStyle(0xe03030, 1); g.fillRect(20, 12+bob, 5, 2);
  g.fillStyle(0xc02020, 1); g.fillRect(22, 14+bob, 2, 1); // tag

  // Neck
  g.fillStyle(0xd4943c, 1); g.fillRect(21, 8+bob, 5, 6);

  // Head
  g.fillStyle(0xd4943c, 1); g.fillRect(21, 2+bob, 7, 10);
  g.fillStyle(0xe8b054, 1); g.fillRect(21, 2+bob, 7, 2);
  // Muzzle (cream)
  g.fillStyle(0xf0d898, 1); g.fillRect(25, 7+bob, 3, 5);
  g.fillStyle(0x3a2010, 1); g.fillRect(26, 8+bob, 2, 1); // nose
  // Floppy ear
  g.fillStyle(0xb07828, 1); g.fillRect(21, 3+bob, 2, 7);
  // Eye
  g.fillStyle(0x2a1808, 1); g.fillRect(23, 5+bob, 2, 2);
  g.fillStyle(0xffffff, 0.8); g.fillRect(23, 5+bob, 1, 1);
}

function buildDogTextures(scene, key) {
  buildFrames(scene, key, DOG_W, DOG_H, drawDog, [
    [0,0,0,0],[0,0,0,0], ...W4D
  ]);
}

// ─── CAT (22×20) — orange tabby ──────────────────────────────────────────────

export const CAT_W = 22, CAT_H = 20;

const W4C = [ [0,0,0,0], [2,0,0,2], [0,0,0,0], [0,2,2,0] ];

function drawCat(g, bob, [lhf, lhn, lff, lfn]) {
  const legC = (x, lift, tone) => {
    g.fillStyle(tone, 1); g.fillRect(x, 14+bob, 2, 5-lift);
    g.fillStyle(0x2a1408, 1); g.fillRect(x-1, 19+bob-lift, 4, 1);
  };
  legC(4,  lhf, 0xc04818); legC(14, lff, 0xc04818);
  legC(6,  lhn, 0xd85c28); legC(16, lfn, 0xd85c28);

  // Tail curling upward (left/back side)
  g.fillStyle(0xd85c28, 1);
  g.fillRect(1, 9+bob, 2, 7);
  g.fillRect(0, 6+bob, 2, 4);
  g.fillStyle(0xe87c30, 1); g.fillRect(1, 6+bob, 1, 3);

  // Body (sleek)
  g.fillStyle(0xe87c30, 1); g.fillRect(3, 9+bob, 16, 8);
  g.fillStyle(0xf09050, 1); g.fillRect(3, 9+bob, 16, 2);
  g.fillStyle(0xc05818, 1); g.fillRect(3, 14+bob, 16, 3);
  g.fillStyle(0xe87c30, 1); g.fillRect(2, 11+bob, 1, 5); // rump curve
  // Tabby stripes
  g.fillStyle(0xb84010, 1);
  g.fillRect(6, 10+bob, 1, 5); g.fillRect(11, 9+bob, 1, 6); g.fillRect(15, 10+bob, 1, 5);

  // Neck
  g.fillStyle(0xe87c30, 1); g.fillRect(17, 7+bob, 4, 6);

  // Head
  g.fillStyle(0xe87c30, 1); g.fillRect(16, 2+bob, 6, 8);
  g.fillStyle(0xf09050, 1); g.fillRect(16, 2+bob, 6, 2);
  // Pointed ears
  g.fillStyle(0xe87c30, 1); g.fillRect(16, 0+bob, 2, 3); g.fillRect(20, 0+bob, 2, 3);
  g.fillStyle(0xf4a0a0, 1); g.fillRect(17, 1+bob, 1, 2); g.fillRect(20, 1+bob, 1, 2);
  // Muzzle
  g.fillStyle(0xf8d0b0, 1); g.fillRect(19, 5+bob, 3, 4);
  g.fillStyle(0xd06868, 1); g.fillRect(20, 7+bob, 1, 1);
  // Big green eyes
  g.fillStyle(0x50a840, 1); g.fillRect(17, 3+bob, 2, 2); g.fillRect(20, 3+bob, 2, 2);
  g.fillStyle(0x1a0800, 1); g.fillRect(18, 3+bob, 1, 2); g.fillRect(21, 3+bob, 1, 2);
}

function buildCatTextures(scene, key) {
  buildFrames(scene, key, CAT_W, CAT_H, drawCat, [
    [0,0,0,0],[0,0,0,0], ...W4C
  ]);
}

// ─── CHICKEN (16×22) ─────────────────────────────────────────────────────────

export const CHICKEN_W = 16, CHICKEN_H = 22;

// Five feather coat variants
export const CHICKEN_COATS = [
  { body: 0xf0e8d8, bodyHi: 0xffffff, bodyLo: 0xd8d0c0, wing: 0xe0d8c8, wingLo: 0xc8c0b0, tail: 0xd4a050, tailDark: 0xb87830 }, // white
  { body: 0xa83820, bodyHi: 0xc04830, bodyLo: 0x882810, wing: 0x8c2c18, wingLo: 0x6c1c0c, tail: 0x7a2010, tailDark: 0x5a1408 }, // rhode island red
  { body: 0x282820, bodyHi: 0x404038, bodyLo: 0x181810, wing: 0x1c1c18, wingLo: 0x141410, tail: 0x303028, tailDark: 0x202018 }, // black
  { body: 0xe8c060, bodyHi: 0xf4d880, bodyLo: 0xc8a040, wing: 0xd4a848, wingLo: 0xb89038, tail: 0xc09030, tailDark: 0xa07020 }, // buff/golden
  { body: 0x909088, bodyHi: 0xb0b0a8, bodyLo: 0x707068, wing: 0x808078, wingLo: 0x606058, tail: 0x787870, tailDark: 0x585850 }, // grey
];

function drawChicken(g, bob, phase, coat = CHICKEN_COATS[0]) {
  const { body, bodyHi, bodyLo, wing, wingLo, tail, tailDark } = coat;
  const lL = phase === 1 ? 2 : 0;
  const lR = phase === 3 ? 2 : 0;

  g.fillStyle(0xe0c030, 1);
  g.fillRect(4, 16+bob, 2, 5-lL); g.fillRect(9, 16+bob, 2, 5-lR);
  g.fillStyle(0xb89820, 1);
  g.fillRect(2, 21+bob-lL, 5, 1); g.fillRect(7, 21+bob-lR, 5, 1);

  g.fillStyle(tail, 1);     g.fillRect(1, 9+bob, 3, 5);
  g.fillStyle(tailDark, 1); g.fillRect(1, 12+bob, 2, 4);

  g.fillStyle(body, 1);    g.fillRect(2, 10+bob, 12, 8);
  g.fillStyle(bodyHi, 1);  g.fillRect(2, 10+bob, 12, 2);
  g.fillStyle(bodyLo, 1);  g.fillRect(2, 15+bob, 12, 3);
  g.fillStyle(wing, 1);    g.fillRect(3, 11+bob, 9, 5);
  g.fillStyle(wingLo, 1);  g.fillRect(3, 14+bob, 9, 2);

  g.fillStyle(body, 1); g.fillRect(11, 7+bob, 4, 6);
  g.fillStyle(body, 1); g.fillRect(10, 2+bob, 6, 7);
  g.fillStyle(bodyHi, 1); g.fillRect(10, 2+bob, 6, 2);
  g.fillStyle(0xe03030, 1);
  g.fillRect(11, 0+bob, 2, 3); g.fillRect(13, 1+bob, 2, 2); g.fillRect(10, 1+bob, 2, 2);
  g.fillStyle(0xe03030, 1); g.fillRect(14, 6+bob, 2, 3);
  g.fillStyle(0xe0c030, 1); g.fillRect(15, 4+bob, 1, 2);
  g.fillStyle(0x1a0800, 1); g.fillRect(12, 4+bob, 2, 2); // eye
  g.fillStyle(0xffffff, 0.8); g.fillRect(12, 4+bob, 1, 1); // catchlight
}

// Pecking pose — peckDepth 0 = beak lifted, 2 = beak at ground
function drawChickenEat(g, peckDepth, coat = CHICKEN_COATS[0]) {
  const { body, bodyHi, bodyLo, wing, wingLo, tail, tailDark } = coat;

  // Legs — both grounded
  g.fillStyle(0xe0c030, 1); g.fillRect(4, 16, 2, 5); g.fillRect(9, 16, 2, 5);
  g.fillStyle(0xb89820, 1); g.fillRect(2, 21, 5, 1); g.fillRect(7, 21, 5, 1);

  // Tail raised as front dips
  g.fillStyle(tail, 1);     g.fillRect(1, 6, 3, 6);
  g.fillStyle(tailDark, 1); g.fillRect(1, 9, 2, 4);

  // Body
  g.fillStyle(body, 1);   g.fillRect(2, 10, 12, 8);
  g.fillStyle(bodyHi, 1); g.fillRect(2, 10, 12, 2);
  g.fillStyle(bodyLo, 1); g.fillRect(2, 15, 12, 3);
  g.fillStyle(wing, 1);   g.fillRect(3, 11, 9, 5);
  g.fillStyle(wingLo, 1); g.fillRect(3, 14, 9, 2);

  // Neck angled down-forward
  g.fillStyle(body, 1); g.fillRect(12, 12, 3, 6);

  // Head tilted down — peckDepth controls how far it dips
  const hy = 14 + peckDepth;
  g.fillStyle(body, 1);    g.fillRect(11, hy, 5, 5);
  g.fillStyle(bodyHi, 1);  g.fillRect(11, hy, 5, 1);
  g.fillStyle(0xe03030, 1); g.fillRect(12, hy - 1, 2, 2); // comb (small)
  g.fillStyle(0xe03030, 1); g.fillRect(14, hy + 3, 2, 2); // wattle
  g.fillStyle(0xe0c030, 1); g.fillRect(15, hy + 4, 1, 2); // beak pointing down
  g.fillStyle(0x1a0800, 1); g.fillRect(12, hy + 1, 2, 2); // eye
  g.fillStyle(0xffffff, 0.8); g.fillRect(12, hy + 1, 1, 1); // catchlight
}

function buildChickenTextures(scene, key, coat) {
  const phases = [0, 0, 0, 1, 2, 3];
  const bobs   = [0, 1, 0, 1, 0, 1];
  const names  = ['idle_0','idle_1','walk_0','walk_1','walk_2','walk_3'];
  names.forEach((name, i) => {
    gen(scene, `${key}_${name}`, CHICKEN_W, CHICKEN_H, g => drawChicken(g, bobs[i], phases[i], coat));
  });
  // Eat (peck) frames: beak at ground / beak lifted
  gen(scene, `${key}_eat_0`, CHICKEN_W, CHICKEN_H, g => drawChickenEat(g, 2, coat));
  gen(scene, `${key}_eat_1`, CHICKEN_W, CHICKEN_H, g => drawChickenEat(g, 0, coat));
}

// ─── Master builder ──────────────────────────────────────────────────────────

export function buildAnimalTextures(scene) {
  buildCowTextures(scene, 'cow');
  buildSheepTextures(scene, 'sheep');
  buildPigTextures(scene, 'pig');
  buildDogTextures(scene, 'dog');
  buildCatTextures(scene, 'cat');
  CHICKEN_COATS.forEach((coat, i) => buildChickenTextures(scene, `chicken${i}`, coat));
}
