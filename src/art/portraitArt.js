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
  const s = 5.5; // scale factor to match in-world proportions

  // Legs
  g.fillStyle(0xe0c030, 1);
  g.fillRect(4*s, 16*s, 2*s, 5*s-2*s); g.fillRect(9*s, 16*s, 2*s, 5*s-2*s);
  g.fillStyle(0xb89820, 1);
  g.fillRect(2*s, 21*s, 5*s, 1*s); g.fillRect(7*s, 21*s, 5*s, 1*s);

  // Tail
  g.fillStyle(tail, 1); g.fillRect(1*s, 9*s, 3*s, 5*s);
  g.fillStyle(tailDark, 1); g.fillRect(1*s, 12*s, 2*s, 4*s);

  // Body
  g.fillStyle(body, 1); g.fillRect(2*s, 10*s, 12*s, 8*s);
  g.fillStyle(bodyHi, 1); g.fillRect(2*s, 10*s, 12*s, 2*s);
  g.fillStyle(bodyLo, 1); g.fillRect(2*s, 15*s, 12*s, 3*s);
  g.fillStyle(wing, 1); g.fillRect(3*s, 11*s, 9*s, 5*s);
  g.fillStyle(wingLo, 1); g.fillRect(3*s, 14*s, 9*s, 2*s);

  // Neck and head
  g.fillStyle(body, 1); g.fillRect(11*s, 7*s, 4*s, 6*s);
  g.fillStyle(body, 1); g.fillRect(10*s, 2*s, 6*s, 7*s);
  g.fillStyle(bodyHi, 1); g.fillRect(10*s, 2*s, 6*s, 2*s);

  // Comb and eye
  g.fillStyle(0xe03030, 1);
  g.fillRect(11*s, 0*s, 2*s, 3*s); g.fillRect(13*s, 1*s, 2*s, 2*s); g.fillRect(10*s, 1*s, 2*s, 2*s);
  g.fillStyle(0xe03030, 1); g.fillRect(14*s, 6*s, 2*s, 3*s);
  g.fillStyle(0x1a0800, 1); g.fillRect(13*s, 4*s, 1*s, 2*s);
  g.fillStyle(0xffffff, 0.8); g.fillRect(12*s, 4*s, 1*s, 1*s);

  // Beak
  g.fillStyle(0xe0c030, 1); g.fillRect(15*s, 4*s, 1*s, 2*s);

  g.generateTexture(key, CHICKEN_SIZE, CHICKEN_SIZE);
  g.destroy();
}
