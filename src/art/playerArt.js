// Procedural pixel-art player character. 16×24 sprite, 4 directions, 2 walk frames each.
// Rendered at scale 2 in the world (32×48 on screen). Origin (0.5, 1) — feet at bottom.

const HAIR    = 0xc8844a; // warm auburn
const SKIN    = 0xf5c48a; // warm peach
const SHIRT   = 0x5aab8a; // teal green
const SHIRT_D = 0x3d8a6c; // teal shadow
const PANTS   = 0x7a5a38; // warm brown
const PANTS_D = 0x5a4028; // pants shadow
const SHOE    = 0x2a1808; // dark brown
const EYE     = 0x1a0a04; // near-black

// Facing down (toward camera) — we see the face.
function drawDown(g, step) {
  // Hair top + sides framing the face
  g.fillStyle(HAIR, 1);
  g.fillRect(4, 0, 8, 3);
  g.fillRect(3, 2, 2, 7);  // left side
  g.fillRect(11, 2, 2, 7); // right side

  // Face (drawn after hair, overwrites center hair pixels to show skin)
  g.fillStyle(SKIN, 1);
  g.fillRect(5, 2, 6, 7);

  // Eyes
  g.fillStyle(EYE, 1);
  g.fillRect(6, 5, 1, 2);
  g.fillRect(9, 5, 1, 2);

  // Shirt torso + arms
  g.fillStyle(SHIRT, 1);
  g.fillRect(4, 9, 8, 6);
  g.fillRect(2, 9, 3, 5);   // left arm
  g.fillRect(11, 9, 3, 5);  // right arm
  g.fillStyle(SHIRT_D, 1);
  g.fillRect(4, 13, 8, 2);  // bottom shadow

  // Hands (arms swing opposite each other on step frames)
  g.fillStyle(SKIN, 1);
  g.fillRect(step === 1 ? 1 : 2, step === 1 ? 13 : 14, 2, 2); // left
  g.fillRect(step === 1 ? 13 : 12, 14, 2, 2);                  // right

  // Belt / pants top
  g.fillStyle(PANTS, 1);
  g.fillRect(4, 15, 8, 2);

  // Legs: idle (step=0) feet together; walk (step=1) stride apart.
  // Both centered at x=7.5 (sprite center of 16px wide).
  const lx0 = step === 0 ? 4 : 3;
  const lx1 = step === 0 ? 9 : 10;
  g.fillStyle(PANTS, 1);
  g.fillRect(lx0, 17, 3, 4);
  g.fillRect(lx1, 17, 3, 4);
  g.fillStyle(PANTS_D, 1);
  g.fillRect(lx0 + 1, 19, 1, 2);
  g.fillRect(lx1 + 1, 19, 1, 2);

  // Shoes
  g.fillStyle(SHOE, 1);
  g.fillRect(step === 0 ? 3 : 2, 21, 4, 3);
  g.fillRect(step === 0 ? 9 : 10, 21, 4, 3);
}

// Facing up (away from camera) — we see the back of the head.
function drawUp(g, step) {
  // Back of head (all hair)
  g.fillStyle(HAIR, 1);
  g.fillRect(4, 0, 8, 3);
  g.fillRect(3, 2, 10, 6);  // wide hair covering back of head
  g.fillRect(3, 7, 2, 2);   // hair sides hanging
  g.fillRect(11, 7, 2, 2);

  // Tiny neck
  g.fillStyle(SKIN, 1);
  g.fillRect(7, 8, 2, 1);

  // Shirt + arms (same as down)
  g.fillStyle(SHIRT, 1);
  g.fillRect(4, 9, 8, 6);
  g.fillRect(2, 9, 3, 5);
  g.fillRect(11, 9, 3, 5);
  g.fillStyle(SHIRT_D, 1);
  g.fillRect(4, 13, 8, 2);

  // Hands
  g.fillStyle(SKIN, 1);
  g.fillRect(step === 1 ? 1 : 2, 14, 2, 2);
  g.fillRect(step === 1 ? 13 : 12, 14, 2, 2);

  // Belt
  g.fillStyle(PANTS, 1);
  g.fillRect(4, 15, 8, 2);

  // Legs
  const lx0 = step === 0 ? 4 : 3;
  const lx1 = step === 0 ? 9 : 10;
  g.fillStyle(PANTS, 1);
  g.fillRect(lx0, 17, 3, 4);
  g.fillRect(lx1, 17, 3, 4);
  g.fillStyle(PANTS_D, 1);
  g.fillRect(lx0 + 1, 19, 1, 2);
  g.fillRect(lx1 + 1, 19, 1, 2);

  // Shoes
  g.fillStyle(SHOE, 1);
  g.fillRect(step === 0 ? 3 : 2, 21, 4, 3);
  g.fillRect(step === 0 ? 9 : 10, 21, 4, 3);
}

// Facing right (side profile). Flipped for left.
function drawSide(g, step) {
  // Hair — back hangs left, slight front tuft
  g.fillStyle(HAIR, 1);
  g.fillRect(5, 0, 7, 3);    // hair top
  g.fillRect(3, 2, 4, 7);    // hair back (left side of sprite)
  g.fillRect(11, 1, 2, 4);   // hair front tuft

  // Face profile (right side of frame)
  g.fillStyle(SKIN, 1);
  g.fillRect(7, 2, 6, 7);    // face (overwrites front hair tuft at face level)

  // Eye (single eye in profile, toward front of face)
  g.fillStyle(EYE, 1);
  g.fillRect(10, 4, 1, 2);

  // Shirt body (slightly narrower in profile)
  g.fillStyle(SHIRT, 1);
  g.fillRect(5, 9, 7, 6);
  // Arms (front arm swings forward on step 1)
  const armF = step === 0 ? 11 : 12;
  const armB = step === 0 ? 4  : 3;
  g.fillRect(armF, 9, 2, 5);   // front arm
  g.fillRect(armB, 10, 2, 4);  // back arm (shorter, partially occluded)
  g.fillStyle(SHIRT_D, 1);
  g.fillRect(5, 13, 7, 2);

  // Hands
  g.fillStyle(SKIN, 1);
  g.fillRect(armF, 13, 2, 2);
  g.fillRect(armB, 13, 2, 2);

  // Belt
  g.fillStyle(PANTS, 1);
  g.fillRect(5, 15, 7, 2);

  // Legs — centered under torso (shirt x=5–11, center=8).
  // Near leg lifts 1px on step; far leg stays planted slightly behind.
  g.fillStyle(PANTS, 1);
  const nearY = step === 0 ? 17 : 16;
  g.fillRect(7, nearY, 3, 24 - nearY); // near leg (7-9), under body center
  g.fillRect(6, 18,    2, 6);           // far leg (6-7), planted behind

  g.fillStyle(PANTS_D, 1);
  g.fillRect(8, nearY + 2, 1, 2);

  // Shoes
  g.fillStyle(SHOE, 1);
  g.fillRect(6, 21, 4, 3);              // near shoe (6-9)
  if (step === 0) {
    g.fillRect(5, 21, 3, 2);            // far shoe (5-7) visible when near is down
  }
}

export function buildPlayerTextures(scene) {
  const make = (key, fn) => {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    fn(g);
    g.generateTexture(key, 16, 24);
    g.destroy();
  };

  make('player_down_0', g => drawDown(g, 0));
  make('player_down_1', g => drawDown(g, 1));
  make('player_up_0',   g => drawUp(g, 0));
  make('player_up_1',   g => drawUp(g, 1));
  make('player_side_0', g => drawSide(g, 0));
  make('player_side_1', g => drawSide(g, 1));
}
