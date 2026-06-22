// Procedural pixel-art player character. 16×24 sprite, 4 directions, 4 walk frames each.
// Rendered at scale 2 in the world (32×48 on screen). Origin (0.5, 1) — feet at bottom.
//
// Walk cycle is 4 frames: 0 = passing (neutral), 1 = left-foot lead,
// 2 = passing (neutral), 3 = right-foot lead. Frame 0 doubles as the idle pose.
// Arms swing opposite the same-side leg for a natural gait.

const HAIR    = 0xc8844a; // warm auburn
const SKIN    = 0xf5c48a; // warm peach
const SHIRT   = 0x5aab8a; // teal green
const SHIRT_D = 0x3d8a6c; // teal shadow
const PANTS   = 0x7a5a38; // warm brown
const PANTS_D = 0x5a4028; // pants shadow
const SHOE    = 0x2a1808; // dark brown
const EYE     = 0x1a0a04; // near-black

// Per-frame stride for the front/back views. lead: 0 = none, -1 = left foot
// forward, +1 = right foot forward. A forward foot plants lower (toward camera
// for "down", away for "up"); the trailing foot lifts.
const STRIDE = [0, -1, 0, 1];

// Draw the two legs + shoes for the front/back views given the stride lead.
function drawLegsVert(g, lead) {
  // Base (passing) positions.
  let llY = 17, rlY = 17;   // leg-top y
  let lsY = 21, rsY = 21;   // shoe y
  let llX = 4,  rlX = 9;    // leg x
  let lsX = 3,  rsX = 9;    // shoe x
  if (lead === -1) {        // left foot forward, right trailing
    llY = 18; lsY = 22;
    rlY = 16; rsY = 20;
  } else if (lead === 1) {  // right foot forward, left trailing
    rlY = 18; rsY = 22;
    llY = 16; lsY = 20;
  }
  g.fillStyle(PANTS, 1);
  g.fillRect(llX, llY, 3, 21 - llY + 3);
  g.fillRect(rlX, rlY, 3, 21 - rlY + 3);
  g.fillStyle(PANTS_D, 1);
  g.fillRect(llX + 1, llY + 2, 1, 2);
  g.fillRect(rlX + 1, rlY + 2, 1, 2);
  g.fillStyle(SHOE, 1);
  g.fillRect(lsX, lsY, 4, 3);
  g.fillRect(rsX, rsY, 4, 3);
}

// Hands for the front/back views. Arms swing opposite the same-side leg, so a
// forward foot pairs with a raised (back) hand on that side.
function drawHandsVert(g, lead) {
  let lhY = 14, rhY = 14;
  if (lead === -1) { lhY = 13; rhY = 15; }      // left leg fwd → left arm back
  else if (lead === 1) { lhY = 15; rhY = 13; }  // right leg fwd → right arm back
  g.fillStyle(SKIN, 1);
  g.fillRect(2, lhY, 2, 2);
  g.fillRect(12, rhY, 2, 2);
}

// Facing down (toward camera) — we see the face.
function drawDown(g, frame) {
  const lead = STRIDE[frame];

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

  drawHandsVert(g, lead);

  // Belt / pants top
  g.fillStyle(PANTS, 1);
  g.fillRect(4, 15, 8, 2);

  drawLegsVert(g, lead);
}

// Facing up (away from camera) — we see the back of the head.
function drawUp(g, frame) {
  const lead = STRIDE[frame];

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

  drawHandsVert(g, lead);

  // Belt
  g.fillStyle(PANTS, 1);
  g.fillRect(4, 15, 8, 2);

  drawLegsVert(g, lead);
}

// Facing right (side profile). Flipped for left.
// Side stride alternates which leg leads: frame 1 swings the near (front) leg
// forward, frame 3 swings the far (back) leg forward; arms swing opposite.
function drawSide(g, frame) {
  const lead = STRIDE[frame]; // -1 near leg fwd, +1 far leg fwd, 0 passing

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
  // Arms — front arm swings forward when the near leg trails (lead +1) and
  // back when the near leg leads (lead -1).
  const armF = lead === -1 ? 11 : (lead === 1 ? 13 : 11);
  const armB = lead === -1 ? 3  : (lead === 1 ? 5  : 4);
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

  // Legs — near leg under body center (x=7), far leg behind (x=6). On a step the
  // leading leg reaches forward (+x) and plants lower; the trailing leg pulls
  // back (−x) and lifts.
  let nearX = 7, nearY = 17, nearShoeX = 6, nearShoeY = 21;
  let farX = 6,  farY = 18,  farShoeX = 5,  farShoeY = 21;
  let farShoeVisible = true;
  if (lead === -1) {          // near leg forward
    nearX = 8; nearShoeX = 8; nearShoeY = 21;
    farX = 5;  farY = 17;     farShoeX = 4; farShoeY = 20; // back leg lifted
  } else if (lead === 1) {    // far leg forward, near leg pulled back/lifted
    nearX = 6; nearY = 16;    nearShoeX = 5; nearShoeY = 20;
    farX = 9;  farY = 17;     farShoeX = 9; farShoeY = 21;
  }

  g.fillStyle(PANTS, 1);
  g.fillRect(farX, farY, 2, 24 - farY);    // far leg (drawn first, behind)
  g.fillRect(nearX, nearY, 3, 24 - nearY); // near leg
  g.fillStyle(PANTS_D, 1);
  g.fillRect(nearX + 1, nearY + 2, 1, 2);

  // Shoes
  g.fillStyle(SHOE, 1);
  if (farShoeVisible) g.fillRect(farShoeX, farShoeY, 3, 2); // far shoe (behind)
  g.fillRect(nearShoeX, nearShoeY, 4, 3);                   // near shoe
}

export function buildPlayerTextures(scene) {
  const make = (key, fn) => {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    fn(g);
    g.generateTexture(key, 16, 24);
    g.destroy();
  };

  for (let f = 0; f < 4; f++) {
    make(`player_down_${f}`, g => drawDown(g, f));
    make(`player_up_${f}`,   g => drawUp(g, f));
    make(`player_side_${f}`, g => drawSide(g, f));
  }
}
