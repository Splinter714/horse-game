// The higher-fidelity static portrait (front-facing) for the stable screen — the
// "showcase" half of the hybrid art model. Smoother than the in-world sprite,
// since it never animates. Drawn from the same coat data.

const WHITE = 0xf4efe6;
const HORSE_SIZE = 200;
const CHICKEN_SIZE = 120;

export function buildPortraitTexture(scene, key, coat) {
  const b = coat.body;
  const m = coat.mane;
  const mk = coat.markings || {};
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // neck / chest
  g.fillStyle(b.mid, 1);
  g.fillPoints([{ x: 66, y: 118 }, { x: 134, y: 118 }, { x: 162, y: 200 }, { x: 38, y: 200 }], true);
  g.fillStyle(b.hi, 0.5); g.fillEllipse(78, 172, 40, 60);
  g.fillStyle(b.lo, 0.5); g.fillEllipse(132, 176, 40, 60);

  // mane on both sides of the neck
  g.fillStyle(m.hi, 1); g.fillEllipse(54, 150, 30, 64);
  g.fillStyle(m.mid, 1); g.fillEllipse(50, 160, 18, 48);
  g.fillStyle(m.mid, 1); g.fillEllipse(148, 154, 26, 60);
  g.fillStyle(m.lo, 1); g.fillEllipse(151, 164, 16, 44);

  // ears
  g.fillStyle(b.mid, 1); g.fillTriangle(72, 48, 60, 12, 92, 44);
  g.fillStyle(0xe0a890, 1); g.fillTriangle(75, 44, 67, 20, 86, 42);
  g.fillStyle(b.lo, 1); g.fillTriangle(128, 48, 140, 12, 108, 44);
  g.fillStyle(0xd09080, 1); g.fillTriangle(125, 44, 133, 20, 114, 42);

  // skull
  g.fillStyle(b.mid, 1); g.fillEllipse(100, 72, 74, 66);
  g.fillStyle(b.hi, 1); g.fillEllipse(84, 66, 36, 46);
  g.fillStyle(b.lo, 0.7); g.fillEllipse(122, 82, 28, 48);

  // lower face
  g.fillStyle(b.mid, 1); g.fillEllipse(100, 122, 54, 62);
  g.fillStyle(b.hi, 1); g.fillEllipse(89, 116, 24, 42);
  g.fillStyle(b.lo, 0.7); g.fillEllipse(116, 126, 24, 44);

  // muzzle
  g.fillStyle(b.lo, 1); g.fillEllipse(100, 152, 48, 36);
  g.fillStyle(b.mid, 1); g.fillEllipse(100, 155, 36, 24);

  // face markings
  if (mk.blaze) {
    g.fillStyle(WHITE, 1);
    g.fillEllipse(100, 68, 18, 24);
    g.fillRoundedRect(92, 66, 16, 66, 5);
    g.fillEllipse(100, 132, 22, 22);
  } else if (mk.star) {
    g.fillStyle(WHITE, 1);
    g.fillEllipse(100, 66, 16, 20);
  }

  // forelock
  g.fillStyle(m.hi, 1); g.fillEllipse(100, 46, 30, 22);
  g.fillStyle(m.mid, 1); g.fillRect(91, 48, 5, 17);
  g.fillStyle(m.hi, 1); g.fillRect(98, 50, 5, 19);
  g.fillStyle(m.lo, 1); g.fillRect(104, 48, 5, 15);

  // eyes
  g.fillStyle(coat.eye, 1); g.fillEllipse(82, 86, 12, 15);
  g.fillStyle(WHITE, 0.85); g.fillCircle(80, 83, 2);
  g.fillStyle(coat.eye, 1); g.fillEllipse(118, 86, 12, 15);
  g.fillStyle(WHITE, 0.85); g.fillCircle(116, 83, 2);

  // nostrils + mouth
  g.fillStyle(0x6a3a10, 1);
  g.fillEllipse(90, 150, 7, 9);
  g.fillEllipse(110, 150, 7, 9);
  g.fillStyle(0x7a4a1c, 1); g.fillRoundedRect(92, 160, 16, 2, 1);

  g.generateTexture(key, HORSE_SIZE, HORSE_SIZE);
  g.destroy();
}

export function buildChickenPortraitTexture(scene, key, coat) {
  const { body, bodyHi, bodyLo, wing, wingLo, tail, tailDark } = coat;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Legs
  g.fillStyle(0xe0c030, 1);
  g.fillRect(35, 85, 8, 20); g.fillRect(77, 85, 8, 20);
  g.fillStyle(0xb89820, 1);
  g.fillRect(32, 105, 14, 3); g.fillRect(74, 105, 14, 3);

  // Tail
  g.fillStyle(tail, 1); g.fillRect(8, 40, 12, 20);
  g.fillStyle(tailDark, 1); g.fillRect(8, 50, 8, 15);

  // Body
  g.fillStyle(body, 1); g.fillRect(25, 50, 50, 35);
  g.fillStyle(bodyHi, 1); g.fillRect(25, 50, 50, 8);
  g.fillStyle(bodyLo, 1); g.fillRect(25, 75, 50, 10);
  g.fillStyle(wing, 1); g.fillRect(30, 55, 35, 18);
  g.fillStyle(wingLo, 1); g.fillRect(30, 65, 35, 8);

  // Neck
  g.fillStyle(body, 1); g.fillRect(55, 35, 16, 18);
  g.fillStyle(bodyHi, 1); g.fillRect(55, 35, 16, 5);

  // Head
  g.fillStyle(body, 1); g.fillRect(50, 10, 26, 26);
  g.fillStyle(bodyHi, 1); g.fillRect(50, 10, 26, 6);

  // Comb and wattle
  g.fillStyle(0xe03030, 1);
  g.fillRect(58, 4, 6, 8);
  g.fillRect(68, 6, 4, 6);

  // Eye
  g.fillStyle(0x1a0800, 1); g.fillCircle(68, 16, 3);
  g.fillStyle(WHITE, 0.7); g.fillCircle(67, 15, 1);

  // Beak
  g.fillStyle(0xe0c030, 1);
  g.fillRect(75, 17, 8, 4);
  g.fillStyle(0xb89820, 1);
  g.fillRect(80, 19, 3, 2);

  g.generateTexture(key, CHICKEN_SIZE, CHICKEN_SIZE);
  g.destroy();
}
